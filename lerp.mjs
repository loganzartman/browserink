export const lerp = (a, b, f) => {
  const fClamped = Math.max(0, Math.min(1, f));
  return Object.fromEntries(
    Object.keys(a).map((k) => [k, a[k] * (1 - fClamped) + b[k] * fClamped])
  );
};
