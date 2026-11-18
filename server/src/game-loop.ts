import { performance } from 'node:perf_hooks';
import { TICK_RATE, FIXED_DT } from 'tank-arena-shared/simulation';

const STEP_MS = 1000 / TICK_RATE;
export interface TickEvent {
  readonly tick: number;
  readonly dt: number;
  readonly time: number;
}
export interface GameLoop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  readonly tick: number;
}

export function createGameLoop(onTick: (event: TickEvent) => void): GameLoop {
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let nextTickTime = 0;
  let tick = 0;

  function scheduleNext(): void {
    if (!running) return;
    const delay = Math.max(0, nextTickTime - performance.now());
    timer = setTimeout(runTick, delay);
  }

  function runTick(): void {
    if (!running) return;
    const now = performance.now();
    if (now < nextTickTime) {
      scheduleNext();
      return;
    }
    try {
      onTick({ tick, dt: FIXED_DT, time: now });
    } catch (error: unknown) {
      stop();
      console.error('Game loop error:', error);
      return;
    }
    tick += 1;
    nextTickTime += STEP_MS;
    const currentTime = performance.now();
    if (currentTime - nextTickTime > STEP_MS * 5) {
      nextTickTime = currentTime + STEP_MS;
    }
    scheduleNext();
  }

  function start(): void {
    if (running) return;
    running = true;
    tick = 0;
    nextTickTime = performance.now() + STEP_MS;
    scheduleNext();
  }

  function stop(): void {
    running = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { start, stop, get running() { return running; }, get tick() { return tick; } };
}
