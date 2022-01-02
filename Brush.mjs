import { lerp } from "./lerp.mjs";

export class Brush {
  constructor(context) {
    this.c = context;
    this.prevTravelPos = null;
    this.prevPos = null;
    this.travel = 0;
    this.size = 64;
    this.density = 1;
  }

  get splatSpacing() {
    return this.size / this.density;
  }

  _updateTravel(pos) {
    const dx = pos[0] - this.prevTravelPos[0];
    const dy = pos[1] - this.prevTravelPos[1];
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    this.prevTravelPos = pos;
    this.travel += dist;
  }

  _splat(params) {
    this.c.fillStyle = 'rgba(0,0,0,0.5)'
    this.c.save();
    this.c.translate(params.x, params.y);
    this.c.scale(params.size, params.size);

    this.c.beginPath();
    this.c.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
    this.c.fill();

    this.c.restore();
  }

  moveTo(pos) {
    this.prevTravelPos = pos;
    this.prevPos = pos;
  }

  strokeTo(pos) {
    this._updateTravel(pos);
    if (this.travel < this.splatSpacing) {
      return;
    }

    const a = {
      x: this.prevPos[0],
      y: this.prevPos[1],
      size: this.size,
    };
    const b = {
      x: pos[0],
      y: pos[1],
      size: this.size,
    };

    const splatSteps = Math.floor(this.travel / this.splatSpacing);
    for (let i = 0; i < splatSteps; ++i) {
      const blend = lerp(a, b, (i + 1) / splatSteps);
      this._splat(blend);
    }
    this.travel %= this.splatSpacing;
    this.prevPos = pos;
  }
}
