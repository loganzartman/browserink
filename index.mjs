import { Brush } from "./Brush.mjs";

const resolutionScale = 1.0;

const main = () => {
  const display = document.getElementById("canvas");
  const buffer = document.createElement("canvas");
  const displayContext = display.getContext("2d");
  const bufferContext = buffer.getContext("2d");

  const resize = () => {
    buffer.width = display.width =
      window.innerWidth * window.devicePixelRatio * resolutionScale;
    buffer.height = display.height =
      window.innerHeight * window.devicePixelRatio * resolutionScale;
  };
  resize();

  const eventPos = (event) => [
    (event.pageX - canvas.offsetLeft) *
      window.devicePixelRatio *
      resolutionScale,
    (event.pageY - canvas.offsetTop) *
      window.devicePixelRatio *
      resolutionScale,
  ];

  let dragging = false;
  let latestPos = [0, 0];

  const brush = new Brush();

  const updateDisplay = () => {
    displayContext.clearRect(0, 0, display.width, display.height);
    displayContext.drawImage(buffer, 0, 0);

    brush.drawCursor(displayContext, latestPos);
  };

  const onPointerDown = (event) => {
    dragging = true;
    brush.moveTo(eventPos(event));
    event.preventDefault();
  };

  const onPointerUp = (event) => {
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
    updateDisplay();
  };

  window.addEventListener("resize", () => resize(), false);
  window.addEventListener("pointerdown", onPointerDown, false);
  window.addEventListener("pointerup", onPointerUp, false);
  window.addEventListener("pointerrawupdate", onPointerRawUpdate, false);
};

window.addEventListener("load", () => main(), false);
