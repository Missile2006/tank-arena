import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';
import { GameSimulation } from './game-simulation.ts';

export interface RoomOptions {
  readonly id: string;
  readonly name: string;
  readonly maxPlayers?: number;
  readonly asteroidCount?: number;
}
export interface RoomPlayer {
  readonly id: string;
  readonly name: string;
  socket?: WebSocket & { protocolMode?: 'binary' | 'json' };
}
interface RoomEventMap {
  playerJoined: [event: { roomId: string; player: RoomPlayer }];
  playerLeft: [event: { roomId: string; player: RoomPlayer }];
  empty: [event: { roomId: string }];
}
export class Room extends EventEmitter<RoomEventMap> {
  readonly id: string;
  readonly name: string;
  readonly maxPlayers: number;
  readonly asteroidCount: number;
  readonly players = new Map<string, RoomPlayer>();
  readonly simulation: GameSimulation;

  constructor({ id, name, maxPlayers = 4, asteroidCount = 6 }: RoomOptions) {
    super();
    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.asteroidCount = asteroidCount;
    this.simulation = new GameSimulation(this);
  }
  get playerCount(): number { return this.players.size; }
  get isFull(): boolean { return this.playerCount >= this.maxPlayers; }

  join(playerId: string, playerName: string): RoomPlayer {
    if (this.isFull) throw new Error('Room is full');
    if (this.players.has(playerId)) throw new Error('Player already joined');
    const player: RoomPlayer = { id: playerId, name: playerName };
    this.players.set(playerId, player);
    this.simulation.addPlayer(playerId);
    this.emit('playerJoined', { roomId: this.id, player });
    return player;
  }
  leave(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    this.players.delete(playerId);
    this.simulation.removePlayer(playerId);
    this.emit('playerLeft', { roomId: this.id, player });
    if (this.playerCount === 0) this.emit('empty', { roomId: this.id });
    return true;
  }
  toJSON() {
    return {
      id: this.id, name: this.name, players: this.playerCount,
      maxPlayers: this.maxPlayers,
      config: { width: 900, height: 550, asteroidCount: this.asteroidCount },
    };
  }
}
