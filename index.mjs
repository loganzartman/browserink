import { Brush } from "./Brush.mjs";

const resolutionScale = 1.0;

const main = () => {
  const canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth * window.devicePixelRatio * resolutionScale;
  canvas.height = window.innerHeight * window.devicePixelRatio * resolutionScale;
  const c = canvas.getContext('2d');
  let dragging = false;

  const brush = new Brush(c);

  const eventPos = (event) => [
    (event.pageX - canvas.offsetLeft) * window.devicePixelRatio * resolutionScale,
    (event.pageY - canvas.offsetTop) * window.devicePixelRatio * resolutionScale,
  ];

  const onPointerDown = (event) => {
    dragging = true;
    brush.moveTo(eventPos(event));
    event.preventDefault();
  };

  const onPointerUp = (event) => {
    dragging = false;
  };

  const onPointerRawUpdate = (event) => {
    if (dragging) {
      for (const e of event.getCoalescedEvents()) {
        brush.strokeTo(eventPos(e));
      }
      brush.strokeTo(eventPos(event));
      event.preventDefault();
    }
  };

  window.addEventListener("pointerdown", onPointerDown, false);
  window.addEventListener("pointerup", onPointerUp, false);
  window.addEventListener("pointermove", onPointerRawUpdate, false);
};

window.addEventListener("load", () => main(), false);
