
import { Entity } from './entity';
import { Ship } from './ship.js';

export function demonstratePrototypes(): void {
  console.log('=== PROTOTYPE DEMO ===');

  const tank = new Ship(100, 100);

  // 1. РџРµСЂРµРІС–СЂСЏС”РјРѕ СѓСЃРїР°РґРєСѓРІР°РЅРЅСЏ
  console.log('Ship instance:', tank instanceof Ship);
  console.log('Entity instance:', tank instanceof Entity);

  // 2. РћС‚СЂРёРјСѓС”РјРѕ РїСЂРѕС‚РѕС‚РёРї РѕР±'С”РєС‚Р°
  const shipPrototype = Object.getPrototypeOf(tank);

  console.log(
    'Ship prototype:',
    shipPrototype === Ship.prototype,
  );

  // 3. РџРµСЂРµРІС–СЂСЏС”РјРѕ РЅР°СЃС‚СѓРїРЅРёР№ СЂС–РІРµРЅСЊ Р»Р°РЅС†СЋР¶РєР°
  const entityPrototype = Object.getPrototypeOf(shipPrototype);

  console.log(
    'Entity prototype:',
    entityPrototype === Entity.prototype,
  );

  // 4. РњРµС‚РѕРґ destroy() СѓСЃРїР°РґРєРѕРІР°РЅРёР№ РІС–Рґ Entity
  console.log('Before destroy:', tank.dead);

  tank.destroy();

  console.log('After destroy:', tank.dead);

  // 5. РџРµСЂРµРІС–СЂСЏС”РјРѕ РЅР°СЏРІРЅС–СЃС‚СЊ РјРµС‚РѕРґСѓ Сѓ РІР»Р°СЃРЅРёС… РІР»Р°СЃС‚РёРІРѕСЃС‚СЏС…
  console.log(
    'Own destroy method:',
    Object.hasOwn(tank, 'destroy'),
  );

  console.log(
    'Inherited destroy method:',
    typeof tank.destroy === 'function',
  );
}

