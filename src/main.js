
import './style.css';

//import { runEventLoopExperiments } from './experiments/event-loop.js';
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
import { fetchJson, loadAll } from './assets/loader.js';
import { drawLoading } from './render/loading.js';
import { emitGameEvent } from './events/bus.js';
import { createAudioSystem } from './audio/audio.js';
import { Lobby } from './lobby/lobby.js';
import { createLobbyUI } from './lobby/lobby-ui.js';

// Налаштування ігрового поля
const canvas = document.getElementById('gameCanvas');

const WIDTH = 900;
const HEIGHT = 550;

const { ctx } = setupCanvas(canvas, WIDTH, HEIGHT);

// Завантажені ресурси та аудіосистема
let gameAssets = new Map();
let audioContext = null;
let audioSystem = null;

// Лобі
const lobby = new Lobby();
const lobbyUI = createLobbyUI(lobby);

let selectedRoom = null;
let playerName = '';

// Малювання спрайтів
function drawSprite(id, x, y, width, height, frame = 0, angle = 0) {
  const image = gameAssets.get(id);

  if (!image) {
    return false;
  }

  const frameSize = 64;
  const columns = 4;

  const sx = (frame % columns) * frameSize;
  const sy = Math.floor(frame / columns) * frameSize;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.drawImage(
    image,
    sx,
    sy,
    frameSize,
    frameSize,
    -width / 2,
    -height / 2,
    width,
    height,
  );

  ctx.restore();

  return true;
}

// Створення ігрового світу
const input = createInput();
const world = new World();

let tank = world.spawn(new Ship(WIDTH / 2, HEIGHT / 2));
let respawnTimer = 0;

// Астероїди створюватимуться після вибору кімнати
let homingAsteroid = null;

// Аптечка для відновлення здоров'я
world.spawn(
  createHealthPickup(new Vector2(450, 350), 25),
);

// Попередня позиція танка для інтерполяції
let previousTank = {
  x: tank.x,
  y: tank.y,
  angle: tank.angle,
};

// Створення астероїдів для вибраної кімнати
function spawnRoomAsteroids(count) {
  // Видаляємо астероїди попередньої кімнати
  for (const asteroid of [...world.ofKind('asteroid')]) {
    world.despawn(asteroid);
  }

  world.sweep();

  // Розміщуємо астероїди навколо центру арени
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;

    const x = WIDTH / 2 + Math.cos(angle) * 280;
    const y = HEIGHT / 2 + Math.sin(angle) * 180;

    world.spawn(
      new Asteroid({
        position: new Vector2(x, y),
        radius: 25 + Math.random() * 10,
      }),
    );
  }

  // Перший астероїд буде переслідувати танк
  homingAsteroid = [...world.ofKind('asteroid')][0] ?? null;

  console.log(`Spawned ${count} asteroids`);
}

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
  // Під час невразливості танк блимає
  if (tank.invulnerable) {
    const blink = Math.floor(tank.animationTime * 10) % 2;

    if (blink === 0) {
      return;
    }
  }

  drawSprite(
    'tank',
    renderTank.x,
    renderTank.y,
    64,
    64,
    0,
    renderTank.angle,
  );
}

// Малювання куль
function drawBullets() {
  for (const bullet of world.ofKind('bullet')) {
    drawSprite(
      'bullet',
      bullet.position.x,
      bullet.position.y,
      24,
      24,
      0,
      0,
    );
  }
}

// Малювання астероїдів
function drawAsteroids() {
  for (const asteroid of world.ofKind('asteroid')) {
    drawSprite(
      'asteroid',
      asteroid.position.x,
      asteroid.position.y,
      asteroid.radius * 2,
      asteroid.radius * 2,
      0,
      0,
    );

    // Відображення здоров'я астероїда
    ctx.save();

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

// Малювання частинок вибуху
function drawParticles() {
  for (const particle of world.ofKind('particle')) {
    ctx.save();

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

// Малювання аптечок
function drawPickups() {
  for (const pickup of world.ofKind('pickup')) {
    const { x, y } = pickup.position;

    ctx.save();

    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(x, y, pickup.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, y - 9, 6, 18);
    ctx.fillRect(x - 9, y - 3, 18, 6);

    ctx.restore();
  }
}

// Пошук найближчого астероїда
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

// Оновлення ігрової фізики
function update(dt) {
  // Якщо танк знищений, чекаємо на відродження
  if (tank.dead) {
    respawnTimer += dt;

    world.step(dt);

    if (respawnTimer >= 2) {
      tank = world.spawn(
        new Ship(WIDTH / 2, HEIGHT / 2),
      );

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

  // Керування танком
  const controls = {
    forward:
      input.isDown('w') ||
      input.isDown('arrowup'),

    backward:
      input.isDown('s') ||
      input.isDown('arrowdown'),

    left:
      input.isDown('a') ||
      input.isDown('arrowleft'),

    right:
      input.isDown('d') ||
      input.isDown('arrowright'),
  };

  previousTank = {
    x: tank.x,
    y: tank.y,
    angle: tank.angle,
  };

  tank.controls = controls;

  // Постріл
  if (input.justPressed(' ')) {
    const bullet = tank.fire();

    bullet.homing = true;

    world.spawn(bullet);

    // Звукова подія пострілу
    emitGameEvent('fired');
  }


  // Усі астероїди переслідують танк
  for (const asteroid of world.ofKind('asteroid')) {
    applyHoming(asteroid, tank, dt, 5);

    // Обмежуємо максимальну швидкість астероїда
    const velocity = asteroid.velocity;
    const currentSpeed = velocity.length();

    if (currentSpeed > asteroid.speed) {
      asteroid.velocity = velocity.scale(
        asteroid.speed / currentSpeed,
      );
    }
  }

  // Самонаведення куль на найближчий астероїд
  for (const bullet of world.ofKind('bullet')) {
    if (!bullet.homing) {
      continue;
    }

    const target = findNearestAsteroid(
      bullet.position,
    );

    if (target) {
      applyHoming(bullet, target, dt, 5);
    }
  }

  // Оновлення світу та зіткнень
  world.step(dt);

  // Перехід танка через межі арени
  if (!tank.dead) {
    tank.wrap(WIDTH, HEIGHT);
  }

  input.endStep();
}

// Інтерполяція кута
function interpolateAngle(a, b, alpha) {
  const difference = Math.atan2(
    Math.sin(b - a),
    Math.cos(b - a),
  );

  return a + difference * alpha;
}

// Малювання кадру гри
function render(alpha, stats) {
  const dx =
    ((tank.x - previousTank.x + WIDTH / 2 + WIDTH) %
      WIDTH) -
    WIDTH / 2;

  const dy =
    ((tank.y - previousTank.y + HEIGHT / 2 + HEIGHT) %
      HEIGHT) -
    HEIGHT / 2;

  const renderTank = {
    x:
      (((previousTank.x + dx * alpha) % WIDTH) +
        WIDTH) %
      WIDTH,

    y:
      (((previousTank.y + dy * alpha) % HEIGHT) +
        HEIGHT) %
      HEIGHT,

    angle: interpolateAngle(
      previousTank.angle,
      tank.angle,
      alpha,
    ),
  };

  drawArena();
  drawAsteroids();
  drawPickups();

  if (!tank.dead) {
    drawTank(renderTank);
  }

  drawBullets();
  drawParticles();
  drawHUD(ctx, stats);

  // Відображення рахунку та здоров'я
  ctx.save();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'right';

  ctx.fillText(
    `Score: ${world.score}`,
    WIDTH - 20,
    30,
  );

  ctx.fillText(
    `HP: ${tank.hp}`,
    WIDTH - 20,
    55,
  );

  // Відображення гравця та кімнати
  if (selectedRoom) {
    ctx.textAlign = 'left';
    ctx.font = '14px Arial';

    ctx.fillText(
      `Player: ${playerName}`,
      20,
      HEIGHT - 40,
    );

    ctx.fillText(
      `Room: ${selectedRoom.name}`,
      20,
      HEIGHT - 20,
    );
  }

  // Повідомлення про відродження
  if (tank.dead) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#facc15';

    ctx.fillText(
      'Відродження через 2 секунди...',
      WIDTH / 2,
      HEIGHT / 2,
    );
  }

  ctx.restore();
}

// Ігровий цикл
const loop = createLoop({
  update,
  render,
});

// Вхід гравця до вибраної кімнати
lobby.addEventListener('joined', (event) => {
  playerName = event.detail.playerName;
  selectedRoom = event.detail.room;

  console.log('Player:', playerName);
  console.log('Selected room:', selectedRoom.name);
  console.log('Arena config:', selectedRoom.config);

  // Генеруємо астероїди для вибраної кімнати
  spawnRoomAsteroids(
    selectedRoom.config.asteroidCount,
  );

  // Приховуємо лобі
  lobbyUI.hide();

  // Join є жестом користувача:
  // активуємо AudioContext безпосередньо після натискання
  audioSystem.resume().catch((error) => {
    console.warn('Audio resume failed:', error);
  });

  // Запускаємо гру тільки після Join
  loop.start();
});

// Контролер завантаження
let loadingController = null;

// Завантаження ресурсів гри
async function startGame() {
  loadingController?.abort();

  loadingController = new AbortController();

  const signal = loadingController.signal;

  drawLoading(
    ctx,
    canvas,
    0,
    1,
    'Loading manifest...',
  );

  try {
    // Завантажуємо manifest.json
    const manifest = await fetchJson(
      '/manifest.json',
      signal,
    );

    audioContext ??= new AudioContext();

    // Паралельно завантажуємо ресурси
    gameAssets = await loadAll(
      manifest,
      signal,
      audioContext,
      (completed, total) => {
        drawLoading(
          ctx,
          canvas,
          completed,
          total,
        );
      },
    );

    console.log(
      'All assets loaded:',
      [...gameAssets.keys()],
    );

    // Створюємо звукову систему
    audioSystem = createAudioSystem(
      audioContext,
      gameAssets,
    );

    // Показуємо лобі після завантаження
    lobbyUI.show();
  } catch (error) {
    if (signal.aborted) {
      return;
    }

    // При помилці приховуємо лобі
    lobbyUI.hide();

    console.error(
      'Asset loading failed:',
      error,
    );

    drawLoading(
      ctx,
      canvas,
      0,
      1,
      'Loading failed. Retry?',
    );

    showRetryButton();
  }
}

// Кнопка повторного завантаження
function showRetryButton() {
  let button = document.getElementById(
    'retryLoading',
  );

  if (!button) {
    button = document.createElement('button');

    button.id = 'retryLoading';
    button.textContent = 'Retry Loading';

    button.style.position = 'fixed';
    button.style.top = '55%';
    button.style.left = '50%';
    button.style.transform = 'translate(-50%, -50%)';

    button.style.padding = '12px 24px';
    button.style.fontSize = '18px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '1000';

    document.body.appendChild(button);
  }

  button.style.display = 'block';

  button.onclick = () => {
    button.style.display = 'none';

    startGame();
  };
}

// Початкове завантаження ресурсів
// Гра НЕ запускається до натискання JOIN GAME
startGame();
