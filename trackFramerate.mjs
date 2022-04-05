/**
 * Track the animation framerate.
 * Computes an exponentially weighted moving average of the framerate.
 * 
 * @param {averageWeight} [0.1] - The weight to use when updating the average framerate 
 * @returns {frametime} The average frame time in milliseconds
 * @returns {fps} The average frame rate in frames per second
 */
export const trackFramerate = ({averageWeight=0.1} = {}) => {
  let lastFrametimeStamp = Date.now();
  let frametime = 1000 / 60;
  let fps = 60;
  const result = {frametime, fps};
  requestAnimationFrame(function updateMft() {
    requestAnimationFrame(updateMft);
    frametime = (1.0 - averageWeight) * frametime + averageWeight * (Date.now() - lastFrametimeStamp);
    fps = 1000 / frametime;
    lastFrametimeStamp = Date.now();
    result.frametime = frametime;
    result.fps = fps;
  });
  return result;
}