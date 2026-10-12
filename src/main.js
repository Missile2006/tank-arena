import './style.css';

import { createInput } from './input.js';
import { Ship } from './sim/ship.js';
import { World } from './sim/world.js';
import { Asteroid } from './sim/asteroid.js';
import { Vector2 } from './sim/vector.js';
import { createLoop } from './loop.js';
import { drawHUD } from './render/hud.js';
import { setupCanvas } from './render/canvas.js';
import { applyHoming } from './sim/homing.js';
import { createHealthPickup } from './sim/pickup.js';

const canvas = document.getElementById('gameCanvas');

const WIDTH = 900;
const HEIGHT = 550;

const { ctx } = setupCanvas(canvas, WIDTH, HEIGHT);

// Створюємо систему керування
const input = createInput();

const world = new World();

let tank = world.spawn(new Ship(WIDTH / 2, HEIGHT / 2));

let respawnTimer = 0;

world.spawn(
  new Asteroid({
    position: new Vector2(200, 150),
    radius: 30,
  }),
);

world.spawn(
  new Asteroid({
    position: new Vector2(700, 150),
    radius: 35,
  }),
);

world.spawn(
  new Asteroid({
    position: new Vector2(200, 400),
    radius: 25,
  }),
);

world.spawn(
  new Asteroid({
    position: new Vector2(700, 400),
    radius: 30,
  }),
);
// Один астероїд отримує поведінку самонаведення
const homingAsteroid = [...world.ofKind('asteroid')][0];
// Аптечка для відновлення здоров'я

world.spawn(
  createHealthPickup(new Vector2(450, 350), 25),
);

let previousTank = {
  x: tank.x,
  y: tank.y,
  angle: tank.angle,
};

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

function drawBullets() {
  for (const bullet of world.ofKind('bullet')) {
    ctx.save();

    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(
      bullet.position.x,
      bullet.position.y,
      bullet.radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.restore();
  }
}

function drawAsteroids() {
  for (const asteroid of world.ofKind('asteroid')) {
    ctx.save();

    // Основне коло перешкоди
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(
      asteroid.position.x,
      asteroid.position.y,
      asteroid.radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();

    // Внутрішня частина
    ctx.fillStyle = '#475569';

    ctx.beginPath();
    ctx.arc(
      asteroid.position.x,
      asteroid.position.y,
      asteroid.radius * 0.65,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Відображення запасу міцності
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(
      String(asteroid.hp),
      asteroid.position.x,
      asteroid.position.y,
    );

    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of world.ofKind('particle')) {
    ctx.save();

    // Частинки поступово стають прозорими
    ctx.globalAlpha = particle.opacity;

    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.arc(
      particle.position.x,
      particle.position.y,
      particle.radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.restore();
  }
}

function drawPickups() {
  for (const pickup of world.ofKind('pickup')) {
    const { x, y } = pickup.position;

    ctx.save();

    // Зелене коло аптечки
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(x, y, pickup.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Білий медичний хрест
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, y - 9, 6, 18);
    ctx.fillRect(x - 9, y - 3, 18, 6);

    ctx.restore();
  }
}

function findNearestAsteroid(position) {
  let nearest = null;
  let minDistance = Infinity;

  for (const asteroid of world.ofKind('asteroid')) {
    const distance = position.distanceTo(asteroid.position);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = asteroid;
    }
  }

  return nearest;
}

// Оновлення фізики
function update(dt) {
  // Якщо танк знищений, чекаємо 2 секунди
  if (tank.dead) {
    respawnTimer += dt;

    // Світ продовжує оновлювати кулі та частинки
    world.step(dt);

    if (respawnTimer >= 2) {
      tank = world.spawn(new Ship(WIDTH / 2, HEIGHT / 2));

      previousTank = {
        x: tank.x,
        y: tank.y,
        angle: tank.angle,
      };

      respawnTimer = 0;
    }

    input.endStep();
    return;
  }

  const controls = {
    forward: input.isDown('w') || input.isDown('arrowup'),
    backward: input.isDown('s') || input.isDown('arrowdown'),
    left: input.isDown('a') || input.isDown('arrowleft'),
    right: input.isDown('d') || input.isDown('arrowright'),
  };

  previousTank = {
    x: tank.x,
    y: tank.y,
    angle: tank.angle,
  };

  tank.controls = controls;

  if (input.justPressed(' ')) {
    const bullet = tank.fire();

    // Позначаємо кулю як самонавідну
    bullet.homing = true;

    world.spawn(bullet);
  }


  // Самонаведення астероїда на танк
  if (homingAsteroid && !homingAsteroid.dead) {
    applyHoming(homingAsteroid, tank, dt, 2);
  }

  // Самонаведення куль на найближчий астероїд
  for (const bullet of world.ofKind('bullet')) {
    if (!bullet.homing) {
      continue;
    }

    const target = findNearestAsteroid(bullet.position);

    if (target) {
      applyHoming(bullet, target, dt, 5);
    }
  }

  world.step(dt);

  if (!tank.dead) {
    tank.wrap(WIDTH, HEIGHT);
  }

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
    x: (((previousTank.x + dx * alpha) % WIDTH) + WIDTH) % WIDTH,
    y: (((previousTank.y + dy * alpha) % HEIGHT) + HEIGHT) % HEIGHT,
    angle: interpolateAngle(previousTank.angle, tank.angle, alpha),
  };

  drawArena();
  drawAsteroids();
  drawPickups();

  // Знищений танк не малюємо
  if (!tank.dead) {
    drawTank(renderTank);
  }

  drawBullets();
  drawParticles();
  drawHUD(ctx, stats);

  // Ігровий рахунок та здоров'я
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'right';

  ctx.fillText(`Score: ${world.score}`, WIDTH - 20, 30);
  ctx.fillText(`HP: ${tank.hp}`, WIDTH - 20, 55);

  if (tank.dead) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#facc15';
    ctx.fillText('Відродження через 2 секунди...', WIDTH / 2, HEIGHT / 2);
  }

  ctx.restore();
}

const loop = createLoop({
  update,
  render,
});

loop.start();
