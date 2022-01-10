import { Brush } from "./Brush.mjs";
import dat from "./dat.gui.module.js";
import { defaultOptions as options } from "./options.mjs";
import { Snapshotter } from "./Snapshotter.mjs";

const main = () => {
  const brush = new Brush();

  const display = document.getElementById("canvas");
  const buffer = document.createElement("canvas");
  const displayContext = display.getContext("2d");
  const bufferContext = buffer.getContext("2d");
  const snapshotter = new Snapshotter(buffer);

  const clear = () => {
    bufferContext.clearRect(0, 0, buffer.width, buffer.height);
    updateDisplay();
  };
  const exportImage = async () => {
    const blob = await new Promise((resolve) => buffer.toBlob(resolve));
    window.open(URL.createObjectURL(blob), "_blank");
  };
  const resize = () => {
    display.width = window.innerWidth * window.devicePixelRatio;
    display.height = window.innerHeight * window.devicePixelRatio;
    buffer.width = window.innerWidth * window.devicePixelRatio * options.resolutionScale;
    buffer.height = window.innerHeight * window.devicePixelRatio * options.resolutionScale;
  };
  resize();

  const gui = new dat.GUI();
  gui.remember(options);
  gui.add(options, "lowLatency");
  gui.add(options, 'resolutionScale').min(0.1).max(2.0).step(0.1).onFinishChange(() => resize());
  gui.addColor(options, "color").onChange(() => {brush.color = options.color});
  gui.add(options, "size").min(1).max(1024).onFinishChange(() => {brush.size = options.size});
  gui.add(options, "hardness").min(0).max(1).onFinishChange(() => {brush.hardness = options.hardness});
  gui.add(options, "noise").min(0).max(1).onFinishChange(() => {brush.noise = options.noise});
  gui.add(options, "opacity").min(0).max(1).step(0.01).onChange(() => {brush.opacity = options.opacity});
  gui.add(options, "density").min(1).max(16).step(1).onChange(() => {brush.density = options.density});
  gui.add(options, "jitter").min(0).max(1024).step(1).onChange(() => {brush.jitter = options.jitter});
  const guiDynamics = gui.addFolder("Dynamics");
  guiDynamics.add(options, "smoothing").min(0).max(0.9).onChange(() => {brush.smoothing = options.smoothing});
  guiDynamics.add(options, "pressureFactor").min(0).max(1).onChange(() => {brush.pressureFactor = options.pressureFactor});
  guiDynamics.add(options, "tiltFactor").min(0).max(1).onChange(() => {brush.tiltFactor = options.tiltFactor});
  const guiEdit = gui.addFolder('Edit');
  guiEdit.add({undo: () => snapshotter.undo()}, "undo");
  guiEdit.add({redo: () => snapshotter.redo()}, "redo");
  guiEdit.add({clear}, "clear");
  guiEdit.add({exportImage}, "exportImage");

  const eventPos = (event) => ({
    x: (event.pageX - canvas.offsetLeft) *
      window.devicePixelRatio *
      options.resolutionScale,
    y: (event.pageY - canvas.offsetTop) *
      window.devicePixelRatio *
      options.resolutionScale,
  });

  const eventTilt = (event) => ({
    tiltAngle: Math.atan2(event.tiltY, event.tiltX) + Math.PI * 0.5,
    tiltMagnitude: Math.sqrt(event.tiltX ** 2 + event.tiltY ** 2),
  });

  let dragging = false;
  let latestPos = {x: 0, y: 0};

  const updateDisplay = () => {
    displayContext.clearRect(0, 0, display.width, display.height);
    displayContext.imageSmoothingEnabled = false;
    displayContext.drawImage(buffer, 0, 0, display.width, display.height);

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

  const onKeyDown = (event) => {
    if (event.ctrlKey && event.key === 'z') {
      snapshotter.undo();
      updateDisplay();
      event.preventDefault();
    }
    if (event.ctrlKey && event.key === 'y') {
      snapshotter.redo();
      updateDisplay();
      event.preventDefault();
    }
    if (event.ctrlKey && event.key === 'Z') {
      snapshotter.redo();
      updateDisplay();
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
      pressure: event.pressure
    });
    snapshotter.save();
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
      for (const e of event.getCoalescedEvents()) {
        brush.strokeTo({
          context: bufferContext, 
          ...eventPos(e), 
          ...eventTilt(e),
          pressure: event.pressure,
        });
      }
      brush.strokeTo({
        context: bufferContext, 
        ...eventPos(event),
        ...eventTilt(event), 
        pressure: event.pressure,
      });
    }
    event.preventDefault();

    if (options.lowLatency) {
      updateDisplay();
    }
  };

  requestAnimationFrame(function af() {
    if (!options.lowLatency) {
      updateDisplay();
    }
    requestAnimationFrame(af);
  });

  window.addEventListener("resize", () => resize(), false);
  window.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("pointerdown", onPointerDown, false);
  window.addEventListener("pointerup", onPointerUp, false);
  window.addEventListener("pointermove", onPointerUpdate, false);
};

window.addEventListener("load", () => main(), false);
