import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
export interface BulletOptions { position?: Vector2; velocity?: Vector2; ownerId?: number | null; ttl?: number; damage?: number; }
export class Bullet extends Entity {
  ownerId: number | null;
  ttl: number;
  damage: number;
  homing = false;
  constructor({ position = new Vector2(), velocity = new Vector2(), ownerId = null, ttl = 1.5, damage = 25 }: BulletOptions = {}) {
    super({ position, velocity, radius: 5, kind: 'bullet' });
    this.ownerId = ownerId;
    this.ttl = ttl;
    this.damage = damage;
  }
  override update(dt: number): void {
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) this.destroy();
  }
}
