import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { encodeSnapshot, decodeSnapshot, PROTOCOL_VERSION, MESSAGE_SNAPSHOT } from './protocol';
import type { WireSnapshot } from './protocol';

const ID = '12345678-1234-1234-1234-123456789abc';
const snapshot = (): WireSnapshot => ({
  tick: 12,
  players: [{ id: ID, x: 100, y: 200, vx: 1, vy: 2, angle: 0.5, hp: 90, lastProcessedSeq: 5, destroyed: false }],
  bullets: [{ id: 1, ownerId: ID, x: 10, y: 20, vx: 30, vy: 40 }],
  asteroids: [{ id: 2, x: 40, y: 50, radius: 25, hp: 50 }],
});
const normalizedAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

describe('binary protocol', () => {
  it('has the expected version and message kind', () => {
    const view = new DataView(encodeSnapshot(snapshot()));
    expect(view.getUint8(0)).toBe(PROTOCOL_VERSION);
    expect(view.getUint8(1)).toBe(MESSAGE_SNAPSHOT);
  });
  it('encodes exact header and entity sizes', () => expect(encodeSnapshot(snapshot()).byteLength).toBe(12 + 44 + 40 + 20));
  it('round trips a snapshot', () => {
    const result = decodeSnapshot(encodeSnapshot(snapshot()));
    expect(result.tick).toBe(12);
    expect(result.players[0]?.id).toBe(ID);
    expect(result.players[0]?.hp).toBe(90);
    expect(result.players[0]?.lastProcessedSeq).toBe(5);
    expect(result.bullets[0]?.ownerId).toBe(ID);
    expect(result.asteroids[0]?.radius).toBe(25);
    expect(result.players[0]?.angle).toBeCloseTo(0.5, 3);
  });
  it.each([0, 1, 2, 5, 10, 100, 1000, 65535])('round trips tick %i', tick => {
    expect(decodeSnapshot(encodeSnapshot({ tick, players: [], bullets: [], asteroids: [] })).tick).toBe(tick);
  });
  it.each([0, 1, 2, 5, 10, 100, 1000, 65535])('round trips player seq %i', seq => {
    const data = snapshot();
    const player = data.players[0]!;
    expect(decodeSnapshot(encodeSnapshot({ ...data, players: [{ ...player, lastProcessedSeq: seq }] })).players[0]?.lastProcessedSeq).toBe(seq);
  });
  it.each([0, 1, 2, 5, 10, 100, 255])('round trips hp %i', hp => {
    const data = snapshot();
    expect(decodeSnapshot(encodeSnapshot({ ...data, players: [{ ...data.players[0]!, hp }] })).players[0]?.hp).toBe(hp);
  });
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('rejects truncated header of %i bytes', bytes => {
    expect(() => decodeSnapshot(new ArrayBuffer(bytes))).toThrow();
  });
  it('rejects wrong protocol version', () => {
    const buffer = encodeSnapshot(snapshot()); new DataView(buffer).setUint8(0, 255);
    expect(() => decodeSnapshot(buffer)).toThrow('Unsupported protocol version');
  });
  it('rejects wrong binary message kind', () => {
    const buffer = encodeSnapshot(snapshot()); new DataView(buffer).setUint8(1, 255);
    expect(() => decodeSnapshot(buffer)).toThrow('Unsupported binary message');
  });
  it('rejects corrupted destroyed flag', () => {
    const buffer = encodeSnapshot(snapshot());
    new DataView(buffer).setUint8(12 + 43, 2);
    expect(() => decodeSnapshot(buffer)).toThrow('Invalid destroyed flag');
  });
  it('rejects incorrect declared counts', () => {
    const buffer = encodeSnapshot(snapshot()); new DataView(buffer).setUint16(6, 99, true);
    expect(() => decodeSnapshot(buffer)).toThrow('Invalid snapshot length');
  });
  it('rejects invalid UUID during encoding', () => {
    const data = snapshot();
    expect(() => encodeSnapshot({ ...data, players: [{ ...data.players[0]!, id: 'invalid' }] })).toThrow();
  });
  it('rejects negative tick', () => expect(() => encodeSnapshot({ ...snapshot(), tick: -1 })).toThrow());
  it('rejects NaN position', () => {
    const data = snapshot();
    expect(() => encodeSnapshot({ ...data, players: [{ ...data.players[0]!, x: NaN }] })).toThrow();
  });
  it('property: binary length matches specification', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 }), (p, b, a) => {
      const data = snapshot();
      const players = Array.from({ length: p }, () => data.players[0]!);
      const bullets = Array.from({ length: b }, () => data.bullets[0]!);
      const asteroids = Array.from({ length: a }, () => data.asteroids[0]!);
      return encodeSnapshot({ tick: 0, players, bullets, asteroids }).byteLength === 12 + p * 44 + b * 40 + a * 20;
    }));
  });
  it('property: round trip preserves float32 values within precision', () => {
    fc.assert(fc.property(fc.float({ min: -10000, max: 10000, noNaN: true }), fc.float({ min: -10000, max: 10000, noNaN: true }), (x, y) => {
      const data = snapshot();
      const result = decodeSnapshot(encodeSnapshot({ ...data, players: [{ ...data.players[0]!, x, y }] }));
      return result.players[0]?.x === Math.fround(x) && result.players[0]?.y === Math.fround(y);
    }));
  });
  it('property: angle survives quantization', () => {
    fc.assert(fc.property(fc.double({ min: -100, max: 100, noNaN: true }), angle => {
      const data = snapshot();
      const result = decodeSnapshot(encodeSnapshot({ ...data, players: [{ ...data.players[0]!, angle }] }));
      return Math.abs(result.players[0]!.angle - normalizedAngle(angle)) <= Math.PI / 32767 + 1e-10;
    }));
  });
  it('property: malformed buffers raise exceptions rather than crash the process', () => {
    fc.assert(fc.property(fc.uint8Array({ maxLength: 150 }), bytes => {
      try { decodeSnapshot(Uint8Array.from(bytes).buffer); return true; }
      catch (error) { return error instanceof Error; }
    }));
  });
});
