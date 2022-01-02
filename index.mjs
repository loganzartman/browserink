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
    bufferContext.fillStyle = options.color;
    bufferContext.fillRect(0, 0, buffer.width, buffer.height);
  };
  const resize = () => {
    buffer.width = display.width =
      window.innerWidth * window.devicePixelRatio * options.resolutionScale;
    buffer.height = display.height =
      window.innerHeight * window.devicePixelRatio * options.resolutionScale;
  };
  resize();

  const gui = new dat.GUI();
  gui.remember(options);
  gui.add(options, "lowLatency");
  gui.add(options, 'resolutionScale').min(0.1).max(2.0).step(0.1).onFinishChange(() => resize());
  gui.addColor(options, "color").onChange(() => {brush.color = options.color});
  gui.add(options, "size").min(1).max(1024).onChange(() => {brush.size = options.size});
  gui.add(options, "hardness").min(0).max(1).onChange(() => {brush.hardness = options.hardness});
  gui.add(options, "opacity").min(0).max(1).step(0.01).onChange(() => {brush.opacity = options.opacity});
  gui.add(options, "density").min(1).max(16).step(1).onChange(() => {brush.density = options.density});
  const guiEdit = gui.addFolder('Edit');
  guiEdit.add({undo: () => snapshotter.undo()}, "undo");
  guiEdit.add({redo: () => snapshotter.redo()}, "redo");
  guiEdit.add({clear}, "clear").name('clear to color');

  const eventPos = (event) => [
    (event.pageX - canvas.offsetLeft) *
      window.devicePixelRatio *
      options.resolutionScale,
    (event.pageY - canvas.offsetTop) *
      window.devicePixelRatio *
      options.resolutionScale,
  ];

  let dragging = false;
  let latestPos = [0, 0];

  const updateDisplay = () => {
    displayContext.clearRect(0, 0, display.width, display.height);
    displayContext.drawImage(buffer, 0, 0);

    brush.drawCursor(displayContext, latestPos);
  };

  const onKeyUp = (event) => {
    if (event.ctrlKey && event.key === 'z') {
      snapshotter.undo();
      event.preventDefault();
      console.log('undo');
    }
    if (event.ctrlKey && event.key === 'y') {
      snapshotter.redo();
      event.preventDefault();
    }
    if (event.ctrlKey && event.key === 'Z') {
      snapshotter.redo();
      event.preventDefault();
    }
  };

  const onPointerDown = (event) => {
    if (event.target !== display) {
      return;
    }
    dragging = true;
    brush.moveTo(eventPos(event));
    snapshotter.save();
    console.log('save');
  };

  const onPointerUp = (event) => {
    if (event.target !== display) {
      return;
    }
    dragging = false;
  };

  const onPointerRawUpdate = (event) => {
    latestPos = eventPos(event);
    if (dragging) {
      for (const e of event.getCoalescedEvents()) {
        brush.strokeTo(bufferContext, eventPos(e));
      }
      brush.strokeTo(bufferContext, eventPos(event));
      event.preventDefault();
    }

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
  window.addEventListener("keyup", onKeyUp, false);
  window.addEventListener("pointerdown", onPointerDown, false);
  window.addEventListener("pointerup", onPointerUp, false);
  window.addEventListener("pointerrawupdate", onPointerRawUpdate, false);
};

window.addEventListener("load", () => main(), false);
