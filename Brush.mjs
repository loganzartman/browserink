import { lerp } from "./lerp.mjs";
import { defaultOptions as options } from "./options.mjs";
import { glsl, compileShader, checkProgram } from "./gfx.mjs";

const stampVertSrc = glsl`
  #version 300 es
  uniform vec2 resolution;

  in vec2 vertexOffset;
  in vec2 pos;
  in float size;

  flat out int instanceId;
  out vec2 offset;

  void main() {
    vec2 vertexPos = pos + vertexOffset * size;

    instanceId = gl_InstanceID;
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

  uniform int monotonic;
  uniform float brushHardness;
  uniform float brushNoise;
  uniform vec4 brushColor;
  uniform vec4 brushCurve;

  flat in int instanceId;
  in vec2 offset;

  out vec4 color;

  float easeCubicBezier(float f, vec4 control) {
    vec2 c1 = control.xy;
    vec2 c2 = vec2(1, 1) - control.wz;
    vec2 center = mix(c1, c2, f);
    return mix(
      mix(
        mix(vec2(0, 0), c1, f),
        center,
        f
      ),
      mix(
        center,
        mix(c2, vec2(1, 1), f),
        f
      ),
      f
    ).y;
  }

  const uint k = 1103515245U;
  vec3 hash(uvec3 x) {
    x = ((x>>8U)^x.yzx)*k;
    x = ((x>>8U)^x.yzx)*k;
    x = ((x>>8U)^x.yzx)*k;
    
    return vec3(x)*(1.0/float(0xffffffffU));
  }

  void main() {
    float softness = clamp(1.0 - brushHardness, 0.001, 1.0);
    float random = hash(uvec3(gl_FragCoord.xy, monotonic + instanceId)).x;

    float f = (1.0 / softness) - (length(offset) / softness);
    f = f * (1.0 - brushNoise) + f * random * brushNoise;
    f = clamp(f, 0.0, 1.0);
    f = easeCubicBezier(f, brushCurve);
    f = clamp(f, 0.0, 1.0);

    color = vec4(1.0, 1.0, 1.0, f) * brushColor;
  }
`;

export class Brush {
  constructor({canvas, gl, imageTexture}) {
    this.canvas = canvas;
    this.gl = gl;
    this.imageTexture = imageTexture;
    this.travel = 0; 
    this.state = {
      x: 0,
      y: 0,
      pressure: 0.5,
      tiltAngle: 0,
      tiltMagnitude: 0,
    };

    this.color = options.color;
    this.curve = options.curve;
    this.size = options.size;
    this.hardness = options.hardness;
    this.noise = options.noise;
    this.opacity = options.opacity;
    this.density = options.density;
    this.jitter = options.jitter;

    this.smoothing = options.smoothing;
    this.pressureFactor = options.pressureFactor;
    this.tiltFactor = options.tiltFactor;

    this._monotonic = 0;

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
    gl.bufferData(gl.ARRAY_BUFFER, stampVertexOffsetData, gl.STATIC_DRAW);

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
  }

  drawStamps() {
    const {imageTexture, gl} = this; 

    this._uploadBufferData();

    gl.useProgram(this._stampProgram);
    gl.uniform1i(
      gl.getUniformLocation(this._stampProgram, 'monotonic'), 
      ++this._monotonic,
    );
    gl.uniform2f(
      gl.getUniformLocation(this._stampProgram, 'resolution'), 
      imageTexture.width,
      imageTexture.height
    );
    gl.uniform1f(
      gl.getUniformLocation(this._stampProgram, 'brushHardness'), 
      this.hardness,
    );
    gl.uniform1f(
      gl.getUniformLocation(this._stampProgram, 'brushNoise'), 
      this.noise,
    );
    gl.uniform4f(
      gl.getUniformLocation(this._stampProgram, 'brushColor'), 
      this.color.r / 255,
      this.color.g / 255,
      this.color.b / 255,
      this.color.a,
    );
    gl.uniform4fv(
      gl.getUniformLocation(this._stampProgram, 'brushCurve'), 
      this.curve,
    );
    gl.bindVertexArray(this._stampVao);

    imageTexture.bindFramebuffer();
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.ONE);

    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this._stampIndex);

    gl.bindVertexArray(null);
    gl.useProgram(null);
    imageTexture.unbindFramebuffer();

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
