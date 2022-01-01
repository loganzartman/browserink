export class Brush {
  constructor(context) {
    this.c = context;
    this.pos = null;
    this.prevPos = null;
    this.prevTime = 0;
    this.prevSpeedFactor = 1.0;
    this.size = 8.0;
    this.density = 2.0;
  }

  moveTo(pos) {
    this.prevPos = pos;
    this.prevTime = performance.now();
  }

  strokeTo(pos) {
    const dx = pos[0] - this.prevPos[0];
    const dy = pos[1] - this.prevPos[1];
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    if (dist * this.density < this.size) {
      return;
    }

    const dt = Math.max(0.001, performance.now() - this.prevTime);
    const speed = Math.sqrt((dx / dt) ** 2 + (dy / dt) ** 2);
    const speedFactor = this.prevSpeedFactor * 0.9 + 0.1 * Math.max(0.1, 1.0 - speed / 20.0);
    const prevSize = this.size * this.prevSpeedFactor;
    const size = this.size * speedFactor;
    const dSize = size - prevSize;
    const steps = Math.floor((dist / Math.max(1.0, size)) * this.density);
    this.c.fillStyle = "black";
    for (let i = 0; i < steps; ++i) {
      const f = i / steps;
      const px = this.prevPos[0] + dx * f;
      const py = this.prevPos[1] + dy * f;
      this.c.beginPath();
      this.c.ellipse(
        px,
        py,
        prevSize + dSize * f,
        prevSize + dSize * f,
        0,
        0,
        Math.PI * 2
      );
      this.c.fill();
    }
    this.prevPos = pos;
    this.prevTime = performance.now();
    this.prevSpeedFactor = speedFactor;
  }
}
