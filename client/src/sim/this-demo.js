
export function demonstrateThis() {
  console.log('=== THIS DEMO ===');

  // 1. Виклик методу об'єкта
  const tank = {
    name: 'Tank Arena',
    showName() {
      return this.name;
    },
  };

  console.log('Method:', tank.showName());

  // 2. Втрата this під час передачі методу
  const callback = tank.showName;

  try {
    console.log('Detached:', callback());
  } catch (error) {
    console.log('Detached error:', error.name);
  }

  // 3. Виправлення через bind()
  const boundCallback = tank.showName.bind(tank);
  console.log('Bind:', boundCallback());

  // 4. Явне встановлення this через call()
  console.log('Call:', tank.showName.call({ name: 'Other Tank' }));

  // 5. Стрілкова функція захоплює this із зовнішнього методу
  const controller = {
    name: 'Player Tank',

    createCallback() {
      return () => this.name;
    },
  };

  const arrowCallback = controller.createCallback();
  console.log('Arrow:', arrowCallback());
}
