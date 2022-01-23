import { renderFloatDepth, checkFramebufferStatus } from "./gfx.mjs";

export class RenderTexture {
  constructor({gl}) {
    this.gl = gl;

    const depth = renderFloatDepth(gl);
    if (!depth) {
      throw new Error('Render to float texture not supported.');
    }
    // can't get rgba32f to work
    this.internalFormat = gl.RGBA16F;
  }

  resize(width, height) {
    const {gl} = this;
    this.width = width;
    this.height = height;

    if (this.texture) {
      gl.deleteTexture(this.texture);
    }
    this.texture = gl.createTexture();

    const data = new Float32Array(width*height*4);

    this.bindTexture();
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.internalFormat, width, height);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.unbindTexture();

    this.framebuffer = gl.createFramebuffer();
    this.bindFramebuffer();
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    checkFramebufferStatus(gl);
    this.unbindFramebuffer();
  }

  bindFramebuffer() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
  }

  unbindFramebuffer() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  bindTexture() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  }
  
  unbindTexture() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }
}
