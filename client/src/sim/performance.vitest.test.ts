import { describe, expect, it } from 'vitest';
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
import { acquireParticle, getParticlePoolSize, releaseParticle } from './particle.js';
import { World } from './world.js';

describe('allocation-conscious simulation', () => {
  it('updates position in place without changing vector identity', () => {
    const entity = new Entity({ position: new Vector2(10, 20), velocity: new Vector2(4, -2) });
    const position = entity.position;
    entity.update(0.5);
    expect(entity.position).toBe(position);
    expect(entity.position.x).toBe(12);
    expect(entity.position.y).toBe(19);
  });
  it('damps particle velocity in place', () => {
    const particle = acquireParticle(0, 0, 100, 50, 1, 2, '#fff');
    const velocity = particle.velocity;
    particle.update(1 / 60);
    expect(particle.velocity).toBe(velocity);
    expect(particle.velocity.x).toBeCloseTo(96);
    particle.destroy();
    releaseParticle(particle);
  });
  it('recycles a dead particle after World.sweep', () => {
    const world = new World();
    const particle = acquireParticle(0, 0, 1, 2, 0.01, 2, '#fff');
    world.spawn(particle);
    world.step(0.1);
    expect(world.entities.has(particle.id)).toBe(false);
    expect(getParticlePoolSize()).toBeGreaterThan(0);
    const reused = acquireParticle(4, 5, 6, 7, 1, 3, '#abc');
    expect(reused.dead).toBe(false);
    expect(reused.position.x).toBe(4);
    expect(reused.position.y).toBe(5);
    reused.destroy();
    releaseParticle(reused);
  });
});
