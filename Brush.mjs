import { lerp } from "./lerp.mjs";

export class Brush {
  constructor() {
    this._stampTexture = document.createElement('canvas');
    this._colorizedTexture = document.createElement('canvas');
    this.prevTravelPos = null;
    this.prevPos = null;
    this.travel = 0;
    this._size = 32;
    this._hardness = 0.8;
    this.density = 4;

    this._updateStampTexture();
  }

  get size() {
    return this._size;
  }
  set size(size) {
    this._size = size;
    this._updateStampTexture();
  }

  get hardness() {
    return this._hardness;
  }
  set hardness(hardness) {
    this._hardness = hardness;
    this._updateStampTexture();
  }
  
  get stampSpacing() {
    return this.size / this.density;
  }

  _updateStampTexture() {
    this._stampTexture.width = this._stampTexture.height = this.size;
    this._colorizedTexture.width = this._colorizedTexture.height = this.size;
    const c = this._stampTexture.getContext('2d');
    c.save();
    c.scale(this.size, this.size);
    const fill = c.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.5);
    fill.addColorStop(this.hardness, 'rgba(255,255,255,1)');
    fill.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = fill;
    c.fillRect(0, 0, 1, 1);
    c.restore();
  }

  _updateColorizedTexture(tint) {
    const c = this._colorizedTexture.getContext('2d');
    c.globalCompositeOperation = 'copy';
    c.fillStyle = tint;
    c.fillRect(0, 0, this.size, this.size);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(this._stampTexture, 0, 0, this.size, this.size);
  }

  _updateTravel(pos) {
    const dx = pos[0] - this.prevTravelPos[0];
    const dy = pos[1] - this.prevTravelPos[1];
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    this.prevTravelPos = pos;
    this.travel += dist;
  }

  _stamp(context, params) {
    const c = context;
    c.save();
    c.translate(params.x, params.y);
    c.scale(params.size, params.size);

    this._updateColorizedTexture(params.color);
    c.drawImage(this._colorizedTexture, -0.5, -0.5, 1, 1);

    c.restore();
  }

  drawCursor(context, pos) {
    const c = context;
    c.save();

    const s = this.size * 0.5;

    c.strokeStyle = 'white';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(...pos, s, s, 0, 0, Math.PI * 2);
    c.stroke();
    
    c.strokeStyle = 'black';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(...pos, s, s, 0, 0, Math.PI * 2);
    c.stroke();
    
    c.restore();
  }

  moveTo(pos) {
    this.prevTravelPos = pos;
    this.prevPos = pos;
  }

  strokeTo(context, pos) {
    this._updateTravel(pos);
    if (this.travel < this.stampSpacing) {
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
    const color = 'red';

    const stampSteps = Math.floor(this.travel / this.stampSpacing);
    for (let i = 0; i < stampSteps; ++i) {
      const blend = lerp(a, b, (i + 1) / stampSteps);
      this._stamp(context, {...blend, color});
    }
    this.travel %= this.stampSpacing;
    this.prevPos = pos;
  }
}
