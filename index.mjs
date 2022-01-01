const main = () => {
  const canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  const c = canvas.getContext('2d');
  let dragging = false;
  let prevPos = null;

  const eventPos = (event) => [
    (event.pageX - canvas.offsetLeft) * window.devicePixelRatio,
    (event.pageY - canvas.offsetTop) * window.devicePixelRatio,
  ];

  const onPointerDown = (event) => {
    dragging = true;
    prevPos = eventPos(event);
  };

  const onPointerUp = (event) => {
    dragging = false;
  };

  const onPointerRawUpdate = (event) => {
    const pos = eventPos(event);
    if (dragging) {
      c.beginPath();
      c.moveTo(...prevPos);
      c.lineTo(...pos);
      c.stroke();
    }
    prevPos = pos;
  };

  window.addEventListener("pointerdown", onPointerDown, false);
  window.addEventListener("pointerup", onPointerUp, false);
  window.addEventListener("pointerrawupdate", onPointerRawUpdate, false);
};

window.addEventListener("load", () => main(), false);
