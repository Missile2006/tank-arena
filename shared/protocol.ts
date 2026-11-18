// Wire format is unchanged from Lab 5: 12-byte header, 44/40/20-byte entities.
export interface WirePlayer { readonly id: string; readonly x: number; readonly y: number; readonly vx: number; readonly vy: number; readonly angle: number; readonly lastProcessedSeq?: number; readonly hp?: number; readonly destroyed?: boolean }
export interface WireBullet { readonly id: number; readonly ownerId: string; readonly x: number; readonly y: number; readonly vx: number; readonly vy: number }
export interface WireAsteroid { readonly id: number; readonly x: number; readonly y: number; readonly radius: number; readonly hp: number }
export interface WireSnapshot { readonly type?: 'snapshot'; readonly tick: number; readonly players: readonly WirePlayer[]; readonly bullets: readonly WireBullet[]; readonly asteroids: readonly WireAsteroid[] }
export interface DecodedPlayer extends Omit<WirePlayer, 'lastProcessedSeq' | 'hp' | 'destroyed'> { readonly lastProcessedSeq: number; readonly hp: number; readonly destroyed: boolean }
export interface DecodedSnapshot { readonly type: 'snapshot'; readonly tick: number; readonly players: DecodedPlayer[]; readonly bullets: WireBullet[]; readonly asteroids: WireAsteroid[] }
function finite(value: number, name: string): number { if (!Number.isFinite(value)) throw new Error(`Invalid ${name}`); return value; }
function uint(value: number, max: number, name: string): number { if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`Invalid ${name}`); return value; }

export const PROTOCOL_VERSION = 3;
export const MESSAGE_SNAPSHOT = 1;

const HEADER_BYTES = 12;
const PLAYER_BYTES = 44;
const BULLET_BYTES = 40;
const ASTEROID_BYTES = 20;

function uuidToBytes(uuid: string): Uint8Array {
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

function bytesToUuid(bytes: Uint8Array): string {
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

function encodeAngle(angle: number): number {
  const normalized = Math.atan2(
    Math.sin(angle),
    Math.cos(angle),
  );

  return Math.round(
    (normalized / Math.PI) * 32767,
  );
}

function decodeAngle(value: number): number {
  return (value / 32767) * Math.PI;
}

export function encodeSnapshot(snapshot: WireSnapshot): ArrayBuffer {
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
  view.setUint32(2, uint(snapshot.tick, 0xffffffff, "tick"), true);
  view.setUint16(6, players.length, true);
  view.setUint16(8, bullets.length, true);
  view.setUint16(10, asteroids.length, true);
  let offset = HEADER_BYTES;

  for (const player of players) {
    new Uint8Array(buffer, offset, 16).set(
      uuidToBytes(player.id),
    );
    offset += 16;

    view.setFloat32(offset, finite(player.x, "player.x"), true);
    offset += 4;

    view.setFloat32(offset, finite(player.y, "player.y"), true);
    offset += 4;

    view.setFloat32(offset, finite(player.vx, "player.vx"), true);
    offset += 4;

    view.setFloat32(offset, finite(player.vy, "player.vy"), true);
    offset += 4;

    view.setInt16(
      offset,
      encodeAngle(finite(player.angle, "player.angle")),
      true,
    );
    offset += 2;

    view.setUint32(
      offset,
      uint(player.lastProcessedSeq ?? 0, 0xffffffff, "seq"),
      true,
    );
    offset += 4;

    view.setUint32(offset, 0, true);
    offset += 4;

    view.setUint8(offset, uint(player.hp ?? 100, 255, "hp"));
    offset += 1;

    view.setUint8(offset, player.destroyed ? 1 : 0);
    offset += 1;
  }

  for (const bullet of bullets) {
    view.setUint32(offset, uint(bullet.id, 0xffffffff, "bullet id"), true);
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
    view.setUint32(offset, uint(asteroid.id, 0xffffffff, "asteroid id"), true);
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

export function decodeSnapshot(buffer: ArrayBuffer): DecodedSnapshot {
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

  const players: DecodedPlayer[] = [];
  const bullets: WireBullet[] = [];
  const asteroids: WireAsteroid[] = [];
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

    const destroyedByte = view.getUint8(offset);
    if (destroyedByte > 1) throw new Error("Invalid destroyed flag");
    const destroyed = destroyedByte === 1;
    offset += 1;

    for (const [name, value] of Object.entries({x,y,vx,vy,angle})) finite(value, name);
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

    for (const [name, value] of Object.entries({x,y,vx,vy})) finite(value, name);
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

    for (const [name, value] of Object.entries({x,y,radius,hp})) finite(value, name);
    if (radius < 0 || hp < 0) throw new Error("Invalid asteroid range");
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
