import { lerp } from "./lerp.mjs";
import { defaultOptions as options } from "./options.mjs";
import { drawGradient } from "./drawGradient.mjs";

const glsl = (strings, ...variables) => {
  const joined = strings
    .map((s, i) => s + (variables[i] ?? ''))
    .join('')
    .replace(/^[\n\r]+/, '');
  const indent = joined.match(/^(\s*)(\S|$)/)[1];
  return joined.replace(new RegExp(`^${indent}`, 'gm'), '');
};

const compileShader = (gl, shaderType, shaderSrc) => {
  const shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSrc);
  gl.compileShader(shader);
 
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    throw new Error(`Failed to compile shader: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

const checkProgram = (gl, name, program) => {
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Could not compile WebGL program '${name}'. \n\n${info}`);
  }
};

const stampVertSrc = glsl`
  #version 300 es
  uniform vec2 resolution;

  in vec2 vertexOffset;
  in vec2 pos;
  in float size;

  out vec2 offset;

  void main() {
    vec2 vertexPos = pos + vertexOffset * size;

    offset = vertexOffset * 2.0;
    gl_Position = vec4(
      (vertexPos / resolution - vec2(0.5)) * vec2(1.0, -1.0) * 2.0,
      0.0,
      1.0
    );
  }
`;

const stampFragSrc = glsl`
  #version 300 es
  precision highp float;
  uniform vec4 brushColor;

  in vec2 offset;

  out vec4 color;

  float easeInCubic(float f) {
    return f * f * f;
  }

  void main() {
    float f = max(0.0, 1.0 - length(offset));
    f = easeInCubic(f);
    color = vec4(1.0, 1.0, 1.0, f) * brushColor;
  }
`;

export class Brush {
  constructor({canvas, gl}) {
    this.canvas = canvas;
    this.gl = gl;
    this._stampTexture = document.createElement('canvas');
    this._colorizedTexture = document.createElement('canvas');
    this._colorizedColor = null;
    this.travel = 0; 
    this.state = {
      x: 0,
      y: 0,
      pressure: 0.5,
      tiltAngle: 0,
      tiltMagnitude: 0,
    };

    this.color = options.color;
    this._size = options.size;
    this._hardness = options.hardness;
    this._noise = options.noise;
    this.opacity = options.opacity;
    this.density = options.density;
    this.jitter = options.jitter;

    this.smoothing = options.smoothing;
    this.pressureFactor = options.pressureFactor;
    this.tiltFactor = options.tiltFactor;

    this._updateStampTexture();

    this._stampVao = null;

    this._stampVertexOffsetVbo = null;
    this._stampPosVbo = null;
    this._stampSizeVbo = null;

    this._stampPosData = null;
    this._stampSizeData = null;

    this._stampMaxCount = 0;
    this._stampIndex = 0;

    this._initGl();
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

  getPressure(pressure) {
    return 0.5 + (pressure - 0.5) * this.pressureFactor;
  }

  getRatio(tiltMagnitude) {
    return 1 / (1 + tiltMagnitude * this.tiltFactor * 0.1);
  }

  get angle() {
    return this.state.tiltAngle;
  }
  
  get stampSpacing() {
    return this.size / this.density * Math.max(0.1, this.getPressure(this.state.pressure)) * this.getRatio(this.state.tiltMagnitude);
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

  _initGl() {
    const {gl} = this;

    const stampVs = compileShader(gl, gl.VERTEX_SHADER, stampVertSrc);
    const stampFs = compileShader(gl, gl.FRAGMENT_SHADER, stampFragSrc);

    this._stampProgram = gl.createProgram();
    gl.attachShader(this._stampProgram, stampVs);
    gl.attachShader(this._stampProgram, stampFs);
    gl.linkProgram(this._stampProgram);
    checkProgram(gl, 'stampProgram', this._stampProgram);

    this._stampVao = gl.createVertexArray();
    gl.bindVertexArray(this._stampVao);

    gl.enableVertexAttribArray(0);
    this._stampVertexOffsetVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._stampVertexOffsetVbo);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);
    const stampVertexOffsetData = new Float32Array([
      -0.5, -0.5,
      0.5, -0.5,
      0.5, 0.5,
      -0.5, 0.5,
    ]);
    gl.bufferData(this.gl.ARRAY_BUFFER, stampVertexOffsetData, gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(1);
    this._stampPosVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._stampPosVbo);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.enableVertexAttribArray(2);
    this._stampSizeVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._stampSizeVbo);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);

    gl.bindVertexArray(null);
  }

  _expandBuffers() {
    const {gl} = this;

    if (this._stampIndex < this._stampMaxCount) {
      return;
    }
    this._stampMaxCount = Math.max(16, Math.ceil(this._stampMaxCount * 2));
    console.log(`expanded buffers to ${this._stampMaxCount} items`);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._stampPosVbo)
    const stampPosData = new Float32Array(this._stampMaxCount * 2);
    if (this._stampPosData) {
      stampPosData.set(this._stampPosData);
    }
    this._stampPosData = stampPosData;
    gl.bufferData(gl.ARRAY_BUFFER, this._stampPosData, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._stampSizeVbo)
    const stampSizeData = new Float32Array(this._stampMaxCount);
    if (this._stampSizeData) {
      stampSizeData.set(this._stampSizeData);
    }
    this._stampSizeData = stampSizeData;
    gl.bufferData(gl.ARRAY_BUFFER, this._stampSizeData, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  
  _uploadBufferData() {
    const {gl} = this;

    this._expandBuffers();

    gl.bindBuffer(gl.ARRAY_BUFFER, this._stampPosVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._stampPosData);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._stampSizeVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._stampSizeData);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);    
  }

  _stamp({x, y, size, angle, ratio, color}) {
    this._expandBuffers();
    this._stampPosData[this._stampIndex * 2 + 0] = x;
    this._stampPosData[this._stampIndex * 2 + 1] = y;
    this._stampSizeData[this._stampIndex] = this._expandedTextureSize(size);
    ++this._stampIndex;

    /*
    c.save();
    c.translate(x, y);
    if (this.jitter) {
      const length = Math.random() * Math.random() * this.jitter;
      const angle = Math.random() * Math.PI * 2;
      c.translate(Math.cos(angle) * length, Math.sin(angle) * length);
    }
    const realSize = this._expandedTextureSize(size);
    c.rotate(angle);
    c.scale(realSize, realSize * ratio);
    c.rotate(Math.random() * Math.PI * 2);

    this._updateColorizedTexture(color);
    c.globalAlpha = this.opacity;
    c.drawImage(this._colorizedTexture, -0.5, -0.5, 1, 1);

    c.restore();
    */
  }

  drawStamps() {
    const {canvas, gl} = this; 

    this._uploadBufferData();

    gl.useProgram(this._stampProgram);
    gl.uniform2f(
      gl.getUniformLocation(this._stampProgram, 'resolution'), 
      canvas.width,
      canvas.height
    );
    gl.uniform4f(
      gl.getUniformLocation(this._stampProgram, 'brushColor'), 
      this.color[0] / 255,
      this.color[1] / 255,
      this.color[2] / 255,
      this.opacity,
    );
    gl.bindVertexArray(this._stampVao);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this._stampIndex);

    gl.bindVertexArray(null);
    gl.useProgram(null);

    this._stampIndex = 0;
  }

  drawCursor({context: c, x, y}) {
    c.save();

    const s = Math.max(4, this.size * 0.5 * this.getPressure(this.state.pressure));

    c.translate(x, y);
    c.scale(s, s);
    c.rotate(this.angle);

    c.strokeStyle = 'white';
    c.lineWidth = 3 / s;
    c.beginPath();
    c.ellipse(0, 0, 1, this.getRatio(this.state.tiltMagnitude), 0, 0, Math.PI * 2);
    c.stroke();
    
    c.strokeStyle = 'black';
    c.lineWidth = 1 / s;
    c.beginPath();
    c.ellipse(0, 0, 1, this.getRatio(this.state.tiltMagnitude), 0, 0, Math.PI * 2);
    c.stroke();
    
    c.restore();
  }

  moveTo({x, y, pressure, tiltAngle, tiltMagnitude}) {
    this.state = {x, y, pressure, tiltAngle, tiltMagnitude};
    this.lastStamp = {x, y};
    this.travel = 0;
  }

  strokeTo({context, ...state}) {
    const lastState = this.state;
    this.state = lerp(this.state, state, 1 - this.smoothing ** 0.3);
    const {x, y, pressure, tiltAngle, tiltMagnitude} = this.state;

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
      size: this.getPressure(lastState.pressure) * this.size,
      angle: lastState.tiltAngle,
      ratio: this.getRatio(lastState.tiltMagnitude),
    };
    const b = {
      x: a.x + sdx / sdist * this.stampSpacing * stampSteps,
      y: a.y + sdy / sdist * this.stampSpacing * stampSteps,
      size: this.getPressure(pressure) * this.size,
      angle: tiltAngle,
      ratio: this.getRatio(tiltMagnitude),
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
