
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export class Particle extends Entity {
  constructor({
    position = new Vector2(),
    velocity = new Vector2(),
    ttl = 0.5,
    radius = 3,
    color = '#facc15',
  } = {}) {
    super({
      position,
      velocity,
      radius,
      kind: 'particle',
    });

    this.ttl = ttl;
    this.maxTtl = ttl;
    this.color = color;
  }

  update(dt) {
    super.update(dt);

    this.ttl -= dt;

    // Поступово сповільнюємо частинку
    this.velocity = this.velocity.scale(0.96 ** (dt * 60));

    if (this.ttl <= 0) {
      this.destroy();
    }
  }

  get opacity() {
    return Math.max(0, this.ttl / this.maxTtl);
  }
}

// Створення набору частинок у точці вибуху
export function createExplosion(position, count = 16) {
  const particles = [];

  const colors = ['#facc15', '#f97316', '#ef4444'];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 70 + Math.random() * 110;

    const velocity = new Vector2(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
    );

    particles.push(
      new Particle({
        position,
        velocity,
        ttl: 0.4 + Math.random() * 0.4,
        radius: 2 + Math.random() * 3,
        color: colors[i % colors.length],
      }),
    );
  }

  return particles;
}
