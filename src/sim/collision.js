
import { createExplosion } from './particle.js';

export function circlesCollide(a, b) {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;

  const radiusSum = a.radius + b.radius;

  return dx * dx + dy * dy <= radiusSum * radiusSum;
}

export function handleCollisions(world) {
  const entities = [...world.entities.values()];

  for (let i = 0; i < entities.length; i++) {
    const a = entities[i];

    if (a.dead) {
      continue;
    }

    for (let j = i + 1; j < entities.length; j++) {
      const b = entities[j];

      if (b.dead) {
        continue;
      }

      if (!circlesCollide(a, b)) {
        continue;
      }

      // Зіткнення танка з аптечкою
      let ship = null;
      let pickup = null;

      if (a.kind === 'ship' && b.kind === 'pickup') {
        ship = a;
        pickup = b;
      } else if (b.kind === 'ship' && a.kind === 'pickup') {
        ship = b;
        pickup = a;
      }

      if (ship && pickup) {
        pickup.collect(ship);
        world.despawn(pickup);
        continue;
      }

      // Зіткнення танка з астероїдом
      let asteroid = null;
      ship = null;

      if (a.kind === 'ship' && b.kind === 'asteroid') {
        ship = a;
        asteroid = b;
      } else if (b.kind === 'ship' && a.kind === 'asteroid') {
        ship = b;
        asteroid = a;
      }

      if (ship && asteroid) {
        // Астероїд завдає 20 HP пошкодження
        const damageApplied = ship.takeDamage(20);

        if (damageApplied) {
          world.emit('hit', {
            targetId: ship.id,
            targetKind: 'ship',
            damage: 20,
          });

          // Невелике відштовхування танка
          const dx = ship.position.x - asteroid.position.x;
          const dy = ship.position.y - asteroid.position.y;

          const distance = Math.hypot(dx, dy);

          if (distance > 0) {
            const pushStrength = 120;

            ship.velocity.x += (dx / distance) * pushStrength;
            ship.velocity.y += (dy / distance) * pushStrength;
          }

          // Вибух після знищення танка
          if (ship.dead) {
            const particles = createExplosion(ship.position, 20);

            for (const particle of particles) {
              world.spawn(particle);
            }

            world.emit('exploded', {
              targetId: ship.id,
              targetKind: 'ship',
            });
          }
        }

        continue;
      }

      // Визначаємо кулю та ціль
      let bullet = null;
      let target = null;

      if (a.kind === 'bullet') {
        bullet = a;
        target = b;
      } else if (b.kind === 'bullet') {
        bullet = b;
        target = a;
      }

      if (
        bullet &&
        target &&
        (target.kind === 'ship' || target.kind === 'asteroid')
      ) {
        // Власна куля не пошкоджує свій танк
        if (bullet.ownerId === target.id) {
          continue;
        }

        const damageApplied = target.takeDamage(bullet.damage);

        // Звук влучання лише за реального пошкодження
        if (damageApplied !== false) {
          world.emit('hit', {
            targetId: target.id,
            targetKind: target.kind,
            damage: bullet.damage,
          });
        }

        // Якщо ціль знищена, створюємо вибух
        if (target.dead) {
          if (target.kind === 'asteroid') {
            world.score += 100;
          }

          const particles = createExplosion(target.position, 20);

          for (const particle of particles) {
            world.spawn(particle);
          }

          world.emit('exploded', {
            targetId: target.id,
            targetKind: target.kind,
          });
        }

        // Куля зникає після влучання
        world.despawn(bullet);
      }
    }
  }
}
