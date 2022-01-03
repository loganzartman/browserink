const easeInOutSine = (f) => -(Math.cos(Math.PI * f) - 1) / 2;
const easeInOutCubic = (f) => f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
const easeInOutQuad = (f) => f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
const clamp = (f, a, b) => Math.max(a, Math.min(b, f));

export const drawGradient = ({context, size, hardness, dither=0}={}) => {
  size = Math.ceil(size);
  const softness = Math.max(1 - hardness, 0.01);
  const data = context.getImageData(0, 0, size, size);

  const half = Math.floor(size / 2);
  for (let x=0; x<size; ++x) {
    for (let y=0; y<size; ++y) {
      const fx = (x - half) / half;
      const fy = (y - half) / half;
      const f = (1 / softness) - (Math.sqrt(fx ** 2 + fy ** 2) / softness);
      const alpha = easeInOutQuad(clamp(f + Math.random() * dither * 0.5 - dither, 0, 1));

      const index = (y * size + x) * 4;
      data.data[index+0] = 255;
      data.data[index+1] = 255;
      data.data[index+2] = 255;
      data.data[index+3] = Math.round(255 * alpha);
    }
  }

  context.putImageData(data, 0, 0);
};