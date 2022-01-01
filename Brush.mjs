export class Brush {
  constructor(context) {
    this.c = context;
    this.prevPos = null;
    this.size = 8.0;
    this.density = 4.0;
  }
  
  moveTo(pos) {
    this.prevPos = pos;
  }

  strokeTo(pos) {
    const dx = pos[0] - this.prevPos[0];
    const dy = pos[1] - this.prevPos[1];
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    if (dist * this.density < this.size) {
      return;
    }

    const steps = Math.floor(dist / this.size * this.density);
    this.c.fillStyle = 'black';
    for (let i = 0; i < steps; ++i) {
      const f = i / steps;
      const px = this.prevPos[0] + dx * f;
      const py = this.prevPos[1] + dy * f;
      this.c.beginPath();
      this.c.ellipse(px, py, this.size, this.size, 0, 0, Math.PI * 2);
      this.c.fill();
    }
    this.prevPos = pos;
  }
}