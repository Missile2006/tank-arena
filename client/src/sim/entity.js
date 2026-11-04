
import { Vector2 } from './vector.js';

export class Entity {
  static #id = 0;

  constructor({
    position = new Vector2(),
    velocity = new Vector2(),
    radius = 10,
    kind = 'entity',
  } = {}) {
    this.id = ++Entity.#id;

    this.position = position.clone();
    this.velocity = velocity.clone();

    this.radius = radius;
    this.kind = kind;
    this.dead = false;
  }

  update(dt) {
    this.position = this.position.add(this.velocity.scale(dt));
  }

  destroy() {
    this.dead = true;
  }
}
