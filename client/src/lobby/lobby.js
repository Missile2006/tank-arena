
import { fetchJson } from '../assets/loader.js';

export class Lobby extends EventTarget {
  constructor() {
    super();

    this.rooms = [];
    this.refreshTimer = null;
    this.requestController = null;
    this.visible = false;
  }

  // Завантаження списку кімнат із Node.js-сервера
  async loadRooms() {
    // Скасовуємо попередній запит
    this.requestController?.abort();

    const controller = new AbortController();
    this.requestController = controller;

    // Обмежуємо час очікування до 5 секунд
    const timeoutSignal = AbortSignal.timeout(5000);

    const signal = AbortSignal.any([
      controller.signal,
      timeoutSignal,
    ]);

    try {
      // Отримуємо кімнати через Vite proxy
      const data = await fetchJson('/api/rooms', signal);

      // Не оновлюємо приховане лобі
      if (!this.visible || controller.signal.aborted) {
        return;
      }

      // Node.js повертає масив кімнат напряму
      if (!Array.isArray(data)) {
        throw new Error(
          'Сервер повернув неправильний список кімнат',
        );
      }

      this.rooms = data;

      // Повідомляємо інтерфейс про оновлення
      this.dispatchEvent(
        new CustomEvent('roomsUpdated', {
          detail: {
            rooms: this.rooms,
          },
        }),
      );
    } catch (error) {
      if (controller.signal.aborted || !this.visible) {
        return;
      }

      this.dispatchEvent(
        new CustomEvent('error', {
          detail: {
            message: error.message,
          },
        }),
      );
    } finally {
      if (this.requestController === controller) {
        this.requestController = null;
      }
    }
  }

  // Відображення лобі
  show() {
    if (this.visible) {
      return;
    }

    this.visible = true;

    // Одразу отримуємо кімнати
    this.loadRooms();

    // Оновлюємо список кожні 10 секунд
    this.refreshTimer = setInterval(() => {
      this.loadRooms();
    }, 10000);
  }

  // Приховування лобі
  hide() {
    this.visible = false;

    clearInterval(this.refreshTimer);
    this.refreshTimer = null;

    // Скасовуємо незавершений запит
    this.requestController?.abort();
    this.requestController = null;
  }

  // Вибір кімнати та вхід у гру
  join(playerName, roomId) {
    const name = playerName.trim();

    if (!name) {
      throw new Error("Введіть ім'я гравця");
    }

    if (name.length > 30) {
      throw new Error(
        "Ім'я гравця не повинно перевищувати 30 символів",
      );
    }

    // Шукаємо вибрану кімнату
    const room = this.rooms.find(
      (item) => String(item.id) === String(roomId),
    );

    if (!room) {
      throw new Error('Виберіть доступну кімнату');
    }

    if (room.players >= room.maxPlayers) {
      throw new Error('Ця кімната вже заповнена');
    }

    // Приховуємо лобі після вибору кімнати
    this.hide();

    // Передаємо інформацію головному модулю гри
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
