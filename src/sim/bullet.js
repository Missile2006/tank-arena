
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export class Bullet extends Entity {
  constructor({
    position = new Vector2(),
    velocity = new Vector2(),
    ownerId = null,
    ttl = 1.5,
    damage = 25,
  } = {}) {
    super({
      position,
      velocity,
      radius: 5,
      kind: 'bullet',
    });

    this.ownerId = ownerId;
    this.ttl = ttl;
    this.damage = damage;
  }

  update(dt) {
    // Викликаємо метод руху базового класу Entity
    super.update(dt);

    // Зменшуємо час існування кулі
    this.ttl -= dt;

    // Якщо час закінчився, позначаємо кулю як знищену
    if (this.ttl <= 0) {
      this.destroy();
    }
  }
}
