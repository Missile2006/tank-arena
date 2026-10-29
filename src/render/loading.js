export function drawLoading(ctx, canvas, completed, total, message = 'Loading assets...') {
  const width = canvas.width;
  const height = canvas.height;

  const progress = total > 0 ? completed / total : 0;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('TANK ARENA', width / 2, height / 2 - 90);

  ctx.font = '18px Arial';
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText(message, width / 2, height / 2 - 35);

  const barWidth = 420;
  const barHeight = 28;
  const barX = (width - barWidth) / 2;
  const barY = height / 2;

  ctx.fillStyle = '#293548';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(barX, barY, barWidth * progress, barHeight);

  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.font = '16px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.round(progress * 100)}%`, width / 2, barY + 55);

  ctx.font = '14px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${completed} / ${total} assets loaded`, width / 2, barY + 80);
}