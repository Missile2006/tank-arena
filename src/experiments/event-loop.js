
export function runEventLoopExperiments() {
  // Експеримент №1
  console.log('=== Experiment 1: Promise vs setTimeout ===');

  console.log('A: synchronous start');

  setTimeout(() => {
    console.log('D: setTimeout callback');
  }, 0);

  Promise.resolve().then(() => {
    console.log('C: Promise microtask');
  });

  console.log('B: synchronous end');

  // Експеримент №2 запускаємо окремим таймером
  // із затримкою, щоб результати не змішувалися
  setTimeout(() => {
    console.log('=== Experiment 2: async/await ===');

    async function testAsync() {
      console.log('1: async start');

      await Promise.resolve();

      console.log('3: after await');
    }

    console.log('0: before async');

    testAsync();

    Promise.resolve().then(() => {
      console.log('4: Promise.then');
    });

    console.log('2: synchronous end');
  }, 1000);

  
  // Експеримент №3: таймер усередині Promise
  setTimeout(() => {
    console.log('=== Experiment 3: Timer inside Promise ===');

    console.log('A: synchronous start');

    Promise.resolve().then(() => {
      console.log('C: first microtask');

      setTimeout(() => {
        console.log('E: timer inside Promise');
      }, 0);

      Promise.resolve().then(() => {
        console.log('D: nested microtask');
      });
    });

    setTimeout(() => {
      console.log('F: outer timer');
    }, 0);

    console.log('B: synchronous end');
  }, 2000);

  
  
  // Експеримент №4: requestAnimationFrame та Promise
  setTimeout(() => {
    console.log('=== Experiment 4: requestAnimationFrame ===');

    console.log('A: synchronous start');

    let frameExecuted = false;

    requestAnimationFrame(() => {
      frameExecuted = true;

      console.log('D: animation frame');

      Promise.resolve().then(() => {
        console.log('E: microtask inside rAF');
      });
    });

    Promise.resolve().then(() => {
      console.log('C: Promise microtask');
    });

    console.log('B: synchronous end');

    // Перевірка, чи браузер виконав callback
    setTimeout(() => {
      if (!frameExecuted) {
        console.warn(
          'requestAnimationFrame has not executed yet. Check tab visibility.',
        );
      }
    }, 1000);
  }, 3000);

  
  // Експеримент №5: async/await, Promise та setTimeout
  setTimeout(() => {
    console.log('=== Experiment 5: Mixed async operations ===');

    async function asyncTask() {
      console.log('B: async function started');

      await Promise.resolve();

      console.log('E: after await');

      setTimeout(() => {
        console.log('G: timer inside async');
      }, 0);
    }

    console.log('A: synchronous start');

    asyncTask();

    Promise.resolve().then(() => {
      console.log('F: Promise.then microtask');
    });

    setTimeout(() => {
      console.log('H: outer timer');
    }, 0);

    console.log('C: synchronous end');
  }, 4000);

}
