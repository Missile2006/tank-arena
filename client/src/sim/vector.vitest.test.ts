import { describe, expect, it } from 'vitest';
import { Vector2 } from './vector';
import { wrapPosition } from './arena';
import { circlesCollide } from './collision';
import { integrate } from './ship';

describe('Vector2', () => {
  it.each([
    [0, 0, 0], [3, 4, 5], [-3, -4, 5], [5, 12, 13], [8, 15, 17],
    [7, 24, 25], [0, 10, 10], [10, 0, 10], [-5, 0, 5], [0, -9, 9],
  ])('length(%i,%i) = %i', (x, y, expected) => {
    expect(new Vector2(x, y).length()).toBeCloseTo(expected);
  });
  it.each([[1, 2], [-3, 5], [0, 0], [10, -10], [0.5, 0.25]])('clone preserves (%f,%f)', (x, y) => {
    const v = new Vector2(x, y); const copy = v.clone();
    expect(copy).toEqual(v); expect(copy).not.toBe(v);
  });
  it('add, subtract, scale and distance', () => {
    const a = new Vector2(3, 4), b = new Vector2(1, 2);
    expect(a.add(b)).toEqual(new Vector2(4, 6));
    expect(a.sub(b)).toEqual(new Vector2(2, 2));
    expect(a.scale(2)).toEqual(new Vector2(6, 8));
    expect(a.distanceTo(b)).toBeCloseTo(Math.sqrt(8));
    expect(a).toEqual(new Vector2(3, 4));
  });
  it('zero vector normalizes safely', () => expect(new Vector2().normalize()).toEqual(new Vector2()));
  it('nonzero normalization has length one', () => expect(new Vector2(3, 4).normalize().length()).toBeCloseTo(1));
});

describe('arena and collisions', () => {
  it.each([[-1, 899], [900, 0], [901, 1], [1801, 1], [-901, 899], [0, 0], [450, 450], [899, 899]])('wrap x=%i => %i', (x, expected) => {
    expect(wrapPosition({ x, y: 20 }, 900, 550).x).toBe(expected);
  });
  it.each([
    [0, 0, 10, 0, 5, 5, true], [0, 0, 11, 0, 5, 5, false],
    [0, 0, 0, 0, 0, 0, true], [0, 0, 3, 4, 2, 3, true],
    [0, 0, 4, 4, 2, 3, false],
  ])('circle collision (%f,%f) (%f,%f)', (x1, y1, x2, y2, r1, r2, expected) => {
    const a = { position: { x: x1, y: y1 }, radius: r1 };
    const b = { position: { x: x2, y: y2 }, radius: r2 };
    expect(circlesCollide(a as never, b as never)).toBe(expected);
  });
});

describe('client integrate', () => {
  const initial = () => ({ x: 450, y: 275, vx: 0, vy: 0, angle: 0 });
  it('does not mutate the previous state', () => {
    const ship = initial(); const next = integrate(ship, { forward: true }, 1 / 60);
    expect(ship).toEqual(initial()); expect(next).not.toBe(ship);
  });
  it('forward accelerates upward', () => expect(integrate(initial(), { forward: true }, 1 / 60).vy).toBeLessThan(0));
  it('backward accelerates downward', () => expect(integrate(initial(), { backward: true }, 1 / 60).vy).toBeGreaterThan(0));
  it('left decreases angle', () => expect(integrate(initial(), { left: true }, 1 / 60).angle).toBeLessThan(0));
  it('right increases angle', () => expect(integrate(initial(), { right: true }, 1 / 60).angle).toBeGreaterThan(0));
  it('opposing turns cancel', () => expect(integrate(initial(), { left: true, right: true }, 1 / 60).angle).toBe(0));
  it('opposing thrust cancels', () => expect(integrate(initial(), { forward: true, backward: true }, 1 / 60).vy).toBe(0));
  it('speed is capped', () => {
    const result = integrate({ ...initial(), vx: 10000, vy: 10000 }, {}, 1 / 60);
    expect(Math.hypot(result.vx, result.vy)).toBeLessThanOrEqual(180.00001);
  });
});
