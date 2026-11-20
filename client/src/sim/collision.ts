import { createExplosion } from './particle.js';
import { Ship } from './ship.js';
import { Asteroid } from './asteroid.js';
import { Bullet } from './bullet.js';
import { Pickup } from './pickup.js';
import type { Entity } from './entity.js';
import type { World } from './world.js';

export function circlesCollide(a: Entity, b: Entity): boolean {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const radiusSum = a.radius + b.radius;
  return dx * dx + dy * dy <= radiusSum * radiusSum;
}

export function handleCollisions(world: World): void {
  const entities = [...world.entities.values()];
  for (let i = 0; i < entities.length; i++) {
    const a = entities[i];
    if (!a || a.dead) continue;
    for (let j = i + 1; j < entities.length; j++) {
      const b = entities[j];
      if (!b || b.dead || !circlesCollide(a, b)) continue;

      const ship = a instanceof Ship ? a : b instanceof Ship ? b : null;
      const pickup = a instanceof Pickup ? a : b instanceof Pickup ? b : null;
      if (ship && pickup) {
        pickup.collect(ship);
        world.despawn(pickup);
        continue;
      }

      const asteroid = a instanceof Asteroid ? a : b instanceof Asteroid ? b : null;
      if (ship && asteroid) {
        const damageApplied = ship.takeDamage(20);
        if (damageApplied) {
          world.emit('hit', { targetId: ship.id, targetKind: 'ship', damage: 20 });
          const dx = ship.position.x - asteroid.position.x;
          const dy = ship.position.y - asteroid.position.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0) {
            const pushStrength = 120;
            ship.velocity.x += (dx / distance) * pushStrength;
            ship.velocity.y += (dy / distance) * pushStrength;
          }
          if (ship.dead) {
            for (const particle of createExplosion(ship.position, 20)) world.spawn(particle);
            world.emit('exploded', { targetId: ship.id, targetKind: 'ship' });
          }
        }
        continue;
      }

      const bullet = a instanceof Bullet ? a : b instanceof Bullet ? b : null;
      const target = a === bullet ? b : a;
      if (bullet && (target instanceof Ship || target instanceof Asteroid)) {
        if (bullet.ownerId === target.id) continue;
        const damageApplied = target.takeDamage(bullet.damage);
        if (damageApplied !== false) {
          world.emit('hit', { targetId: target.id, targetKind: target.kind, damage: bullet.damage });
        }
        if (target.dead) {
          if (target instanceof Asteroid) world.score += 100;
          for (const particle of createExplosion(target.position, 20)) world.spawn(particle);
          world.emit('exploded', { targetId: target.id, targetKind: target.kind });
        }
        world.despawn(bullet);
      }
    }
  }
}
