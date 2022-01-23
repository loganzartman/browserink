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

  in vec2 uv;

  out vec4 color;

  void main() {
    color = texture(tex, uv);
    // color = vec4(uv, 0.0, 1.0);
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
    
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }
}
