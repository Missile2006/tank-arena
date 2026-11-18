import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShip, integrate, createSeededRandom, FIXED_DT } from '../shared/simulation.ts';

function runSimulation() {
  const ship = createShip('test-player');
  const random = createSeededRandom(12345);
  for (let tick = 0; tick < 300; tick++) {
    integrate(ship, {
      thrust: random() > 0.3,
      backward: false,
      left: random() > 0.7,
      right: random() > 0.7,
      fire: false,
      seq: tick,
    }, FIXED_DT);
  }
  return ship;
}

test('TypeScript simulation preserves lab-05 result', () => {
  const actual = runSimulation();
  assert.deepEqual(actual, runSimulation());
  assert.deepEqual(actual, {
    id: 'test-player',
    x: 484.0008354485255,
    y: -509.22762990757036,
    vx: -28.98271884488611,
    vy: -71.1098275171751,
    angle: -0.2800000000000001,
  });
});
