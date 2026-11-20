import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
import type { Ship } from './ship.js';

export interface PickupOptions { position?: Vector2; radius?: number; effect?: (ship: Ship) => void; }
export class Pickup extends Entity {
  effect: (ship: Ship) => void;
  constructor({
    position = new Vector2(),
    radius = 15,
    effect = () => {},
  }: PickupOptions = {}) {
    super({
      position,
      velocity: new Vector2(),
      radius,
      kind: 'pickup',
    });

    // Дія бонусу передається ззовні
    this.effect = effect;
  }

  collect(ship: Ship): void {
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
export function createHealthPickup(position: Vector2, amount = 25): Pickup {
  return new Pickup({
    position,

    effect: (ship) => {
      ship.heal(amount);
    },
  });
}
