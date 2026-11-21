import { randomUUID } from 'node:crypto';
import { Room } from './room.js';
import { config } from './config.js';

export interface CreateRoomOptions {
  readonly id?: string;
  readonly name: string;
  readonly maxPlayers?: number;
  readonly asteroidCount?: number;
  readonly persistent?: boolean;
}
export class RoomManager {
  readonly rooms = new Map<string, Room>();
  constructor() {
    this.createRoom({ id: 'arena-classic', name: 'Classic Arena', maxPlayers: 4, asteroidCount: 6, persistent: true });
    this.createRoom({ id: 'arena-survival', name: 'Survival Arena', maxPlayers: 2, asteroidCount: 12, persistent: true });
    this.createRoom({ id: 'arena-training', name: 'Training Arena', maxPlayers: 1, asteroidCount: 3, persistent: true });
  }
  createRoom({ id = randomUUID(), name, maxPlayers = 4, asteroidCount = 6, persistent = false }: CreateRoomOptions): Room {
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 50) throw new Error('Invalid room name');
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 16) throw new Error('Invalid maxPlayers');
    if (!Number.isInteger(asteroidCount) || asteroidCount < 0 || asteroidCount > 50) throw new Error('Invalid asteroidCount');
    if (typeof persistent !== 'boolean') throw new Error('Invalid persistent value');
    if (this.rooms.has(id)) throw new Error('Room already exists');
    if (this.rooms.size >= config.maxRooms) {
      throw Object.assign(new Error('Maximum number of rooms reached'), { statusCode: 429 });
    }
    if (maxPlayers > config.maxPlayersPerRoom) {
      throw Object.assign(new Error('Room player limit exceeded'), { statusCode: 400 });
    }
    const room = new Room({ id, name: name.trim(), maxPlayers, asteroidCount });
    room.on('empty', () => {
      if (persistent) { console.log(`Persistent room remains: ${room.name}`); return; }
      this.rooms.delete(room.id);
      console.log(`Room removed: ${room.name}`);
    });
    this.rooms.set(room.id, room);
    console.log(`Room created: ${room.name}`);
    return room;
  }
  getRoom(id: string): Room | undefined { return this.rooms.get(id); }
  listRooms() { return [...this.rooms.values()].map((room) => room.toJSON()); }
}


