
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
      
      // Перевіряємо зіткнення танка з бонусом
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

      let bullet = null;
      let target = null;

      // Перевіряємо, чи один з об'єктів є кулею
      if (a.kind === 'bullet') {
        bullet = a;
        target = b;
      } else if (b.kind === 'bullet') {
        bullet = b;
        target = a;
      }

      // Куля може пошкодити танк або перешкоду
      if (
        bullet &&
        target &&
        (target.kind === 'ship' || target.kind === 'asteroid')
      ) {
        // Власна куля не пошкоджує свій танк
        if (bullet.ownerId === target.id) {
          continue;
        }

        
      target.takeDamage(bullet.damage);

      // Якщо ціль знищена, створюємо вибух
      if (target.dead) {
        // За знищення перешкоди додаємо 100 очок
        if (target.kind === 'asteroid') {
          world.score += 100;
        }

        const particles = createExplosion(target.position, 20);

        for (const particle of particles) {
          world.spawn(particle);
        }
      }

      // Куля зникає після влучання
      world.despawn(bullet);
      }
    }
  }
}
