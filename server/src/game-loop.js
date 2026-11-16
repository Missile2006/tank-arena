
import { performance } from "node:perf_hooks";
import {
  TICK_RATE,
  FIXED_DT,
} from "tank-arena-shared/simulation";

const STEP_MS = 1000 / TICK_RATE;

export function createGameLoop(onTick) {
  if (typeof onTick !== "function") {
    throw new TypeError("onTick must be a function");
  }

  let running = false;
  let timer = null;
  let nextTickTime = 0;
  let tick = 0;

  function scheduleNext() {
    if (!running) return;

    const delay = Math.max(
      0,
      nextTickTime - performance.now(),
    );

    timer = setTimeout(runTick, delay);
  }

  function runTick() {
    if (!running) return;

    const now = performance.now();

    if (now < nextTickTime) {
      scheduleNext();
      return;
    }

    try {
      onTick({
        tick,
        dt: FIXED_DT,
        time: now,
      });
    } catch (error) {
      stop();
      console.error("Game loop error:", error);
      return;
    }

    tick += 1;
    nextTickTime += STEP_MS;

    const currentTime = performance.now();

    // Якщо сервер сильно відстав, пропускаємо
    // прострочені часові слоти.
    if (currentTime - nextTickTime > STEP_MS * 5) {
      nextTickTime = currentTime + STEP_MS;
    }

    scheduleNext();
  }

  function start() {
    if (running) return;

    running = true;
    tick = 0;
    nextTickTime = performance.now() + STEP_MS;

    scheduleNext();
  }

  function stop() {
    running = false;

    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
    get running() {
      return running;
    },
    get tick() {
      return tick;
    },
  };
}
