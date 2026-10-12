
import { Entity } from './entity.js';
import { Ship } from './ship.js';

export function demonstratePrototypes() {
  console.log('=== PROTOTYPE DEMO ===');

  const tank = new Ship(100, 100);

  // 1. Перевіряємо успадкування
  console.log('Ship instance:', tank instanceof Ship);
  console.log('Entity instance:', tank instanceof Entity);

  // 2. Отримуємо прототип об'єкта
  const shipPrototype = Object.getPrototypeOf(tank);

  console.log(
    'Ship prototype:',
    shipPrototype === Ship.prototype,
  );

  // 3. Перевіряємо наступний рівень ланцюжка
  const entityPrototype = Object.getPrototypeOf(shipPrototype);

  console.log(
    'Entity prototype:',
    entityPrototype === Entity.prototype,
  );

  // 4. Метод destroy() успадкований від Entity
  console.log('Before destroy:', tank.dead);

  tank.destroy();

  console.log('After destroy:', tank.dead);

  // 5. Перевіряємо наявність методу у власних властивостях
  console.log(
    'Own destroy method:',
    Object.hasOwn(tank, 'destroy'),
  );

  console.log(
    'Inherited destroy method:',
    typeof tank.destroy === 'function',
  );
}
