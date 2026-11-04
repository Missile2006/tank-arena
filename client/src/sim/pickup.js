
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export class Pickup extends Entity {
  constructor({
    position = new Vector2(),
    radius = 15,
    effect = () => {},
  } = {}) {
    super({
      position,
      velocity: new Vector2(),
      radius,
      kind: 'pickup',
    });

    // Дія бонусу передається ззовні
    this.effect = effect;
  }

  collect(ship) {
    if (this.dead || ship.dead) {
      return;
    }

    // Виконуємо дію бонусу
    this.effect(ship);

    // Після підбирання бонус зникає
    this.destroy();
  }
}

// Функція створення аптечки
export function createHealthPickup(position, amount = 25) {
  return new Pickup({
    position,

    effect: (ship) => {
      ship.heal(amount);
    },
  });
}
