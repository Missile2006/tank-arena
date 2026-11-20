import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export interface ParticleOptions { position?: Vector2; velocity?: Vector2; ttl?: number; radius?: number; color?: string; }
export class Particle extends Entity {
  ttl: number;
  maxTtl: number;
  color: string;
  constructor({
    position = new Vector2(),
    velocity = new Vector2(),
    ttl = 0.5,
    radius = 3,
    color = '#facc15',
  }: ParticleOptions = {}) {
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

  override update(dt: number): void {
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
export function createExplosion(position: Vector2, count = 16): Particle[] {
  const particles: Particle[] = [];

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
        color: colors[i % colors.length] ?? '#facc15',
      }),
    );
  }

  return particles;
}
