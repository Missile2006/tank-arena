export interface CanvasSetup {
  ctx: CanvasRenderingContext2D;
  resize(): void;
}

export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasSetup {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D context unavailable');
  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (!ctx) {
      throw new Error('Не вдалося отримати Canvas 2D context');
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  return { ctx, resize };
}
