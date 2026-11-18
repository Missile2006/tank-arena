import './style.css';

import { createChatUI } from './net/chat.js';
import { GameSocket } from './net/socket.js';
import { createNetgraph } from './net/netgraph.js';
//import { runEventLoopExperiments } from './experiments/event-loop.js';
import { createInput } from './input.ts';
import { Ship } from './sim/ship.js';
import { World } from './sim/world.js';
import { Asteroid } from './sim/asteroid.js';
import { Vector2 } from './sim/vector.ts';
import { createLoop } from './loop.ts';
import { drawHUD } from './render/hud.js';
import { setupCanvas } from './render/canvas.ts';
import { applyHoming } from './sim/homing.js';
import { createHealthPickup } from './sim/pickup.js';
import { fetchJson, loadAll } from './assets/loader.js';
import { drawLoading } from './render/loading.js';
import { emitGameEvent, gameEvents } from './events/bus.ts';
import { createAudioSystem } from './audio/audio.js';
import { Lobby } from './lobby/lobby.js';
import { createLobbyUI } from './lobby/lobby-ui.js';
import {
  createShip,
  integrate as integrateNetworkShip,
  FIXED_DT,
} from 'tank-arena-shared/simulation';

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

// WebSocket-з'єднання із сервером
const gameSocket = new GameSocket('/ws');
const netgraph = createNetgraph();
const chatUI = createChatUI(gameSocket);

let selectedRoom = null;
let playerName = '';
let playerId = null;

// Лабораторна №5: нумерація команд керування
let inputSequence = 0;
let inputAccumulator = 0;

const NETWORK_INPUT_DT = 1 / 30;

// Останній стан кораблів, отриманий від сервера
let serverPlayers = [];
let serverBullets = [];
let serverAsteroids = [];
let asteroidExplosions = [];
// Останній підтверджений сервером стан здоров’я кожного танка
const previousPlayerStates = new Map();

let predictedBullets = [];
let lastPredictedFireTime = -Infinity;

const BULLET_SPEED = 250;
const BULLET_LIFETIME = 1.5;
const BULLET_FIRE_INTERVAL_MS = 200;
const snapshotHistory = [];
const INTERPOLATION_DELAY_MS = 100;
const MAX_SNAPSHOT_HISTORY = 30;
// Client-side prediction
let predictedShip = null;
let latestServerTick = -1;
let pendingInputs = [];
let correctionX = 0;
let correctionY = 0;

const CORRECTION_SPEED = 12;
// Лабораторна №5: штучна затримка серверних даних
const NETWORK_DELAY_MS = 0;

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

function getInterpolatedPlayers() {
  if (snapshotHistory.length < 2) {
    return serverPlayers;
  }

  const renderTime =
    performance.now() - INTERPOLATION_DELAY_MS;

  let older = snapshotHistory[0];
  let newer = snapshotHistory[snapshotHistory.length - 1];

  for (let i = 0; i < snapshotHistory.length - 1; i++) {
    const current = snapshotHistory[i];
    const next = snapshotHistory[i + 1];

    if (
      current.time <= renderTime &&
      next.time >= renderTime
    ) {
      older = current;
      newer = next;
      break;
    }
  }

  const duration = newer.time - older.time;

  const alpha =
    duration > 0
      ? Math.max(
          0,
          Math.min(1, (renderTime - older.time) / duration),
        )
      : 1;

  return newer.players.map((player) => {
    const previous = older.players.find(
      (item) => item.id === player.id,
    );

    if (!previous) {
      return player;
    }

    return {
      ...player,
      x: previous.x + (player.x - previous.x) * alpha,
      y: previous.y + (player.y - previous.y) * alpha,
      angle:
        previous.angle +
        (player.angle - previous.angle) * alpha,
    };
  });
}

// Шкала HP прив'язана до позиції, на якій танк намальований.
function drawHealthBar(x, y, hp = 100) {
  const health = Math.max(0, Math.min(100, Number(hp) || 0));
  const width = 52;
  const height = 7;
  const barX = x - width / 2;
  const barY = y - 58;

  ctx.save();
  ctx.fillStyle = '#202938';
  ctx.fillRect(barX, barY, width, height);
  ctx.fillStyle = health > 60 ? '#22c55e' : health > 30 ? '#eab308' : '#ef4444';
  ctx.fillRect(barX, barY, width * (health / 100), height);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, width, height);
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${health} HP`, x, barY - 5);
  ctx.restore();
}

function drawServerPlayers() {
  const interpolatedPlayers = getInterpolatedPlayers();

  for (const player of interpolatedPlayers) {
    const isLocalPlayer = player.id === playerId;
    const authoritativePlayer = serverPlayers.find((item) => item.id === player.id) ?? player;

    // Знищений танк не повинен залишатися на арені.
    if (authoritativePlayer.destroyed) {
      continue;
    }

    const renderPlayer = isLocalPlayer && predictedShip ? predictedShip : player;
    const renderX = renderPlayer.x + (isLocalPlayer ? correctionX : 0);
    const renderY = renderPlayer.y + (isLocalPlayer ? correctionY : 0);

    drawSprite('tank', renderX, renderY, 64, 64, 0, renderPlayer.angle);
    drawHealthBar(renderX, renderY, authoritativePlayer.hp ?? 100);

    ctx.save();
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = isLocalPlayer ? '#22c55e' : '#facc15';
    ctx.fillText(isLocalPlayer ? 'YOU' : 'PLAYER', renderX, renderY - 72);
    ctx.restore();
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

function drawServerBullets() {
  for (const bullet of serverBullets) {
    const drawn = drawSprite(
      'bullet',
      bullet.x,
      bullet.y,
      24,
      24,
      0,
      0,
    );

    // Якщо спрайт кулі не завантажився,
    // малюємо невелике помаранчеве коло
    if (!drawn) {
      ctx.save();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
function drawPredictedBullets() {
  for (const bullet of predictedBullets) {
    const drawn = drawSprite(
      'bullet',
      bullet.x,
      bullet.y,
      24,
      24,
      0,
      0,
    );

    if (!drawn) {
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
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
function createAsteroidExplosion(x, y) {
  const particles = [];

  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const speed = 40 + Math.random() * 100;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6,
      maxLife: 0.6,
      radius: 2 + Math.random() * 4,
    });
  }

  asteroidExplosions.push(...particles);

  gameEvents.dispatchEvent(new Event('exploded'));
}

function updateAsteroidExplosions(dt) {
  for (const particle of asteroidExplosions) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }

  asteroidExplosions = asteroidExplosions.filter(
    (particle) => particle.life > 0,
  );
}

function drawAsteroidExplosions() {
  ctx.save();

  for (const particle of asteroidExplosions) {
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.fillStyle = '#f97316';

    ctx.beginPath();
    ctx.arc(
      particle.x,
      particle.y,
      particle.radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

// Малювання астероїдів
function drawAsteroids() {
  for (const asteroid of serverAsteroids) {
    drawSprite(
      'asteroid',
      asteroid.x,
      asteroid.y,
      asteroid.radius * 2,
      asteroid.radius * 2,
      0,
      0,
    );

    // Display asteroid health
    ctx.save();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(
      String(asteroid.hp),
      asteroid.x,
      asteroid.y,
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


function reconcileLocalShip(serverShip) {
  if (!serverShip) {
    return;
  }

  const oldX = predictedShip?.x ?? serverShip.x;
  const oldY = predictedShip?.y ?? serverShip.y;

  const acknowledgedSeq =
    serverShip.lastProcessedSeq ?? 0;

  pendingInputs = pendingInputs.filter(
    (command) => command.seq > acknowledgedSeq,
  );

  predictedShip = {
    id: serverShip.id,
    x: serverShip.x,
    y: serverShip.y,
    vx: serverShip.vx,
    vy: serverShip.vy,
    angle: serverShip.angle,
  };

  for (const command of pendingInputs) {
    integrateNetworkShip(
      predictedShip,
      command,
      FIXED_DT,
    );
  }

  // Зберігаємо різницю між старим і новим положенням
  correctionX += oldX - predictedShip.x;
  correctionY += oldY - predictedShip.y;
}
function predictBullet() {
  if (!predictedShip || serverPlayers.find((ship) => ship.id === playerId)?.destroyed) return;

  const now = performance.now();

  if (now - lastPredictedFireTime < BULLET_FIRE_INTERVAL_MS) {
    return;
  }

  lastPredictedFireTime = now;
  gameEvents.dispatchEvent(new Event('fired'));

  const directionX = Math.sin(predictedShip.angle);
  const directionY = -Math.cos(predictedShip.angle);

  predictedBullets.push({
    x: predictedShip.x + directionX * 40,
    y: predictedShip.y + directionY * 40,

    vx: predictedShip.vx + directionX * BULLET_SPEED,
    vy: predictedShip.vy + directionY * BULLET_SPEED,

    ttl: BULLET_LIFETIME,
    createdAt: now,
  });
}

function sendNetworkInput(dt) {
  if (!playerId || !gameSocket.isJoined) {
    return;
  }

  inputAccumulator += dt;

  // Одна команда на один крок симуляції (30 Гц)
  while (inputAccumulator >= NETWORK_INPUT_DT) {
    inputAccumulator -= NETWORK_INPUT_DT;

    inputSequence += 1;

    const command = {
      type: 'input',
      seq: inputSequence,

      thrust:
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

      fire: input.isDown(' '),
    };

    // Надсилаємо команду серверу
    gameSocket.send(command);

    if (command.fire && predictedShip) {
      predictBullet();
    }

    if (predictedShip && !serverPlayers.find((ship) => ship.id === playerId)?.destroyed) {
      // Зберігаємо команду до підтвердження
      pendingInputs.push(command);

      // Передбачаємо рух тими самими формулами,
      // які використовує сервер
      integrateNetworkShip(
        predictedShip,
        command,
        FIXED_DT,
      );
    }
  }
}

function updatePredictedBullets(dt) {
  for (const bullet of predictedBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.ttl -= dt;
  }

  predictedBullets = predictedBullets.filter(
    (bullet) => bullet.ttl > 0,
  );
}

// Оновлення ігрової фізики
function update(dt) {
  sendNetworkInput(dt);
  updateAsteroidExplosions(dt);

  if (playerId) {
    updatePredictedBullets(dt);

    const smoothing = Math.exp(-CORRECTION_SPEED * dt);

    correctionX *= smoothing;
    correctionY *= smoothing;

    if (Math.abs(correctionX) < 0.01) {
      correctionX = 0;
    }

    if (Math.abs(correctionY) < 0.01) {
      correctionY = 0;
    }

    input.endStep();
    return;
  }

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

  tank.controls = playerId
  ? {
      forward: false,
      backward: false,
      left: false,
      right: false,
    }
  : controls;

  // Локальна стрільба працює лише без серверного підключення.
  // У мережевому режимі команда fire надсилається серверу.
  if (!playerId && input.justPressed(' ')) {
    const bullet = tank.fire();

    bullet.homing = true;

    world.spawn(bullet);

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
  drawAsteroidExplosions();
  drawPickups();

  if (playerId && serverPlayers.length > 0) {
    drawServerPlayers();
  } else if (!tank.dead) {
    drawTank(renderTank);
  }

  if (playerId) {
    drawServerBullets();
    drawPredictedBullets();
  } else {
    drawBullets();
  }

  drawParticles();
  drawHUD(ctx, stats);

  // Відображення рахунку та здоров'я
  ctx.save();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'right';

  ctx.fillText(
    playerId ? 'Score: --' : `Score: ${world.score}`,
    WIDTH - 20,
    30,
  );

  const localServerPlayer = serverPlayers.find((ship) => ship.id === playerId);
  const displayedHp = playerId ? (localServerPlayer?.hp ?? '--') : tank.hp;
  ctx.fillText(`HP: ${displayedHp}`, WIDTH - 20, 55);

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
  if ((playerId && localServerPlayer?.destroyed) || (!playerId && tank.dead)) {
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

  gameSocket.updatePing();

  const networkStats = gameSocket.getNetworkStats();

  netgraph.update({
    protocol:
      new URLSearchParams(window.location.search).get('protocol') ===
      'binary'
        ? 'Binary'
        : 'JSON',
    rtt: networkStats.rtt,
    snapshotAge: networkStats.snapshotAge,
    bytesPerSecond: networkStats.bytesPerSecond,
    inputQueue: pendingInputs.length,
    correction: Math.hypot(correctionX, correctionY),
    lag: networkStats.lag,
    jitter: networkStats.jitter,
    loss: networkStats.loss,
  });
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

  // Підключаємося до WebSocket-сервера
  gameSocket.connect(selectedRoom.id, playerName);

  // Поки сервер не підтвердив вхід,
  // ігровий цикл не запускаємо
  console.log('Waiting for server confirmation...');
});

// Сервер підтвердив вхід до кімнати
gameSocket.addEventListener('message', (event) => {
  const message = event.detail;

if (message.type === 'snapshot') {
  const snapshot = message;

  setTimeout(() => {
    // Не застосовуємо старі знімки після виходу з кімнати
    if (!playerId) {
      return;
    }

    if (snapshot.tick <= latestServerTick) {
      return;
    }

    serverPlayers = snapshot.players;
    serverBullets = snapshot.bullets ?? [];
    const nextAsteroids = snapshot.asteroids ?? [];

    for (const oldAsteroid of serverAsteroids) {
      const stillExists = nextAsteroids.some(
        (asteroid) => asteroid.id === oldAsteroid.id,
      );

      if (!stillExists) {
        createAsteroidExplosion(
          oldAsteroid.x,
          oldAsteroid.y,
        );
      }
    }

    serverAsteroids = nextAsteroids;

    // Звук тільки при фактичному зменшенні HP, а не кожного кадру.
    for (const ship of serverPlayers) {
      const previous = previousPlayerStates.get(ship.id);
      if (previous && ship.hp < previous.hp) {
        emitGameEvent(ship.destroyed && !previous.destroyed ? 'exploded' : 'hit');
      }
      if (ship.id === playerId && previous?.destroyed && !ship.destroyed) {
        // Після відродження не відтворюємо старі непідтверджені команди.
        pendingInputs = [];
        correctionX = 0;
        correctionY = 0;
        predictedBullets = [];
      }
      previousPlayerStates.set(ship.id, { hp: ship.hp, destroyed: ship.destroyed });
    }
    snapshotHistory.push({
      time: performance.now(),
      players: snapshot.players.map((player) => ({ ...player })),
    });

    if (snapshotHistory.length > MAX_SNAPSHOT_HISTORY) {
      snapshotHistory.shift();
    }

    latestServerTick = snapshot.tick;

    const localServerShip = serverPlayers.find(
      (ship) => ship.id === playerId,
    );

    if (localServerShip) {
      if (localServerShip.destroyed) {
        predictedShip = { ...localServerShip };
        pendingInputs = [];
        correctionX = 0;
        correctionY = 0;
        predictedBullets = [];
      } else {
        reconcileLocalShip(localServerShip);
      }
    }

    if (snapshot.tick % 60 === 0) {
      console.log(
        'DELAYED SNAPSHOT:',
        snapshot.tick,
        'Players:',
        serverPlayers.length,
        'Delay:',
        NETWORK_DELAY_MS,
        'ms',
      );
    }
  }, NETWORK_DELAY_MS);

  return;
}

  if (message.type === 'joined') {
    playerId = message.playerId;
    selectedRoom = message.room;
    inputSequence = 0;
    inputAccumulator = 0;
    predictedShip = null;
    latestServerTick = -1;
    pendingInputs = [];
    correctionX = 0;
    correctionY = 0;
    snapshotHistory.length = 0;
    previousPlayerStates.clear();
    serverPlayers = [];
    serverBullets = [];
    serverAsteroids = [];
    predictedBullets = [];
    lastPredictedFireTime = -Infinity;

    console.log('Successfully joined room!');
    console.log('Player ID:', playerId);
    console.log('Room:', selectedRoom.name);

    // Налаштовуємо астероїди відповідно до кімнати
    spawnRoomAsteroids(
      selectedRoom.config.asteroidCount,
    );

    // Приховуємо лобі після підтвердження сервера
    lobbyUI.hide();
    chatUI.clear();
    chatUI.show();

    // Активуємо аудіосистему
    audioSystem.resume().catch((error) => {
      console.warn('Audio resume failed:', error);
    });

    // Запускаємо гру
    loop.start();
  }

  if (message.type === 'players') {
    console.log('Players in room:', message.players);
  }

  if (message.type === 'chat') {
    chatUI.addMessage(
    message.playerName,
      message.text
    );
  }

  if (message.type === 'error') {
    console.error('Server error:', message.message);
  }
});

// Повідомлення про втрату з'єднання
gameSocket.addEventListener('disconnected', (event) => {
  console.warn(
    'Disconnected from server:',
    event.detail,
  );
});

// Спроба повторного підключення
gameSocket.addEventListener('reconnecting', (event) => {
  console.log(
    `Reconnecting in ${event.detail.delay} ms...`,
  );
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