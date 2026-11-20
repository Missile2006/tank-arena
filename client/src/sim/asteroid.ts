import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
export interface AsteroidOptions { position?: Vector2; radius?: number; hp?: number; }
export class Asteroid extends Entity {
  hp: number;
  speed: number;
  moveTime: number;
  constructor({ position = new Vector2(), radius = 30, hp = 50 }: AsteroidOptions = {}) {
    super({ position, velocity: new Vector2(), radius, kind: 'asteroid' });
    this.hp = hp;
    this.speed = 90 + Math.random() * 50;
    this.moveTime = Math.random() * Math.PI * 2;
  }
  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) this.destroy();
  }
  override update(dt: number): void { this.moveTime += dt; super.update(dt); }
}
