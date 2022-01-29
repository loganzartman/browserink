import { glsl, compileShader, checkProgram } from "./gfx.mjs";

const vertexData = new Float32Array([
  0, 0,
  1, 0,
  1, 1,
  0, 1,
]);

const textureVertSrc = glsl`
  #version 300 es

  in vec2 vertexPos;

  out vec2 uv;

  void main() {
    uv = vertexPos;
    gl_Position = vec4(vertexPos * 2.0 - 1.0, 0.0, 1.0);
  }
`;

const textureFragSrc = glsl`
  #version 300 es
  precision highp float;

  uniform sampler2D tex;
  uniform bool dither;

  in vec2 uv;

  out vec4 color;

  const uint k = 1103515245U;
  vec3 hash(uvec3 x) {
    x = ((x>>8U)^x.yzx)*k;
    x = ((x>>8U)^x.yzx)*k;
    x = ((x>>8U)^x.yzx)*k;
    
    return vec3(x)*(1.0/float(0xffffffffU));
  }

  vec3 ditherNoise() {
    vec3 random = hash(uvec3(gl_FragCoord.xy, 0)) + hash(uvec3(gl_FragCoord.xy, 1)) - 1.0;
    return random / 255.0;
  }

  void main() {
    if (dither) {
      vec4 pixel = texture(tex, uv);
      vec3 random = ditherNoise();
      color = pixel + random.xyzx;
    } else {
      color = texture(tex, uv);
    }
  }
`;

export class Quad {
  constructor({gl}) {
    this.gl = gl;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    gl.enableVertexAttribArray(0);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
  }
}

export class TextureQuad extends Quad {
  constructor({gl, dither=true}) {
    super({gl});
    this.dither = dither;
  }

  static program(gl) {
    if (!TextureQuad._program) {
      const vertShader = compileShader(gl, gl.VERTEX_SHADER, textureVertSrc);
      const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, textureFragSrc);
      const program = gl.createProgram();
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);
      checkProgram(gl, 'TextureQuad program', program);
      TextureQuad._program = program;
    }
    return TextureQuad._program;
  }

  draw(texture) {
    const {gl} = this;
    const program = TextureQuad.program(gl);

    gl.useProgram(program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(
      gl.getUniformLocation(program, 'tex'),
      0
    );
    gl.uniform1i(
      gl.getUniformLocation(program, 'dither'),
      this.dither ? 1 : 0,
    );
    
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }
}
