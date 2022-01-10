const mod = (a, n) => a - Math.floor(a / n) * n;
const angleDiff = (a, b) => mod((a - b + Math.PI), Math.PI * 2) - Math.PI;

export const lerp = (a, b, f) => {
  const fClamped = Math.max(0, Math.min(1, f));
  return Object.fromEntries(
    Object.keys(a).map((k) => {
      let v;
      switch (k) {
        case 'angle': {
          const diff = angleDiff(b[k], a[k]);
          v = mod(a[k] + fClamped * diff, Math.PI * 2);
          break;
        }
        default: {
          const diff = b[k] - a[k];
          v = a[k] + fClamped * diff;
          break;
        }
      }
      return [k, v];
    })
  );
};
