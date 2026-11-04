const EXPERIMENT_INTERVAL =
  new URLSearchParams(window.location.search).get('mode') === 'interval';

const EXPERIMENT_BUSY = new URLSearchParams(window.location.search).has('busy');

const EXPERIMENT_VARIABLE = new URLSearchParams(window.location.search).has(
  'variable',
);

function blockMainThread(milliseconds) {
  const start = performance.now();

  while (performance.now() - start < milliseconds) {
    // Навмисно блокуємо головний потік
  }
}

export function createLoop({ update, render }) {
  const STEP = 1 / 60;
  const MAX_FRAME_TIME = 0.25;

  let accumulator = 0;
  let lastTime = 0;
  let animationId = null;
  let running = false;
  let experimentFrame = 0;

  // Лічильники продуктивності
  let frameCount = 0;
  let stepCount = 0;
  let statsTime = 0;

  const stats = {
    fps: 0,
    stepsPerSecond: 0,
    frameTime: 0,
  };

  function frame(currentTime) {
    if (!running) return;

    experimentFrame++;

    if (EXPERIMENT_BUSY && experimentFrame % 60 === 0) {
      blockMainThread(100);
    }

    const elapsed = (currentTime - lastTime) / 1000;
    const delta = Math.min(elapsed, MAX_FRAME_TIME);

    lastTime = currentTime;
    accumulator += delta;

    let alpha;

    if (EXPERIMENT_VARIABLE) {
      // Експеримент: один крок фізики за кадр
      // з величиною dt, залежною від часу кадру
      update(delta);
      stepCount++;

      accumulator = 0;
      alpha = 1;
    } else {
      // Основний режим: фіксований крок 1/60 с
      while (accumulator >= STEP) {
        update(STEP);
        accumulator -= STEP;
        stepCount++;
      }

      alpha = accumulator / STEP;
    }

    // Статистика
    frameCount++;
    statsTime += elapsed;

    if (statsTime >= 1) {
      stats.fps = frameCount / statsTime;
      stats.stepsPerSecond = stepCount / statsTime;

      frameCount = 0;
      stepCount = 0;
      statsTime = 0;
    }

    stats.frameTime = elapsed * 1000;

    render(alpha, stats);

    if (!EXPERIMENT_INTERVAL) {
      animationId = requestAnimationFrame(frame);
    }
  }

  function start() {
    if (running) return;

    running = true;
    lastTime = performance.now();
    accumulator = 0;

    frameCount = 0;
    stepCount = 0;
    statsTime = 0;
    experimentFrame = 0;

    if (EXPERIMENT_INTERVAL) {
      animationId = setInterval(() => {
        frame(performance.now());
      }, 1000 / 60);
    } else {
      animationId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    running = false;

    if (animationId !== null) {
      if (EXPERIMENT_INTERVAL) {
        clearInterval(animationId);
      } else {
        cancelAnimationFrame(animationId);
      }

      animationId = null;
    }
  }

  return { start, stop };
}
