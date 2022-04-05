import { Brush } from "./Brush.mjs";
import "./tweakpane-3.0.7.js";
import "./tweakpane-plugin-essentials-0.1.4.js";
import { defaultOptions as options } from "./options.mjs";
import { RenderTexture } from "./RenderTexture.mjs";
import { TextureQuad } from "./Quad.mjs";
import { EventNode } from "./EventNode.mjs";
import { History } from "./History.mjs";
import { DebugRenderer } from "./DebugRenderer.mjs";

const setupGui = ({brush, undo, redo, clear, textureQuad}) => {
  const pane = new Tweakpane.Pane();
  pane.registerPlugin(TweakpaneEssentialsPlugin);

  const displayPane = pane.addFolder({title: "Display"});
  displayPane.addInput(options, "resolutionScale", {min: 0.1, max: 2.0, step: 0.1});
  displayPane.addInput(textureQuad, "dither");
  displayPane.addInput(options, "showDebug");

  const brushPane = pane.addFolder({title: "Brush"});
  brushPane.addInput(brush, "color", {picker: "inline", expanded: true});
  brushPane.addInput(brush, "size", {min: 1.0, max: 1024.0});
  brushPane.addInput(brush, "hardness", {min: 0.0, max: 1.0});
  brushPane.addInput(brush, "noise", {min: 0.0, max: 1.0});
  brushPane.addInput(brush, "density", {min: 1, max: 16, step: 1});

  const dynamicsPane = pane.addFolder({title: "Dynamics"});
  dynamicsPane.addInput(brush, "smoothing", {min: 0.0, max: 0.9});
  dynamicsPane.addInput(brush, "pressureFactor", {min: 0.0, max: 1.0});
  dynamicsPane.addInput(brush, "tiltFactor", {min: 0.0, max: 1.0});

  const editPane = pane.addFolder({title: "Edit"});

  const editCells = [{title: "Undo"}, {title: "Redo"}, {title: "Clear"}];
  const editActions = [undo, redo, clear];
  editPane
    .addBlade({
      view: "buttongrid",
      size: [editCells.length, 1],
      cells: (x, _) => editCells[x],
    })
    .on("click", ({index: [x, _]}) => {
      editActions[x]();
    });
};

const main = () => {
  const events = new EventNode();
  const history = new History(events);
  const debugRenderer = new DebugRenderer(events);
  let dragging = false;
  let latestPos = {x: 0, y: 0};

  const buffer = document.getElementById("image-canvas");
  const display = document.getElementById("ui-canvas");
  const bufferGl = buffer.getContext("webgl2", {
    alpha: true,
  });
  const displayContext = display.getContext("2d", {
    alpha: true,
  });
  if (!bufferGl) {
    document.body.innerHTML = 'WebGL2 not supported.';
    return;
  }
  const imageTexture = new RenderTexture({gl: bufferGl});
  const textureQuad = new TextureQuad({gl: bufferGl, dither: options.dither});
  const brush = new Brush({canvas: buffer, gl: bufferGl, imageTexture});

  const updateDisplay = () => {
    bufferGl.viewport(0, 0, buffer.width, buffer.height);
    brush.drawStamps();

    bufferGl.clearColor(1, 1, 1, 1);
    bufferGl.clear(bufferGl.COLOR_BUFFER_BIT);
    textureQuad.draw(imageTexture.texture);

    displayContext.clearRect(0, 0, display.width, display.height);
    displayContext.save();
    displayContext.scale(
      display.width / buffer.width, 
      display.height / buffer.height
    );
    brush.drawCursor({
      context: displayContext, 
      ...latestPos,
    });
    displayContext.restore();

    if (options.showDebug) {
      debugRenderer.render(displayContext);
    }
  };

  const undo = () => {
    history.undo();
    updateDisplay();
  };
  const redo = () => {
    history.redo();
    updateDisplay();
  };

  const clear = () => {
    events.emit({name: 'checkpoint', displayName: 'Clear'});
    events.emit({name: 'clear'});
  };
  const internalClear = () => {
    imageTexture.bindFramebuffer();
    bufferGl.clearColor(1, 1, 1, 1);
    bufferGl.clear(bufferGl.COLOR_BUFFER_BIT);
    imageTexture.unbindFramebuffer();
    updateDisplay();
  };
  events.on('clear', function onClear() {
    internalClear();
  });

  const exportImage = async () => {
    const blob = await new Promise((resolve) => buffer.toBlob(resolve));
    window.open(URL.createObjectURL(blob), "_blank");
  };
  const resize = () => {
    const width = Math.floor(window.innerWidth * window.devicePixelRatio);
    const height = Math.floor(window.innerHeight * window.devicePixelRatio);
    display.width = width;
    display.height = height;
    buffer.width = width * options.resolutionScale;
    buffer.height = height * options.resolutionScale;
    imageTexture.resize(width, height);
    clear();
  };
  resize();

  setupGui({brush, undo, redo, clear, textureQuad});

  const eventPos = (event) => {
    const bounds = display.getBoundingClientRect();
    const ratio = display.width / bounds.width;
    return {
      x: (event.clientX - bounds.left) * ratio * options.resolutionScale,
      y: (event.clientY - bounds.top) * ratio * options.resolutionScale,
    };
  };

  const eventTilt = (event) => ({
    tiltAngle: Math.atan2(event.tiltY, event.tiltX) + Math.PI * 0.5,
    tiltMagnitude: Math.sqrt(event.tiltX ** 2 + event.tiltY ** 2),
  });

  const onKeyDown = (event) => {
    if (event.ctrlKey && event.key === 'z') {
      undo();
      event.preventDefault();
    }
    if (event.ctrlKey && event.key === 'y') {
      redo();
      event.preventDefault();
    }
    if (event.ctrlKey && event.key === 'Z') {
      redo();
      event.preventDefault();
    }
  };

  events.on('brushMove', function onBrushMove({params}) {
    brush.moveTo(params);
  });
  events.on('brushStroke', function onBrushMove({params}) {
    brush.strokeTo(params);
  });

  const onPointerDown = (event) => {
    if (event.target !== display) {
      return;
    }
    dragging = true;
    events.emit({name: 'checkpoint', displayName: 'Stroke'});
    events.emit({
      name: 'brushMove', 
      params: {
        ...eventPos(event),
        ...eventTilt(event),
        pressure: event.pressure,
      },
    });
  };

  const onPointerUp = (event) => {
    if (event.target !== display) {
      return;
    }
    dragging = false;
  };

  const onPointerUpdate = (event) => {
    latestPos = eventPos(event);

    // debug
    {
      const {width, height, pressure, tangentialPressure, tiltX, tiltY, twist, pointerType, button, buttons} = event;
      events.emit({
        name: 'debugText',
        record: false,
        key: 'pointer',
        value: {
          width, height, pressure, tangentialPressure, tiltX, tiltY, twist, pointerType, button, buttons
        },
      });
    }

    if (dragging) {
      if (event.getCoalescedEvents) {
        for (const e of event.getCoalescedEvents()) {
          events.emit({
            name: 'brushStroke', 
            params: {
              ...eventPos(e),
              ...eventTilt(e),
              pressure: e.pressure,
            },
          });
        }
      }
      events.emit({
        name: 'brushStroke', 
        params: {
          ...eventPos(event),
          ...eventTilt(event),
          pressure: event.pressure,
        },
      });
    }
    event.preventDefault();
  };

  requestAnimationFrame(function af() {
    requestAnimationFrame(af);
    updateDisplay();
  });

  window.addEventListener("resize", () => resize(), false);
  window.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("pointerdown", onPointerDown, false);
  window.addEventListener("pointerup", onPointerUp, false);
  window.addEventListener("pointermove", onPointerUpdate, false);
};

window.addEventListener("load", () => main(), false);
