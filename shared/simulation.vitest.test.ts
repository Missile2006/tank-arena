import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createShip, integrate, normalizeInput, createSeededRandom, FIXED_DT, MAX_SPEED } from './simulation';
import { parseClientMessage, messageType } from './messages';
import { entityKind, assertNever } from './types';

describe('shared simulation', () => {
  it.each([0, 1, 2, 7, 42, 100, 999, 10000, 0xffffffff, -1])('seed %i is reproducible', (seed) => {
    const a = createSeededRandom(seed), b = createSeededRandom(seed);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });
  it.each([0, 1, 2, 3, 10, 50, 100, 200, 1000, 10000])('seq %i accepted', (seq) => {
    expect(normalizeInput({ seq }).seq).toBe(seq);
  });
  it.each([-1, -2, 0.1, NaN, Infinity, -Infinity])('invalid seq %s becomes zero', (seq) => {
    expect(normalizeInput({ seq }).seq).toBe(0);
  });
  it('createShip has a stable initial state', () => expect(createShip('a', 10, 20)).toEqual({ id: 'a', x: 10, y: 20, vx: 0, vy: 0, angle: 0 }));
  it('integration moves ship upward with thrust', () => {
    const ship = createShip('a'); integrate(ship, { thrust: true }, FIXED_DT);
    expect(ship.y).toBeLessThan(275);
  });
  it('speed remains capped', () => {
    const ship = createShip('a'); ship.vx = 10000; ship.vy = 10000;
    integrate(ship, {}, FIXED_DT);
    expect(Math.hypot(ship.vx, ship.vy)).toBeLessThanOrEqual(MAX_SPEED + 1e-8);
  });
  it('same initial state and inputs yield same output', () => {
    const a = createShip('a'), b = createShip('a');
    for (let i = 0; i < 100; i++) {
      const input = { thrust: i % 3 === 0, left: i % 4 === 0, right: i % 7 === 0 };
      integrate(a, input, FIXED_DT); integrate(b, input, FIXED_DT);
    }
    expect(a).toEqual(b);
  });
  it('seeded random produces numbers in [0,1)', () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 100; i++) { const value = rng(); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThan(1); }
  });
  it('property: integration speed cap', () => {
    fc.assert(fc.property(fc.double({ min: -10000, max: 10000, noNaN: true }), fc.double({ min: -10000, max: 10000, noNaN: true }), (vx, vy) => {
      const ship = createShip('a'); ship.vx = vx; ship.vy = vy;
      integrate(ship, {}, FIXED_DT);
      return Math.hypot(ship.vx, ship.vy) <= MAX_SPEED + 1e-8;
    }), { numRuns: 100 });
  });
  it('property: same inputs yield same state', () => {
    fc.assert(fc.property(fc.array(fc.record({ thrust: fc.boolean(), backward: fc.boolean(), left: fc.boolean(), right: fc.boolean() }), { maxLength: 60 }), inputs => {
      const a = createShip('a'), b = createShip('a');
      for (const input of inputs) { integrate(a, input); integrate(b, input); }
      return JSON.stringify(a) === JSON.stringify(b);
    }), { numRuns: 100 });
  });
  it('property: normalized sequence is nonnegative integer', () => {
    fc.assert(fc.property(fc.integer(), seq => Number.isSafeInteger(normalizeInput({ seq }).seq) && normalizeInput({ seq }).seq >= 0));
  });
});

describe('message parsing', () => {
  it.each(['join', 'chat', 'input', 'ping'] as const)('accepts %s', (kind) => {
    const messages = {
      join: { type: 'join', roomId: 'room', playerName: 'Player' },
      chat: { type: 'chat', text: 'hello' },
      input: { type: 'input', seq: 1, thrust: false, backward: false, left: false, right: false, fire: false },
      ping: { type: 'ping', id: 0 },
    };
    expect(messageType(parseClientMessage(messages[kind]))).toBe(kind);
  });
  it.each(['', ' ', 'a'.repeat(501)])('rejects invalid chat text', text => {
    expect(() => parseClientMessage({ type: 'chat', text })).toThrow();
  });
  it.each([-1, 0, 1.5])('rejects invalid input seq %s', seq => {
    expect(() => parseClientMessage({ type: 'input', seq, thrust: false, backward: false, left: false, right: false, fire: false })).toThrow();
  });
  it('rejects unknown fields', () => expect(() => parseClientMessage({ type: 'ping', id: 1, extra: 1 })).toThrow());
  it('property: valid chat strings parse', () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), text => parseClientMessage({ type: 'chat', text }).type === 'chat'));
  });
  it('property: corrupted message types are rejected', () => {
    fc.assert(fc.property(fc.string().filter(s => !['join', 'chat', 'input', 'ping'].includes(s)), type => {
      try { parseClientMessage({ type }); return false; } catch { return true; }
    }));
  });
  it('entity kinds dispatch correctly', () => {
    expect(entityKind({ kind: 'player' } as never)).toBe('player');
    expect(entityKind({ kind: 'bullet' } as never)).toBe('bullet');
    expect(entityKind({ kind: 'asteroid' } as never)).toBe('asteroid');
  });
  it('assertNever rejects unknown variants', () => expect(() => assertNever('unknown' as never)).toThrow());
});
