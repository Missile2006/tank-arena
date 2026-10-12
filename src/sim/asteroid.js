
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export class Asteroid extends Entity {
  constructor({
    position = new Vector2(),
    radius = 30,
    hp = 50,
  } = {}) {
    super({
      position,
      velocity: new Vector2(0, 0),
      radius,
      kind: 'asteroid',
    });

    this.hp = hp;
  }

  // Перешкода отримує пошкодження
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);

    if (this.hp === 0) {
      this.destroy();
    }
  }

  // Поки що перешкода нерухома
  update(dt) {
    super.update(dt);
  }
}
