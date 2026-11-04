
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

    // Здоров'я астероїда
    this.hp = hp;

    // Індивідуальна швидкість руху
    this.speed = 90 + Math.random() * 50;

    // Час для невеликого коливання руху
    this.moveTime = Math.random() * Math.PI * 2;
  }

  // Отримання пошкоджень від куль
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);

    if (this.hp === 0) {
      this.destroy();
    }
  }

  // Рух астероїда
  update(dt) {
    this.moveTime += dt;

    super.update(dt);
  }
}
