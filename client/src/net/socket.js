
export class GameSocket extends EventTarget {
  constructor(url = '/ws') {
    super();

    this.url = url;
    this.socket = null;

    this.queue = [];
    this.maxQueueSize = 100;

    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;

    this.reconnectTimer = null;
    this.shouldReconnect = false;

    this.roomId = null;
    this.playerName = null;
  }

  connect(roomId, playerName) {
    this.roomId = roomId;
    this.playerName = playerName;

    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    this.openConnection();
  }

  openConnection() {
    if (!this.shouldReconnect) {
      return;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol =
      window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    const url = new URL(this.url, window.location.href);
    url.protocol = protocol;

    this.isJoined = false;

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (socket !== this.socket) return;

      this.reconnectAttempts = 0;

      // Першим повідомленням завжди надсилаємо join
      socket.send(
        JSON.stringify({
          type: 'join',
          roomId: this.roomId,
          playerName: this.playerName,
        }),
      );

      this.dispatchEvent(new Event('connected'));
    });

    socket.addEventListener('message', (event) => {
      if (socket !== this.socket) return;

      let message;

      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === 'joined') {
        this.flushQueue();
      }

      this.dispatchEvent(
        new CustomEvent('message', {
          detail: message,
        }),
      );
    });

    socket.addEventListener('close', (event) => {
      if (socket !== this.socket) return;

      this.socket = null;

      this.dispatchEvent(
        new CustomEvent('disconnected', {
          detail: {
            code: event.code,
            reason: event.reason,
          },
        }),
      );

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    socket.addEventListener('error', () => {
      if (socket !== this.socket) return;

      this.dispatchEvent(new Event('error'));
    });
  }

  send(message) {
    const serialized = JSON.stringify(message);

    if (
      this.socket?.readyState === WebSocket.OPEN &&
      this.isJoined
    ) {
      this.socket.send(serialized);
      return;
    }

    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }

    this.queue.push(serialized);
  }

  flushQueue() {
    this.isJoined = true;

    while (
      this.queue.length > 0 &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      this.socket.send(this.queue.shift());
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldReconnect) {
      return;
    }

    const delay = Math.min(
      1000 * 2 ** this.reconnectAttempts,
      this.maxReconnectDelay,
    );

    this.reconnectAttempts++;

    this.dispatchEvent(
      new CustomEvent('reconnecting', {
        detail: { delay },
      }),
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.isJoined = false;
      this.openConnection();
    }, delay);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.isJoined = false;

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    this.queue = [];

    if (this.socket) {
      this.socket.close(1000, 'Client disconnected');
      this.socket = null;
      this.isJoined = false;
    }
  }
}
