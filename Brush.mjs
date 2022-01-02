import { lerp } from "./lerp.mjs";

export class Brush {
  constructor() {
    this.prevTravelPos = null;
    this.prevPos = null;
    this.travel = 0;
    this.size = 32;
    this.hardness = 0.8;
    this.density = 4;
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

  _splat(context, params) {
    const c = context;
    c.save();
    c.translate(params.x, params.y);
    c.scale(params.size, params.size);

    c.beginPath();
    c.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2);
    c.fill();

    c.restore();
  }

  drawCursor(context, pos) {
    const c = context;
    c.save();

    c.strokeStyle = 'white';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(...pos, this.size, this.size, 0, 0, Math.PI * 2);
    c.stroke();
    
    c.strokeStyle = 'black';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(...pos, this.size, this.size, 0, 0, Math.PI * 2);
    c.stroke();
    
    c.restore();
  }

  moveTo(pos) {
    this.prevTravelPos = pos;
    this.prevPos = pos;
  }

  strokeTo(context, pos) {
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
      const fill = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      fill.addColorStop(this.hardness, `hsla(${Date.now()*0.1%360},50%,50%,1.0)`);
      fill.addColorStop(1, `hsla(${Date.now()*0.1%360},50%,50%,0.0)`);
      context.fillStyle = fill;
      this._splat(context, blend);
    }
    this.travel %= this.splatSpacing;
    this.prevPos = pos;
  }
}
