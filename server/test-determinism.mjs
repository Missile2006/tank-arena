import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createShip,
  integrate,
  createSeededRandom,
  FIXED_DT,
} from '../shared/simulation.js';

function runSimulation() {
  const ship = createShip('test-player');
  const random = createSeededRandom(12345);

  for (let tick = 0; tick < 300; tick++) {
    const input = {
      thrust: random() > 0.3,
      backward: false,
      left: random() > 0.7,
      right: random() > 0.7,
      fire: false,
      seq: tick,
    };

    integrate(ship, input, FIXED_DT);
  }

  return ship;
}

test('simulation is deterministic', () => {
  const first = runSimulation();
  const second = runSimulation();

  assert.deepEqual(first, second);
  assert.ok(Number.isFinite(first.x));
  assert.ok(Number.isFinite(first.y));

  console.log('Deterministic result:', first);
});
