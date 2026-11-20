
export function demonstrateThis(): void {
  console.log('=== THIS DEMO ===');

  // 1. Р’РёРєР»РёРє РјРµС‚РѕРґСѓ РѕР±'С”РєС‚Р°
  const tank = {
    name: 'Tank Arena',
    showName(this: { name: string }) {
      return this.name;
    },
  };

  console.log('Method:', tank.showName());

  // 2. Р’С‚СЂР°С‚Р° this РїС–Рґ С‡Р°СЃ РїРµСЂРµРґР°С‡С– РјРµС‚РѕРґСѓ
  const callback = tank.showName;

  try {
    console.log('Detached:', callback.call(undefined as unknown as { name: string }));
  } catch (error) {
    console.log('Detached error:', error instanceof Error ? error.name : String(error));
  }

  // 3. Р’РёРїСЂР°РІР»РµРЅРЅСЏ С‡РµСЂРµР· bind()
  const boundCallback = tank.showName.bind(tank);
  console.log('Bind:', boundCallback());

  // 4. РЇРІРЅРµ РІСЃС‚Р°РЅРѕРІР»РµРЅРЅСЏ this С‡РµСЂРµР· call()
  console.log('Call:', tank.showName.call({ name: 'Other Tank' }));

  // 5. РЎС‚СЂС–Р»РєРѕРІР° С„СѓРЅРєС†С–СЏ Р·Р°С…РѕРїР»СЋС” this С–Р· Р·РѕРІРЅС–С€РЅСЊРѕРіРѕ РјРµС‚РѕРґСѓ
  const controller = {
    name: 'Player Tank',

    createCallback() {
      return () => this.name;
    },
  };

  const arrowCallback = controller.createCallback();
  console.log('Arrow:', arrowCallback());
}

