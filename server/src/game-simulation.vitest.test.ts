import { describe, expect, it } from 'vitest';
import { GameSimulation } from './game-simulation.js';
import { createShip, integrate, FIXED_DT } from '../../shared/simulation.js';
import type { Room } from './room.js';

const ID = '12345678-1234-1234-1234-123456789abc';
const makeGame = () => new GameSimulation({ asteroidCount: 0 } as Room);

describe('server simulation', () => {
  it('adds and removes players', () => {
    const game = makeGame(); game.addPlayer(ID);
    expect(game.ships.has(ID)).toBe(true);
    game.removePlayer(ID); expect(game.ships.has(ID)).toBe(false);
  });
  it('ignores duplicate players', () => {
    const game = makeGame(); game.addPlayer(ID); game.addPlayer(ID);
    expect(game.ships.size).toBe(1);
  });
  it('rejects unknown players input', () => expect(makeGame().setInput(ID, { seq: 1 })).toBe(false));
  it('rejects duplicate input sequence', () => {
    const game = makeGame(); game.addPlayer(ID);
    expect(game.setInput(ID, { seq: 1, thrust: true })).toBe(true);
    expect(game.setInput(ID, { seq: 1, thrust: true })).toBe(false);
  });
  it('updates snapshot tick', () => {
    const game = makeGame(); game.update(); expect(game.getSnapshot().tick).toBe(1);
  });
  it('server step matches shared integrate exactly', () => {
    const game = makeGame(); game.addPlayer(ID);
    const expected = createShip(ID, 250, 275);
    const input = { seq: 1, thrust: true, left: true };
    expect(game.setInput(ID, input)).toBe(true);
    integrate(expected, input, FIXED_DT);
    game.update(FIXED_DT);
    const actual = game.ships.get(ID)!;
    for (const key of ['x', 'y', 'vx', 'vy', 'angle'] as const) expect(actual[key]).toBeCloseTo(expected[key], 10);
    expect(game.getSnapshot().players[0]?.lastProcessedSeq).toBe(1);
  });
  it('limits firing frequency', () => {
    const game = makeGame(); game.addPlayer(ID);
    game.fireBullet(ID); game.fireBullet(ID);
    expect(game.bullets.length).toBe(1);
    game.tick = 6; game.fireBullet(ID);
    expect(game.bullets.length).toBe(2);
  });
  it('rejects input queue overflow', () => {
    const game = makeGame(); game.addPlayer(ID);
    for (let i = 1; i <= 120; i++) expect(game.setInput(ID, { seq: i })).toBe(true);
    expect(game.setInput(ID, { seq: 121 })).toBe(false);
  });
  it('snapshot includes player state', () => {
    const game = makeGame(); game.addPlayer(ID);
    expect(game.getSnapshot().players[0]).toMatchObject({ id: ID, hp: 100, destroyed: false });
  });
});

describe('health pickups', () => {
  it('restores 25 HP and removes the pickup', () => {
    const game = makeGame();
    game.addPlayer(ID);

    const ship = game.ships.get(ID)!;
    const pickup = game.pickups[0]!;

    ship.hp = 50;
    ship.x = pickup.x;
    ship.y = pickup.y;

    game.checkPickupCollisions();

    expect(ship.hp).toBe(75);
    expect(game.pickups).toHaveLength(0);
  });

  it('does not heal above 100 HP', () => {
    const game = makeGame();
    game.addPlayer(ID);

    const ship = game.ships.get(ID)!;
    const pickup = game.pickups[0]!;

    ship.hp = 90;
    ship.x = pickup.x;
    ship.y = pickup.y;

    game.checkPickupCollisions();

    expect(ship.hp).toBe(100);
    expect(game.pickups).toHaveLength(0);
  });

  it('does not consume pickup at full health', () => {
    const game = makeGame();
    game.addPlayer(ID);

    const ship = game.ships.get(ID)!;
    const pickup = game.pickups[0]!;

    ship.hp = 100;
    ship.x = pickup.x;
    ship.y = pickup.y;

    game.checkPickupCollisions();

    expect(ship.hp).toBe(100);
    expect(game.pickups).toHaveLength(1);
  });

  it('respawns pickup after 10 seconds', () => {
    const game = makeGame();
    game.addPlayer(ID);

    const ship = game.ships.get(ID)!;
    const pickup = game.pickups[0]!;

    ship.hp = 50;
    ship.x = pickup.x;
    ship.y = pickup.y;

    game.checkPickupCollisions();

    expect(game.pickups).toHaveLength(0);

    game.tick = 299;
    game.checkPickupCollisions();

    expect(game.pickups).toHaveLength(0);

    game.tick = 300;
    game.checkPickupCollisions();

    expect(game.pickups).toHaveLength(1);
  });

  it('spawns pickup inside arena boundaries', () => {
    const game = makeGame();
    const pickup = game.pickups[0]!;

    expect(pickup.x).toBeGreaterThanOrEqual(50);
    expect(pickup.x).toBeLessThanOrEqual(850);

    expect(pickup.y).toBeGreaterThanOrEqual(50);
    expect(pickup.y).toBeLessThanOrEqual(500);
  });
});