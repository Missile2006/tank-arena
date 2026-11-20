import './style.css';

import { createChatUI } from './net/chat.ts';
import { GameSocket } from './net/socket.ts';
import { createNetgraph } from './net/netgraph.ts';
//import { runEventLoopExperiments } from './experiments/event-loop.js';
import { createInput } from './input.js';
import { Ship } from './sim/ship.ts';
import { World } from './sim/world.ts';
import { Asteroid } from './sim/asteroid.ts';
import { Vector2 } from './sim/vector.js';
import { createLoop } from './loop.js';
import { drawHUD } from './render/hud.ts';
import { setupCanvas } from './render/canvas.js';
import { applyHoming } from './sim/homing.js';
import { createHealthPickup } from './sim/pickup.ts';
import { fetchJson, loadAll } from './assets/loader.ts';
import { drawLoading } from './render/loading.ts';
import { emitGameEvent, gameEvents } from './events/bus.js';
import { createAudioSystem } from './audio/audio.ts';
import { Lobby } from './lobby/lobby.js';
import { createLobbyUI } from './lobby/lobby-ui.ts';
import {
  createShip,
  integrate as integrateNetworkShip,
  FIXED_DT,
} from 'tank-arena-shared/simulation';

// РќР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ С–РіСЂРѕРІРѕРіРѕ РїРѕР»СЏ
const canvas = document.getElementById('gameCanvas');

const WIDTH = 900;
const HEIGHT = 550;

const { ctx } = setupCanvas(canvas, WIDTH, HEIGHT);

// Р—Р°РІР°РЅС‚Р°Р¶РµРЅС– СЂРµСЃСѓСЂСЃРё С‚Р° Р°СѓРґС–РѕСЃРёСЃС‚РµРјР°
let gameAssets = new Map();
let audioContext = null;
let audioSystem = null;

// Р›РѕР±С–
const lobby = new Lobby();
const lobbyUI = createLobbyUI(lobby);

// WebSocket-Р·'С”РґРЅР°РЅРЅСЏ С–Р· СЃРµСЂРІРµСЂРѕРј
const gameSocket = new GameSocket('/ws');
const netgraph = createNetgraph();
const chatUI = createChatUI(gameSocket);

let selectedRoom = null;
let playerName = '';
let playerId = null;

// Р›Р°Р±РѕСЂР°С‚РѕСЂРЅР° в„–5: РЅСѓРјРµСЂР°С†С–СЏ РєРѕРјР°РЅРґ РєРµСЂСѓРІР°РЅРЅСЏ
let inputSequence = 0;
let inputAccumulator = 0;

const NETWORK_INPUT_DT = 1 / 30;

// РћСЃС‚Р°РЅРЅС–Р№ СЃС‚Р°РЅ РєРѕСЂР°Р±Р»С–РІ, РѕС‚СЂРёРјР°РЅРёР№ РІС–Рґ СЃРµСЂРІРµСЂР°
let serverPlayers = [];
let serverBullets = [];
let serverAsteroids = [];
let asteroidExplosions = [];
// РћСЃС‚Р°РЅРЅС–Р№ РїС–РґС‚РІРµСЂРґР¶РµРЅРёР№ СЃРµСЂРІРµСЂРѕРј СЃС‚Р°РЅ Р·РґРѕСЂРѕРІвЂ™СЏ РєРѕР¶РЅРѕРіРѕ С‚Р°РЅРєР°
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
// Р›Р°Р±РѕСЂР°С‚РѕСЂРЅР° в„–5: С€С‚СѓС‡РЅР° Р·Р°С‚СЂРёРјРєР° СЃРµСЂРІРµСЂРЅРёС… РґР°РЅРёС…
const NETWORK_DELAY_MS = 0;

// РњР°Р»СЋРІР°РЅРЅСЏ СЃРїСЂР°Р№С‚С–РІ
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

// РЎС‚РІРѕСЂРµРЅРЅСЏ С–РіСЂРѕРІРѕРіРѕ СЃРІС–С‚Сѓ
const input = createInput();
const world = new World();

let tank = world.spawn(new Ship(WIDTH / 2, HEIGHT / 2));
let respawnTimer = 0;

// РђСЃС‚РµСЂРѕС—РґРё СЃС‚РІРѕСЂСЋРІР°С‚РёРјСѓС‚СЊСЃСЏ РїС–СЃР»СЏ РІРёР±РѕСЂСѓ РєС–РјРЅР°С‚Рё
let homingAsteroid = null;

// РђРїС‚РµС‡РєР° РґР»СЏ РІС–РґРЅРѕРІР»РµРЅРЅСЏ Р·РґРѕСЂРѕРІ'СЏ
world.spawn(
  createHealthPickup(new Vector2(450, 350), 25),
);

// РџРѕРїРµСЂРµРґРЅСЏ РїРѕР·РёС†С–СЏ С‚Р°РЅРєР° РґР»СЏ С–РЅС‚РµСЂРїРѕР»СЏС†С–С—
let previousTank = {
  x: tank.x,
  y: tank.y,
  angle: tank.angle,
};

// РЎС‚РІРѕСЂРµРЅРЅСЏ Р°СЃС‚РµСЂРѕС—РґС–РІ РґР»СЏ РІРёР±СЂР°РЅРѕС— РєС–РјРЅР°С‚Рё
function spawnRoomAsteroids(count) {
  // Р’РёРґР°Р»СЏС”РјРѕ Р°СЃС‚РµСЂРѕС—РґРё РїРѕРїРµСЂРµРґРЅСЊРѕС— РєС–РјРЅР°С‚Рё
  for (const asteroid of [...world.ofKind('asteroid')]) {
    world.despawn(asteroid);
  }

  world.sweep();

  // Р РѕР·РјС–С‰СѓС”РјРѕ Р°СЃС‚РµСЂРѕС—РґРё РЅР°РІРєРѕР»Рѕ С†РµРЅС‚СЂСѓ Р°СЂРµРЅРё
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

  // РџРµСЂС€РёР№ Р°СЃС‚РµСЂРѕС—Рґ Р±СѓРґРµ РїРµСЂРµСЃР»С–РґСѓРІР°С‚Рё С‚Р°РЅРє
  homingAsteroid = [...world.ofKind('asteroid')][0] ?? null;

  console.log(`Spawned ${count} asteroids`);
}

// РњР°Р»СЋРІР°РЅРЅСЏ С–РіСЂРѕРІРѕРіРѕ РїРѕР»СЏ
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

// РЁРєР°Р»Р° HP РїСЂРёРІ'СЏР·Р°РЅР° РґРѕ РїРѕР·РёС†С–С—, РЅР° СЏРєС–Р№ С‚Р°РЅРє РЅР°РјР°Р»СЊРѕРІР°РЅРёР№.
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

    // Р—РЅРёС‰РµРЅРёР№ С‚Р°РЅРє РЅРµ РїРѕРІРёРЅРµРЅ Р·Р°Р»РёС€Р°С‚РёСЃСЏ РЅР° Р°СЂРµРЅС–.
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

// РњР°Р»СЋРІР°РЅРЅСЏ С‚Р°РЅРєР°
function drawTank(renderTank) {
  // РџС–Рґ С‡Р°СЃ РЅРµРІСЂР°Р·Р»РёРІРѕСЃС‚С– С‚Р°РЅРє Р±Р»РёРјР°С”
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

    // РЇРєС‰Рѕ СЃРїСЂР°Р№С‚ РєСѓР»С– РЅРµ Р·Р°РІР°РЅС‚Р°Р¶РёРІСЃСЏ,
    // РјР°Р»СЋС”РјРѕ РЅРµРІРµР»РёРєРµ РїРѕРјР°СЂР°РЅС‡РµРІРµ РєРѕР»Рѕ
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
// РњР°Р»СЋРІР°РЅРЅСЏ РєСѓР»СЊ
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

// РњР°Р»СЋРІР°РЅРЅСЏ Р°СЃС‚РµСЂРѕС—РґС–РІ
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

// РњР°Р»СЋРІР°РЅРЅСЏ С‡Р°СЃС‚РёРЅРѕРє РІРёР±СѓС…Сѓ
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

// РњР°Р»СЋРІР°РЅРЅСЏ Р°РїС‚РµС‡РѕРє
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

// РџРѕС€СѓРє РЅР°Р№Р±Р»РёР¶С‡РѕРіРѕ Р°СЃС‚РµСЂРѕС—РґР°
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

  // Р—Р±РµСЂС–РіР°С”РјРѕ СЂС–Р·РЅРёС†СЋ РјС–Р¶ СЃС‚Р°СЂРёРј С– РЅРѕРІРёРј РїРѕР»РѕР¶РµРЅРЅСЏРј
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

  // РћРґРЅР° РєРѕРјР°РЅРґР° РЅР° РѕРґРёРЅ РєСЂРѕРє СЃРёРјСѓР»СЏС†С–С— (30 Р“С†)
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

    // РќР°РґСЃРёР»Р°С”РјРѕ РєРѕРјР°РЅРґСѓ СЃРµСЂРІРµСЂСѓ
    gameSocket.send(command);

    if (command.fire && predictedShip) {
      predictBullet();
    }

    if (predictedShip && !serverPlayers.find((ship) => ship.id === playerId)?.destroyed) {
      // Р—Р±РµСЂС–РіР°С”РјРѕ РєРѕРјР°РЅРґСѓ РґРѕ РїС–РґС‚РІРµСЂРґР¶РµРЅРЅСЏ
      pendingInputs.push(command);

      // РџРµСЂРµРґР±Р°С‡Р°С”РјРѕ СЂСѓС… С‚РёРјРё СЃР°РјРёРјРё С„РѕСЂРјСѓР»Р°РјРё,
      // СЏРєС– РІРёРєРѕСЂРёСЃС‚РѕРІСѓС” СЃРµСЂРІРµСЂ
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

// РћРЅРѕРІР»РµРЅРЅСЏ С–РіСЂРѕРІРѕС— С„С–Р·РёРєРё
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

  // РЇРєС‰Рѕ С‚Р°РЅРє Р·РЅРёС‰РµРЅРёР№, С‡РµРєР°С”РјРѕ РЅР° РІС–РґСЂРѕРґР¶РµРЅРЅСЏ
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

  // РљРµСЂСѓРІР°РЅРЅСЏ С‚Р°РЅРєРѕРј
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

  // Р›РѕРєР°Р»СЊРЅР° СЃС‚СЂС–Р»СЊР±Р° РїСЂР°С†СЋС” Р»РёС€Рµ Р±РµР· СЃРµСЂРІРµСЂРЅРѕРіРѕ РїС–РґРєР»СЋС‡РµРЅРЅСЏ.
  // РЈ РјРµСЂРµР¶РµРІРѕРјСѓ СЂРµР¶РёРјС– РєРѕРјР°РЅРґР° fire РЅР°РґСЃРёР»Р°С”С‚СЊСЃСЏ СЃРµСЂРІРµСЂСѓ.
  if (!playerId && input.justPressed(' ')) {
    const bullet = tank.fire();

    bullet.homing = true;

    world.spawn(bullet);

    emitGameEvent('fired');
  }


  // РЈСЃС– Р°СЃС‚РµСЂРѕС—РґРё РїРµСЂРµСЃР»С–РґСѓСЋС‚СЊ С‚Р°РЅРє
  for (const asteroid of world.ofKind('asteroid')) {
    applyHoming(asteroid, tank, dt, 5);

    // РћР±РјРµР¶СѓС”РјРѕ РјР°РєСЃРёРјР°Р»СЊРЅСѓ С€РІРёРґРєС–СЃС‚СЊ Р°СЃС‚РµСЂРѕС—РґР°
    const velocity = asteroid.velocity;
    const currentSpeed = velocity.length();

    if (currentSpeed > asteroid.speed) {
      asteroid.velocity = velocity.scale(
        asteroid.speed / currentSpeed,
      );
    }
  }

  // РЎР°РјРѕРЅР°РІРµРґРµРЅРЅСЏ РєСѓР»СЊ РЅР° РЅР°Р№Р±Р»РёР¶С‡РёР№ Р°СЃС‚РµСЂРѕС—Рґ
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

  // РћРЅРѕРІР»РµРЅРЅСЏ СЃРІС–С‚Сѓ С‚Р° Р·С–С‚РєРЅРµРЅСЊ
  world.step(dt);

  // РџРµСЂРµС…С–Рґ С‚Р°РЅРєР° С‡РµСЂРµР· РјРµР¶С– Р°СЂРµРЅРё
  if (!tank.dead) {
    tank.wrap(WIDTH, HEIGHT);
  }

  input.endStep();
}

// Р†РЅС‚РµСЂРїРѕР»СЏС†С–СЏ РєСѓС‚Р°
function interpolateAngle(a, b, alpha) {
  const difference = Math.atan2(
    Math.sin(b - a),
    Math.cos(b - a),
  );

  return a + difference * alpha;
}

// РњР°Р»СЋРІР°РЅРЅСЏ РєР°РґСЂСѓ РіСЂРё
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

  // Р’С–РґРѕР±СЂР°Р¶РµРЅРЅСЏ СЂР°С…СѓРЅРєСѓ С‚Р° Р·РґРѕСЂРѕРІ'СЏ
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

  // Р’С–РґРѕР±СЂР°Р¶РµРЅРЅСЏ РіСЂР°РІС†СЏ С‚Р° РєС–РјРЅР°С‚Рё
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

  // РџРѕРІС–РґРѕРјР»РµРЅРЅСЏ РїСЂРѕ РІС–РґСЂРѕРґР¶РµРЅРЅСЏ
  if ((playerId && localServerPlayer?.destroyed) || (!playerId && tank.dead)) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#facc15';

    ctx.fillText(
      'Р’С–РґСЂРѕРґР¶РµРЅРЅСЏ С‡РµСЂРµР· 2 СЃРµРєСѓРЅРґРё...',
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


// Р†РіСЂРѕРІРёР№ С†РёРєР»
const loop = createLoop({
  update,
  render,
});


 // Р’С…С–Рґ РіСЂР°РІС†СЏ РґРѕ РІРёР±СЂР°РЅРѕС— РєС–РјРЅР°С‚Рё
  lobby.addEventListener('joined', (event) => {
  playerName = event.detail.playerName;
  selectedRoom = event.detail.room;

  console.log('Player:', playerName);
  console.log('Selected room:', selectedRoom.name);

  // РџС–РґРєР»СЋС‡Р°С”РјРѕСЃСЏ РґРѕ WebSocket-СЃРµСЂРІРµСЂР°
  gameSocket.connect(selectedRoom.id, playerName);

  // РџРѕРєРё СЃРµСЂРІРµСЂ РЅРµ РїС–РґС‚РІРµСЂРґРёРІ РІС…С–Рґ,
  // С–РіСЂРѕРІРёР№ С†РёРєР» РЅРµ Р·Р°РїСѓСЃРєР°С”РјРѕ
  console.log('Waiting for server confirmation...');
});

// РЎРµСЂРІРµСЂ РїС–РґС‚РІРµСЂРґРёРІ РІС…С–Рґ РґРѕ РєС–РјРЅР°С‚Рё
gameSocket.addEventListener('message', (event) => {
  const message = event.detail;

if (message.type === 'snapshot') {
  const snapshot = message;

  setTimeout(() => {
    // РќРµ Р·Р°СЃС‚РѕСЃРѕРІСѓС”РјРѕ СЃС‚Р°СЂС– Р·РЅС–РјРєРё РїС–СЃР»СЏ РІРёС…РѕРґСѓ Р· РєС–РјРЅР°С‚Рё
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

    // Р—РІСѓРє С‚С–Р»СЊРєРё РїСЂРё С„Р°РєС‚РёС‡РЅРѕРјСѓ Р·РјРµРЅС€РµРЅРЅС– HP, Р° РЅРµ РєРѕР¶РЅРѕРіРѕ РєР°РґСЂСѓ.
    for (const ship of serverPlayers) {
      const previous = previousPlayerStates.get(ship.id);
      if (previous && ship.hp < previous.hp) {
        emitGameEvent(ship.destroyed && !previous.destroyed ? 'exploded' : 'hit');
      }
      if (ship.id === playerId && previous?.destroyed && !ship.destroyed) {
        // РџС–СЃР»СЏ РІС–РґСЂРѕРґР¶РµРЅРЅСЏ РЅРµ РІС–РґС‚РІРѕСЂСЋС”РјРѕ СЃС‚Р°СЂС– РЅРµРїС–РґС‚РІРµСЂРґР¶РµРЅС– РєРѕРјР°РЅРґРё.
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

    // РќР°Р»Р°С€С‚РѕРІСѓС”РјРѕ Р°СЃС‚РµСЂРѕС—РґРё РІС–РґРїРѕРІС–РґРЅРѕ РґРѕ РєС–РјРЅР°С‚Рё
    spawnRoomAsteroids(
      selectedRoom.config.asteroidCount,
    );

    // РџСЂРёС…РѕРІСѓС”РјРѕ Р»РѕР±С– РїС–СЃР»СЏ РїС–РґС‚РІРµСЂРґР¶РµРЅРЅСЏ СЃРµСЂРІРµСЂР°
    lobbyUI.hide();
    chatUI.clear();
    chatUI.show();

    // РђРєС‚РёРІСѓС”РјРѕ Р°СѓРґС–РѕСЃРёСЃС‚РµРјСѓ
    audioSystem.resume().catch((error) => {
      console.warn('Audio resume failed:', error);
    });

    // Р—Р°РїСѓСЃРєР°С”РјРѕ РіСЂСѓ
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

// РџРѕРІС–РґРѕРјР»РµРЅРЅСЏ РїСЂРѕ РІС‚СЂР°С‚Сѓ Р·'С”РґРЅР°РЅРЅСЏ
gameSocket.addEventListener('disconnected', (event) => {
  console.warn(
    'Disconnected from server:',
    event.detail,
  );
});

// РЎРїСЂРѕР±Р° РїРѕРІС‚РѕСЂРЅРѕРіРѕ РїС–РґРєР»СЋС‡РµРЅРЅСЏ
gameSocket.addEventListener('reconnecting', (event) => {
  console.log(
    `Reconnecting in ${event.detail.delay} ms...`,
  );
});

// РљРѕРЅС‚СЂРѕР»РµСЂ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ
let loadingController = null;

// Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ СЂРµСЃСѓСЂСЃС–РІ РіСЂРё
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
    // Р—Р°РІР°РЅС‚Р°Р¶СѓС”РјРѕ manifest.json
    const manifest = await fetchJson(
      '/manifest.json',
      signal,
    );

    audioContext ??= new AudioContext();

    // РџР°СЂР°Р»РµР»СЊРЅРѕ Р·Р°РІР°РЅС‚Р°Р¶СѓС”РјРѕ СЂРµСЃСѓСЂСЃРё
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

    // РЎС‚РІРѕСЂСЋС”РјРѕ Р·РІСѓРєРѕРІСѓ СЃРёСЃС‚РµРјСѓ
    audioSystem = createAudioSystem(
      audioContext,
      gameAssets,
    );

    // РџРѕРєР°Р·СѓС”РјРѕ Р»РѕР±С– РїС–СЃР»СЏ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ
    lobbyUI.show();
  } catch (error) {
    if (signal.aborted) {
      return;
    }

    // РџСЂРё РїРѕРјРёР»С†С– РїСЂРёС…РѕРІСѓС”РјРѕ Р»РѕР±С–
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

// РљРЅРѕРїРєР° РїРѕРІС‚РѕСЂРЅРѕРіРѕ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ
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

// РџРѕС‡Р°С‚РєРѕРІРµ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ СЂРµСЃСѓСЂСЃС–РІ
// Р“СЂР° РќР• Р·Р°РїСѓСЃРєР°С”С‚СЊСЃСЏ РґРѕ РЅР°С‚РёСЃРєР°РЅРЅСЏ JOIN GAME
startGame();
