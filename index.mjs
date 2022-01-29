import { WebGLDebugUtils } from "./webgl-debug.mjs";
import { Brush } from "./Brush.mjs";
import "./tweakpane-3.0.7.js";
import "./tweakpane-plugin-essentials-0.1.4.js";
import { defaultOptions as options } from "./options.mjs";
import { Snapshotter } from "./Snapshotter.mjs";
import { RenderTexture } from "./RenderTexture.mjs";
import { TextureQuad } from "./Quad.mjs";

const setupGui = ({brush, undo, redo, clear}) => {
  const pane = new Tweakpane.Pane();
  pane.registerPlugin(TweakpaneEssentialsPlugin);

  const displayPane = pane.addFolder({title: "Display"});
  displayPane.addInput(options, "resolutionScale", {min: 0.1, max: 2.0, step: 0.1});

  const brushPane = pane.addFolder({title: "Brush"});
  brushPane.addInput(brush, "color", {picker: "inline", expanded: true});
  brushPane.addInput(brush, "size", {min: 1.0, max: 1024.0});
  brushPane.addInput(brush, "hardness", {min: 0.0, max: 1.0});
  brushPane.addInput(brush, "noise", {min: 0.0, max: 1.0});
  brushPane.addInput(brush, "density", {min: 1, max: 16, step: 1});
  brushPane
    .addBlade({
      view: "cubicbezier",
      value: options.curve,
      expanded: false,
      label: "curve",
      picker: "inline",
    })
    .on("change", ({value}) => {
      brush.curve = [value.x1, value.y1, value.x2, value.y2]
    });

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
  let dragging = false;
  let latestPos = {x: 0, y: 0};

  const buffer = document.getElementById("image-canvas");
  const display = document.getElementById("ui-canvas");
  const bufferGl = WebGLDebugUtils.makeDebugContext(
    buffer.getContext("webgl2", {
      alpha: true,
    })
  );
  const displayContext = display.getContext("2d", {
    alpha: true,
  });
  if (!bufferGl) {
    document.body.innerHTML = 'WebGL2 not supported.';
    return;
  }
  const imageTexture = new RenderTexture({gl: bufferGl});
  const textureQuad = new TextureQuad({gl: bufferGl});
  const brush = new Brush({canvas: buffer, gl: bufferGl, imageTexture});
  const snapshotter = new Snapshotter(buffer);

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
  };

  const undo = () => {
    // snapshotter.undo();
    updateDisplay();
  };
  const redo = () => {
    // snapshotter.redo();
    updateDisplay();
  };
  const clear = () => {
    imageTexture.bindFramebuffer();
    bufferGl.clearColor(1, 1, 1, 1);
    bufferGl.clear(bufferGl.COLOR_BUFFER_BIT);
    imageTexture.unbindFramebuffer();
    updateDisplay();
  };
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

  setupGui({brush, undo, redo, clear});

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

  const onPointerDown = (event) => {
    if (event.target !== display) {
      return;
    }
    dragging = true;
    brush.moveTo({
      ...eventPos(event),
      ...eventTilt(event),
      pressure: event.pressure,
    })
    // snapshotter.save();
  };

  const onPointerUp = (event) => {
    if (event.target !== display) {
      return;
    }
    dragging = false;
  };

  const onPointerUpdate = (event) => {
    latestPos = eventPos(event);

    if (dragging) {
      if (event.getCoalescedEvents) {
        for (const e of event.getCoalescedEvents()) {
          brush.strokeTo({
            ...eventPos(e),
            ...eventTilt(e),
            pressure: event.pressure,
          })
        }
      }
      brush.strokeTo({
        ...eventPos(event),
        ...eventTilt(event),
        pressure: event.pressure,
      })
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
