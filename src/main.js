import './style.css';

import { createInput } from './input.js';
import { integrate } from './sim/ship.js';
import { wrapPosition } from './sim/arena.js';
import { createLoop } from './loop.js';
import { drawHUD } from './render/hud.js';
import { setupCanvas } from './render/canvas.js';

const canvas = document.getElementById('gameCanvas');

const WIDTH = 900;
const HEIGHT = 550;

const { ctx } = setupCanvas(canvas, WIDTH, HEIGHT);

// Створюємо систему керування
const input = createInput();

// Початковий стан танка
let tank = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  angle: 0,
  vx: 0,
  vy: 0,
  width: 40,
  height: 50,
};

let previousTank = { ...tank };

// Малювання ігрового поля
function drawArena() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;

  for (let x = 0; x <= WIDTH; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  for (let y = 0; y <= HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

// Малювання танка
function drawTank(renderTank) {
  ctx.save();

  ctx.translate(renderTank.x, renderTank.y);
  ctx.rotate(renderTank.angle);

  // Гусениці
  ctx.fillStyle = '#111827';
  ctx.fillRect(-25, -28, 12, 56);
  ctx.fillRect(13, -28, 12, 56);

  // Корпус
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(-20, -25, 40, 50);

  // Верхня частина корпусу
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(-15, -20, 30, 40);

  // Гармата
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-5, -40, 10, 35);

  // Башта
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();

  // Центр башти
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Оновлення фізики
function update(dt) {
  const controls = {
    forward: input.isDown('w') || input.isDown('arrowup'),
    backward: input.isDown('s') || input.isDown('arrowdown'),
    left: input.isDown('a') || input.isDown('arrowleft'),
    right: input.isDown('d') || input.isDown('arrowright'),
  };

  previousTank = { ...tank };
  tank = integrate(tank, controls, dt);
  tank = wrapPosition(tank, WIDTH, HEIGHT);

  input.endStep();
}

function interpolateAngle(a, b, alpha) {
  const difference = Math.atan2(Math.sin(b - a), Math.cos(b - a));

  return a + difference * alpha;
}

function render(alpha, stats) {
  // Інтерполяція координат
  // Враховуємо перехід через краї арени
  const dx =
    ((tank.x - previousTank.x + WIDTH / 2 + WIDTH) % WIDTH) - WIDTH / 2;

  const dy =
    ((tank.y - previousTank.y + HEIGHT / 2 + HEIGHT) % HEIGHT) - HEIGHT / 2;

  const renderTank = {
    ...tank,
    x: (((previousTank.x + dx * alpha) % WIDTH) + WIDTH) % WIDTH,
    y: (((previousTank.y + dy * alpha) % HEIGHT) + HEIGHT) % HEIGHT,
    angle: interpolateAngle(previousTank.angle, tank.angle, alpha),
  };

  drawArena();
  drawTank(renderTank);
  drawHUD(ctx, stats);
}

const loop = createLoop({
  update,
  render,
});

loop.start();
