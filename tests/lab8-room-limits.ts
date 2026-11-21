import assert from 'node:assert/strict';
import { RoomManager } from '../server/src/room-manager.ts';

// Run in a separate process with MAX_ROOMS=3, MAX_PLAYERS_PER_ROOM=4.
assert.equal(process.env.MAX_ROOMS, '3', 'Set MAX_ROOMS=3 before running');
assert.equal(process.env.MAX_PLAYERS_PER_ROOM, '4', 'Set MAX_PLAYERS_PER_ROOM=4 before running');
const manager = new RoomManager();
assert.equal(manager.rooms.size, 3);
assert.throws(() => manager.createRoom({ name: 'Extra room' }), (error: unknown) =>
  error instanceof Error && 'statusCode' in error && error.statusCode === 429,
);
assert.throws(() => manager.createRoom({ name: 'Oversized room', maxPlayers: 5 }), (error: unknown) =>
  error instanceof Error && 'statusCode' in error && error.statusCode === 429,
);
console.log('PASS room cap MAX_ROOMS=3');

// The max-player cap is tested through the running server in lab8-smoke.mjs.
