import { Vector2 } from './vector.js';

export interface EntityOptions {
  position?: Vector2;
  velocity?: Vector2;
  radius?: number;
  kind?: string;
}

export class Entity {
  static #id = 0;
  readonly id: number;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  kind: string;
  dead = false;

  constructor({ position = new Vector2(), velocity = new Vector2(), radius = 10, kind = 'entity' }: EntityOptions = {}) {
    this.id = ++Entity.#id;
    this.position = position.clone();
    this.velocity = velocity.clone();
    this.radius = radius;
    this.kind = kind;
  }

  update(dt: number): void { this.position = this.position.add(this.velocity.scale(dt)); }
  destroy(): void { this.dead = true; }
}
