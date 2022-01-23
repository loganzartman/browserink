let _checkedRenderFloatDepth = false;
let _renderFloatDepth = 0;

export const renderFloatDepth = (gl) => {
  if (!_checkedRenderFloatDepth) {
    _checkedRenderFloatDepth = true;

    gl.getExtension('OES_texture_float');

    if (gl.getExtension("EXT_color_buffer_half_float")) {
      _renderFloatDepth = 16;
    }
    if (
      gl.getExtension("EXT_color_buffer_float") &&
      gl.getExtension("EXT_float_blend")
    ) {
      _renderFloatDepth = 32;
    }
    console.log(`Render float texture depth: ${_renderFloatDepth}`);
  }
  return _renderFloatDepth;
};

export const glsl = (strings, ...variables) => {
  const joined = strings
    .map((s, i) => s + (variables[i] ?? ''))
    .join('')
    .replace(/^[\n\r]+/, '');
  const indent = joined.match(/^(\s*)(\S|$)/)[1];
  return joined.replace(new RegExp(`^${indent}`, 'gm'), '');
};

export const compileShader = (gl, shaderType, shaderSrc) => {
  const shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSrc);
  gl.compileShader(shader);
 
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    throw new Error(`Failed to compile shader: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

export const checkProgram = (gl, name, program) => {
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Could not compile WebGL program '${name}'. \n\n${info}`);
  }
};

const decodeFramebufferStatus = (gl, status) => {
  switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:
      return {
        code: 'FRAMEBUFFER_COMPLETE', 
        description: 'The framebuffer is ready to display.',
      };
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      return {
        code: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT', 
        description: 'The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.',
      };
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      return {
        code: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT', 
        description: 'There is no attachment.',
      };
    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
      return {
        code: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS', 
        description: 'Height and width of the attachment are not the same.',
      };
    case gl.FRAMEBUFFER_UNSUPPORTED:
      return {
        code: 'FRAMEBUFFER_UNSUPPORTED', 
        description: 'The format of the attachment is not supported or if depth and stencil attachments are not the same renderbuffer.',
      };
    case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
      return {
        code: 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE', 
        description: 'The values of gl.RENDERBUFFER_SAMPLES are different among attached renderbuffers, or are non-zero if the attached images are a mix of renderbuffers and textures.',
      };
  }
  return {code: 'unknown', description: 'unrecognized status code'};
};

export const checkFramebufferStatus = (gl) => {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    const {code, description} = decodeFramebufferStatus(gl, status);
    throw new Error(`Framebuffer incomplete with status ${code}:\n\n${description}`);
  }
};
