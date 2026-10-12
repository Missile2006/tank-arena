export function drawHUD(ctx, stats) {
  ctx.save();

  // Фон інформаційної панелі
  ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
  ctx.fillRect(15, 15, 200, 105);

  // Рамка
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.strokeRect(15, 15, 200, 105);

  // Заголовок
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('TANK ARENA HUD', 27, 38);

  // Показники
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Arial';

  ctx.fillText(`FPS: ${stats.fps.toFixed(1)}`, 27, 62);

  ctx.fillText(`Steps/s: ${stats.stepsPerSecond.toFixed(1)}`, 27, 84);

  ctx.fillText(`Frame time: ${stats.frameTime.toFixed(2)} ms`, 27, 106);

  ctx.restore();
}
