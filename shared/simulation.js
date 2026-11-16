
export const TICK_RATE = 30;
export const FIXED_DT = 1 / TICK_RATE;

export const ACCELERATION = 220;
export const MAX_SPEED = 180;
export const ROTATION_SPEED = 2.8;
export const FRICTION = 0.97;

export function createShip(id, x = 450, y = 275) {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
  };
}

export function normalizeInput(input = {}) {
  return {
    thrust: Boolean(input.thrust),
    backward: Boolean(input.backward),
    left: Boolean(input.left),
    right: Boolean(input.right),
    fire: Boolean(input.fire),
    seq:
      Number.isSafeInteger(input.seq) && input.seq >= 0
        ? input.seq
        : 0,
  };
}

export function integrate(ship, rawInput, dt = FIXED_DT) {
  const input = normalizeInput(rawInput);

  if (input.left) {
    ship.angle -= ROTATION_SPEED * dt;
  }

  if (input.right) {
    ship.angle += ROTATION_SPEED * dt;
  }

  let movement = 0;

  if (input.thrust) {
    movement += 1;
  }

  if (input.backward) {
    movement -= 1;
  }

  const ax =
    Math.sin(ship.angle) * ACCELERATION * movement;

  const ay =
    -Math.cos(ship.angle) * ACCELERATION * movement;

  ship.vx += ax * dt;
  ship.vy += ay * dt;

  const damping = FRICTION ** (dt * 60);

  ship.vx *= damping;
  ship.vy *= damping;

  const speed = Math.hypot(ship.vx, ship.vy);

  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    ship.vx *= scale;
    ship.vy *= scale;
  }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  return ship;
}

export function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function random() {
    state =
      (Math.imul(1664525, state) + 1013904223) >>> 0;

    return state / 4294967296;
  };
}
