import { Brush } from "./brush.mjs";

const main = () => {
  const canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  const c = canvas.getContext('2d');
  let dragging = false;

  const brush = new Brush(c);

  const eventPos = (event) => [
    (event.pageX - canvas.offsetLeft) * window.devicePixelRatio,
    (event.pageY - canvas.offsetTop) * window.devicePixelRatio,
  ];

  const onPointerDown = (event) => {
    dragging = true;
    brush.moveTo(eventPos(event));
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
    }
  };

  window.addEventListener("pointerdown", onPointerDown, false);
  window.addEventListener("pointerup", onPointerUp, false);
  window.addEventListener("pointerrawupdate", onPointerRawUpdate, false);
};

window.addEventListener("load", () => main(), false);
