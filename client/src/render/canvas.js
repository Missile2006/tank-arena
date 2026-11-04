export function setupCanvas(canvas, width, height) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();

  window.addEventListener('resize', resize);

  return {
    ctx,
    resize,
  };
}
