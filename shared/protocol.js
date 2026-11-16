
export const PROTOCOL_VERSION = 3;
export const MESSAGE_SNAPSHOT = 1;

const HEADER_BYTES = 12;
const PLAYER_BYTES = 44;
const BULLET_BYTES = 40;
const ASTEROID_BYTES = 20;

function uuidToBytes(uuid) {
  const hex = uuid.replaceAll('-', '');

  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error('Invalid player UUID');
  }

  const bytes = new Uint8Array(16);

  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(
      hex.slice(i * 2, i * 2 + 2),
      16,
    );
  }

  return bytes;
}

function bytesToUuid(bytes) {
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

function encodeAngle(angle) {
  const normalized = Math.atan2(
    Math.sin(angle),
    Math.cos(angle),
  );

  return Math.round(
    (normalized / Math.PI) * 32767,
  );
}

function decodeAngle(value) {
  return (value / 32767) * Math.PI;
}

export function encodeSnapshot(snapshot) {
  const players = snapshot.players ?? [];
  const bullets = snapshot.bullets ?? [];
  const asteroids = snapshot.asteroids ?? [];

  if (
    players.length > 65535 ||
    bullets.length > 65535 ||
    asteroids.length > 65535
  ) {
    throw new Error('Too many entities');
  }

  const size =
    HEADER_BYTES +
    players.length * PLAYER_BYTES +
    bullets.length * BULLET_BYTES +
    asteroids.length * ASTEROID_BYTES;

  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);

  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, MESSAGE_SNAPSHOT);
  view.setUint32(2, snapshot.tick, true);
  view.setUint16(6, players.length, true);
  view.setUint16(8, bullets.length, true);
  view.setUint16(10, asteroids.length, true);
  let offset = HEADER_BYTES;

  for (const player of players) {
    new Uint8Array(buffer, offset, 16).set(
      uuidToBytes(player.id),
    );
    offset += 16;

    view.setFloat32(offset, player.x, true);
    offset += 4;

    view.setFloat32(offset, player.y, true);
    offset += 4;

    view.setFloat32(offset, player.vx, true);
    offset += 4;

    view.setFloat32(offset, player.vy, true);
    offset += 4;

    view.setInt16(
      offset,
      encodeAngle(player.angle),
      true,
    );
    offset += 2;

    view.setUint32(
      offset,
      player.lastProcessedSeq ?? 0,
      true,
    );
    offset += 4;

    view.setUint32(offset, 0, true);
    offset += 4;

    view.setUint8(offset, player.hp ?? 100);
    offset += 1;

    view.setUint8(offset, player.destroyed ? 1 : 0);
    offset += 1;
  }

  for (const bullet of bullets) {
    view.setUint32(offset, bullet.id, true);
    offset += 4;

    new Uint8Array(buffer, offset, 16).set(
      uuidToBytes(bullet.ownerId),
    );
    offset += 16;

    view.setFloat32(offset, bullet.x, true);
    offset += 4;

    view.setFloat32(offset, bullet.y, true);
    offset += 4;

    view.setFloat32(offset, bullet.vx, true);
    offset += 4;

    view.setFloat32(offset, bullet.vy, true);
    offset += 4;
  }
for (const asteroid of asteroids) {
    view.setUint32(offset, asteroid.id, true);
    offset += 4;

    view.setFloat32(offset, asteroid.x, true);
    offset += 4;

    view.setFloat32(offset, asteroid.y, true);
    offset += 4;

    view.setFloat32(offset, asteroid.radius, true);
    offset += 4;

    view.setFloat32(offset, asteroid.hp, true);
    offset += 4;
    }
  return buffer;
}

export function decodeSnapshot(buffer) {
  const view = new DataView(buffer);

  if (view.byteLength < HEADER_BYTES) {
    throw new Error('Invalid snapshot size');
  }

  const version = view.getUint8(0);
  const type = view.getUint8(1);

  if (version !== PROTOCOL_VERSION) {
    throw new Error('Unsupported protocol version');
  }

  if (type !== MESSAGE_SNAPSHOT) {
    throw new Error('Unsupported binary message');
  }

  const tick = view.getUint32(2, true);
  const playerCount = view.getUint16(6, true);
  const bulletCount = view.getUint16(8, true);
  const asteroidCount = view.getUint16(10, true);

  const expectedSize =
    HEADER_BYTES +
    playerCount * PLAYER_BYTES +
    bulletCount * BULLET_BYTES +
    asteroidCount * ASTEROID_BYTES;

  if (buffer.byteLength !== expectedSize) {
    throw new Error('Invalid snapshot length');
  }

  const players = [];
  const bullets = [];
  const asteroids = [];
  let offset = HEADER_BYTES;

  for (let i = 0; i < playerCount; i++) {
    const id = bytesToUuid(
      new Uint8Array(buffer, offset, 16),
    );
    offset += 16;

    const x = view.getFloat32(offset, true);
    offset += 4;

    const y = view.getFloat32(offset, true);
    offset += 4;

    const vx = view.getFloat32(offset, true);
    offset += 4;

    const vy = view.getFloat32(offset, true);
    offset += 4;

    const angle = decodeAngle(
      view.getInt16(offset, true),
    );
    offset += 2;

    const lastProcessedSeq = view.getUint32(
      offset,
      true,
    );
    offset += 4;

    offset += 4;

    const hp = view.getUint8(offset);
    offset += 1;

    const destroyed = view.getUint8(offset) === 1;
    offset += 1;

    players.push({
      id,
      x,
      y,
      vx,
      vy,
      angle,
      hp,
      destroyed,
      lastProcessedSeq,
    });
  }

  for (let i = 0; i < bulletCount; i++) {
    const id = view.getUint32(offset, true);
    offset += 4;

    const ownerId = bytesToUuid(
      new Uint8Array(buffer, offset, 16),
    );
    offset += 16;

    const x = view.getFloat32(offset, true);
    offset += 4;

    const y = view.getFloat32(offset, true);
    offset += 4;

    const vx = view.getFloat32(offset, true);
    offset += 4;

    const vy = view.getFloat32(offset, true);
    offset += 4;

    bullets.push({
      id,
      ownerId,
      x,
      y,
      vx,
      vy,
    });
  }
  
    for (let i = 0; i < asteroidCount; i++) {
    const id = view.getUint32(offset, true);
    offset += 4;

    const x = view.getFloat32(offset, true);
    offset += 4;

    const y = view.getFloat32(offset, true);
    offset += 4;

    const radius = view.getFloat32(offset, true);
    offset += 4;

    const hp = view.getFloat32(offset, true);
    offset += 4;

    asteroids.push({
        id,
        x,
        y,
        radius,
        hp,
    });
    }

  return {
    type: 'snapshot',
    tick,
    players,
    bullets,
    asteroids,
  };
}
