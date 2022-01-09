import { lerp } from "./lerp.mjs";
import { defaultOptions as options } from "./options.mjs";
import { drawGradient } from "./drawGradient.mjs";

export class Brush {
  constructor() {
    this._stampTexture = document.createElement('canvas');
    this._colorizedTexture = document.createElement('canvas');
    this._colorizedColor = null;
    this.travel = 0; 

    this.color = options.color;
    this._size = options.size;
    this._hardness = options.hardness;
    this._noise = options.noise;
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

  get noise() {
    return this._noise;
  }
  set noise(noise) {
    this._noise = noise;
    this._updateStampTexture();
  }
  
  get stampSpacing() {
    return this.size / this.density * Math.max(0.1, this.state.pressure);
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
      noise: this.noise,
    });
    this._updateColorizedTexture(this._colorizedColor, true);
  }

  _updateColorizedTexture(color, forceUpdate=false) {
    if (!forceUpdate && color === this._colorizedColor) {
      return;
    }
    this._colorizedColor = color;
    const c = this._colorizedTexture.getContext('2d');
    const textureSize = this._colorizedTexture.width;
    c.globalCompositeOperation = 'copy';
    c.fillStyle = color;
    c.fillRect(0, 0, textureSize, textureSize);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(this._stampTexture, 0, 0);
  }

  _stamp({context: c, x, y, size, color}) {
    c.save();
    c.translate(x, y);
    if (this.jitter) {
      const length = Math.random() * Math.random() * this.jitter;
      const angle = Math.random() * Math.PI * 2;
      c.translate(Math.cos(angle) * length, Math.sin(angle) * length);
    }
    const realSize = this._expandedTextureSize(size);
    c.scale(realSize, realSize);
    c.rotate(Math.random() * Math.PI * 2);

    this._updateColorizedTexture(color);
    c.globalAlpha = this.opacity;
    c.drawImage(this._colorizedTexture, -0.5, -0.5, 1, 1);

    c.restore();
  }

  drawCursor({context, x, y}) {
    const c = context;
    c.save();

    const s = Math.max(4, this.size * 0.5 * this.lastPressure);

    c.strokeStyle = 'white';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(x, y, s, s, 0, 0, Math.PI * 2);
    c.stroke();
    
    c.strokeStyle = 'black';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(x, y, s, s, 0, 0, Math.PI * 2);
    c.stroke();
    
    c.restore();
  }

  moveTo({x, y, pressure}) {
    this.state = {x, y, pressure};
    this.lastStamp = {x, y};
    this.travel = 0;
  }

  strokeTo({context, x, y, pressure}) {
    const lastState = this.state;
    this.state = {x, y, pressure};

    const dx = x - lastState.x;
    const dy = y - lastState.y;
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    this.travel += dist;

    if (this.travel < this.stampSpacing) {
      return;
    }

    const sdx = x - this.lastStamp.x;
    const sdy = y - this.lastStamp.y;
    const sdist = Math.sqrt(sdx ** 2 + sdy ** 2);
    const stampSteps = Math.floor(sdist / this.stampSpacing);

    const a = {
      x: this.lastStamp.x,
      y: this.lastStamp.y,
      size: lastState.pressure * this.size,
    };
    const b = {
      x: a.x + sdx / sdist * this.stampSpacing * stampSteps,
      y: a.y + sdy / sdist * this.stampSpacing * stampSteps,
      size: pressure * this.size,
    };
    const color = this.color;

    for (let i = 0; i < stampSteps; ++i) {
      const blend = lerp(a, b, (i + 1) / stampSteps);
      this._stamp({...blend, context, color});
      this.lastStamp = {x: blend.x, y: blend.y};
    }
    this.travel %= this.stampSpacing;
  }
}
