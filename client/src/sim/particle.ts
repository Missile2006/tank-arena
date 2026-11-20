import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export interface ParticleOptions { position?: Vector2; velocity?: Vector2; ttl?: number; radius?: number; color?: string; }
export class Particle extends Entity {
  ttl: number;
  maxTtl: number;
  color: string;

  constructor({ position = new Vector2(), velocity = new Vector2(), ttl = 0.5, radius = 3, color = '#facc15' }: ParticleOptions = {}) {
    super({ position, velocity, radius, kind: 'particle' });
    this.ttl = ttl;
    this.maxTtl = ttl;
    this.color = color;
  }

  reset(positionX: number, positionY: number, velocityX: number, velocityY: number, ttl: number, radius: number, color: string): void {
    this.position.x = positionX;
    this.position.y = positionY;
    this.velocity.x = velocityX;
    this.velocity.y = velocityY;
    this.ttl = ttl;
    this.maxTtl = ttl;
    this.radius = radius;
    this.color = color;
    this.dead = false;
  }

  override update(dt: number): void {
    super.update(dt);
    this.ttl -= dt;
    const damping = 0.96 ** (dt * 60);
    this.velocity.x *= damping;
    this.velocity.y *= damping;
    if (this.ttl <= 0) this.destroy();
  }

  get opacity(): number { return Math.max(0, this.ttl / this.maxTtl); }
}

// Bounded object pool: dead particles are recycled after World.sweep removes them.
const MAX_POOLED_PARTICLES = 512;
const freeParticles: Particle[] = [];
export const particlePoolStats = { created: 0, reused: 0, released: 0 };

export function acquireParticle(x: number, y: number, vx: number, vy: number, ttl: number, radius: number, color: string): Particle {
  const particle = freeParticles.pop();
  if (particle) {
    particle.reset(x, y, vx, vy, ttl, radius, color);
    particlePoolStats.reused += 1;
    return particle;
  }
  particlePoolStats.created += 1;
  return new Particle({ position: new Vector2(x, y), velocity: new Vector2(vx, vy), ttl, radius, color });
}

export function releaseParticle(particle: Particle): void {
  if (freeParticles.length >= MAX_POOLED_PARTICLES || !particle.dead) return;
  freeParticles.push(particle);
  particlePoolStats.released += 1;
}

export function getParticlePoolSize(): number { return freeParticles.length; }

export function createExplosion(position: Vector2, count = 16): Particle[] {
  const particles: Particle[] = [];
  const colors = ['#facc15', '#f97316', '#ef4444'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 70 + Math.random() * 110;
    particles.push(acquireParticle(
      position.x, position.y, Math.cos(angle) * speed, Math.sin(angle) * speed,
      0.4 + Math.random() * 0.4, 2 + Math.random() * 3,
      colors[i % colors.length] ?? '#facc15',
    ));
  }
  return particles;
}
