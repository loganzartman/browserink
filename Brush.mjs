import { lerp } from "./lerp.mjs";
import { defaultOptions as options } from "./options.mjs";
import { drawGradient } from "./drawGradient.mjs";

export class Brush {
  constructor() {
    this._stampTexture = document.createElement('canvas');
    this._colorizedTexture = document.createElement('canvas');
    this.prevTravelPos = null;
    this.prevPos = null;
    this.travel = 0;

    this.color = options.color;
    this._size = options.size;
    this._hardness = options.hardness;
    this.opacity = options.opacity;
    this.density = options.density;
    this.jitter = options.jitter;

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

  _expandedTextureSize(size) {
    return size + (1 - this.hardness) * size;
  }

  _updateStampTexture() {
    const textureSize = Math.ceil(this._expandedTextureSize(this.size));
    this._stampTexture.width = this._stampTexture.height = textureSize;
    this._colorizedTexture.width = this._colorizedTexture.height = textureSize;
    drawGradient({
      context: this._stampTexture.getContext("2d"),
      size: textureSize,
      hardness: this.hardness,
      dither: 0.5,
    });
  }

  _updateColorizedTexture(tint) {
    const c = this._colorizedTexture.getContext('2d');
    const textureSize = this._colorizedTexture.width;
    c.globalCompositeOperation = 'copy';
    c.fillStyle = tint;
    c.globalAlpha = this.opacity;
    c.fillRect(0, 0, textureSize, textureSize);
    c.globalCompositeOperation = 'destination-in';
    c.globalAlpha = 1;
    c.drawImage(this._stampTexture, 0, 0);
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
    if (this.jitter) {
      const length = Math.random() * Math.random() * this.jitter;
      const angle = Math.random() * Math.PI * 2;
      c.translate(Math.cos(angle) * length, Math.sin(angle) * length);
    }
    const size = this._expandedTextureSize(params.size);
    c.scale(size, size);
    c.rotate(Math.random() * Math.PI * 2);

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
    const color = this.color;

    const stampSteps = Math.floor(this.travel / this.stampSpacing);
    for (let i = 0; i < stampSteps; ++i) {
      const blend = lerp(a, b, (i + 1) / stampSteps);
      this._stamp(context, {...blend, color});
    }
    this.travel %= this.stampSpacing;
    this.prevPos = pos;
  }
}
