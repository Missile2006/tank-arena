
import { fetchJson } from '../assets/loader.js';

export class Lobby extends EventTarget {
  constructor() {
    super();

    this.rooms = [];
    this.refreshTimer = null;
    this.requestController = null;
    this.visible = false;
  }

  // Завантаження списку кімнат
  async loadRooms() {
    this.requestController?.abort();

    const controller = new AbortController();
    this.requestController = controller;

    const timeoutSignal = AbortSignal.timeout(5000);

    const signal = AbortSignal.any([
      controller.signal,
      timeoutSignal,
    ]);

    try {
      const data = await fetchJson('/api/rooms.json', signal);

      if (!this.visible || controller.signal.aborted) {
        return;
      }

      this.rooms = data.rooms;

      this.dispatchEvent(
        new CustomEvent('roomsUpdated', {
          detail: { rooms: this.rooms },
        }),
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      this.dispatchEvent(
        new CustomEvent('error', {
          detail: { message: error.message },
        }),
      );
    }
  }

  // Показ лобі та періодичне оновлення кімнат
  show() {
    if (this.visible) return;

    this.visible = true;

    this.loadRooms();

    this.refreshTimer = setInterval(() => {
      this.loadRooms();
    }, 10000);
  }

  // Приховування лобі
  hide() {
    this.visible = false;

    clearInterval(this.refreshTimer);
    this.refreshTimer = null;

    this.requestController?.abort();
    this.requestController = null;
  }

  // Приєднання до вибраної кімнати
  join(playerName, roomId) {
    const name = playerName.trim();

    if (!name) {
      throw new Error("Введіть ім'я гравця");
    }

    const room = this.rooms.find(
      (item) => String(item.id) === String(roomId),
    );

    if (!room) {
      throw new Error('Виберіть доступну кімнату');
    }

    this.hide();

    this.dispatchEvent(
      new CustomEvent('joined', {
        detail: {
          playerName: name,
          room,
        },
      }),
    );
  }
}
