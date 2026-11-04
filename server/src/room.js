
import { EventEmitter } from 'node:events';

export class Room extends EventEmitter {
  constructor({ id, name, maxPlayers = 4, asteroidCount = 6 }) {
    super();

    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.asteroidCount = asteroidCount;

    // Гравці кімнати
    this.players = new Map();
  }

  // Кількість гравців
  get playerCount() {
    return this.players.size;
  }

  // Чи є вільне місце
  get isFull() {
    return this.playerCount >= this.maxPlayers;
  }

  // Додавання гравця
  join(playerId, playerName) {
    if (this.isFull) {
      throw new Error('Room is full');
    }

    if (this.players.has(playerId)) {
      throw new Error('Player already joined');
    }

    const player = {
      id: playerId,
      name: playerName,
    };

    this.players.set(playerId, player);

    this.emit('playerJoined', {
      roomId: this.id,
      player,
    });

    return player;
  }

  // Видалення гравця
  leave(playerId) {
    const player = this.players.get(playerId);

    if (!player) {
      return false;
    }

    this.players.delete(playerId);

    this.emit('playerLeft', {
      roomId: this.id,
      player,
    });

    // Повідомлення про порожню кімнату
    if (this.playerCount === 0) {
      this.emit('empty', {
        roomId: this.id,
      });
    }

    return true;
  }

  // Дані кімнати для API
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      players: this.playerCount,
      maxPlayers: this.maxPlayers,
      config: {
        width: 900,
        height: 550,
        asteroidCount: this.asteroidCount,
      },
    };
  }
}
