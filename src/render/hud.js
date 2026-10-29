
export function drawHUD(ctx, stats) {
  ctx.save();

  // Розміри та положення панелі
  const x = 20;
  const y = 20;
  const width = 230;
  const height = 145;
  const padding = 18;

  // Скидаємо налаштування тексту,
  // щоб HUD не залежав від інших елементів
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Темний напівпрозорий фон
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 12);
  ctx.fill();

  // Зелена рамка
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 12);
  ctx.stroke();

  // Заголовок
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 17px Arial';

  ctx.fillText(
    'ARENA HUD',
    x + padding,
    y + 27,
  );

  // Розділювальна лінія
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(x + padding, y + 48);
  ctx.lineTo(x + width - padding, y + 48);
  ctx.stroke();

  // Підписи показників
  ctx.font = '14px Arial';
  ctx.fillStyle = '#cbd5e1';

  ctx.fillText('FPS', x + padding, y + 70);
  ctx.fillText('UPS', x + padding, y + 95);
  ctx.fillText('Frame time', x + padding, y + 120);

  // Значення показників
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'right';

  ctx.fillText(
    stats.fps.toFixed(1),
    x + width - padding,
    y + 70,
  );

  ctx.fillText(
    stats.stepsPerSecond.toFixed(1),
    x + width - padding,
    y + 95,
  );

  ctx.fillText(
    `${stats.frameTime.toFixed(2)} ms`,
    x + width - padding,
    y + 120,
  );

  ctx.restore();
}
