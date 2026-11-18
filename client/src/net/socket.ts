
import { decodeSnapshot } from 'tank-arena-shared/protocol';
import { NetworkSimulator } from './network-simulator.js';

type OutgoingMessage = { type: string; [key: string]: unknown };
type IncomingMessage = { type: string; id?: number; [key: string]: unknown };

function isIncomingMessage(value: unknown): value is IncomingMessage {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
}


export class GameSocket extends EventTarget {
    url: string;
  maxQueueSize: number;
  reconnectAttempts: number;
  maxReconnectDelay: number;
  shouldReconnect: boolean;

  networkSimulator: NetworkSimulator;

  networkStats: {
    bytesReceived: number;
    bytesPerSecond: number;
    rtt: number;
    lastSnapshotTime: number;
  };

  lastBytesCheck: number;
  bytesSinceLastCheck: number;

  pingSequence: number;
  pendingPings: Map<number, number>;
  lastPingTime: number;
  pingIntervalMs: number;
  socket: WebSocket | null;
  queue: string[];
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  roomId: string | null;
  playerName: string | null;
  constructor(url: string = '/ws') {
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

    this.networkSimulator = new NetworkSimulator();
    this.networkStats = {
      bytesReceived: 0,
      bytesPerSecond: 0,
      lastSnapshotTime: 0,
      rtt: 0,
    };

    this.lastBytesCheck = performance.now();
    this.bytesSinceLastCheck = 0;
    this.pingSequence = 0;
    this.pendingPings = new Map<number, number>();
    this.lastPingTime = 0;
    this.pingIntervalMs = 2000;
  }

  isJoined = false;

  connect(roomId: string, playerName: string): void {
    this.roomId = roomId;
    this.playerName = playerName;

    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    this.openConnection();
  }

  openConnection(): void {
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

    // Отримуємо бінарні повідомлення як ArrayBuffer
    socket.binaryType = 'arraybuffer';

    this.socket = socket;

    socket.addEventListener('open', () => {
      if (socket !== this.socket) return;

      this.reconnectAttempts = 0;

      const requestedProtocol = new URLSearchParams(
        window.location.search,
      ).get('protocol');

      const protocolMode =
        requestedProtocol === 'binary' ? 'binary' : 'json';

      socket.send(
        JSON.stringify({
          type: 'join',
          roomId: this.roomId,
          playerName: this.playerName,
          protocolMode,
        }),
      );

      this.dispatchEvent(new Event('connected'));
    });

    socket.addEventListener('message', (event) => {
      if (socket !== this.socket) return;
      const messageBytes =
        event.data instanceof ArrayBuffer
          ? event.data.byteLength
          : new TextEncoder().encode(event.data).byteLength;

      this.networkStats.bytesReceived += messageBytes;
      this.bytesSinceLastCheck += messageBytes;

      const now = performance.now();
      const elapsed = now - this.lastBytesCheck;

      if (elapsed >= 1000) {
        this.networkStats.bytesPerSecond =
          (this.bytesSinceLastCheck * 1000) / elapsed;

        this.bytesSinceLastCheck = 0;
        this.lastBytesCheck = now;
      }

      let decoded: unknown;

      try {
        if (event.data instanceof ArrayBuffer) {
          // Декодування бінарного snapshot
          decoded = decodeSnapshot(event.data);
        } else {
          // Звичайні JSON-повідомлення
          decoded = JSON.parse(event.data);
        }
      } catch (error) {
        console.error('Message decoding error:', error);
        return;
      }

      if (!isIncomingMessage(decoded)) {
        console.warn('Ignoring invalid server message');
        return;
      }
      const message = decoded;

      if (message.type === 'joined') {
        this.flushQueue();
      }
      if (message.type === 'pong') {
        const sentAt =
          typeof message.id === 'number'
            ? this.pendingPings.get(message.id)
            : undefined;

        if (sentAt !== undefined) {
          const measuredRtt = performance.now() - sentAt;

          this.networkStats.rtt =
            this.networkStats.rtt === 0
              ? measuredRtt
              : this.networkStats.rtt * 0.8 + measuredRtt * 0.2;

          if (typeof message.id === 'number') {
            this.pendingPings.delete(message.id);
          }
        }

        return;
      }

      const deliverMessage = () => {
        if (socket !== this.socket) return;

        this.dispatchEvent(
          new CustomEvent('message', {
            detail: message,
          }),
        );
      };

      if (message.type === 'snapshot') {
        this.networkSimulator.receive(() => {
          this.networkStats.lastSnapshotTime = performance.now();
          deliverMessage();
        });
      } else {
        deliverMessage();
      }
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

  send(message: OutgoingMessage): void {
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

  flushQueue(): void {
    this.isJoined = true;

    while (
      this.queue.length > 0 &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      const next = this.queue.shift();
      if (next !== undefined) this.socket.send(next);
    }
  }

  scheduleReconnect(): void {
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
  updatePing(): void {
    if (
      !this.isJoined ||
      this.socket?.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const now = performance.now();

    if (now - this.lastPingTime < this.pingIntervalMs) {
      return;
    }

    this.lastPingTime = now;
    this.pingSequence++;

    // Не накопичуємо застарілі запити
    this.pendingPings.clear();
    this.pendingPings.set(this.pingSequence, now);

    this.socket.send(
      JSON.stringify({
        type: 'ping',
        id: this.pingSequence,
      }),
    );
  }
  getNetworkStats() {
    const simulatorStats = this.networkSimulator.getStats();

    return {
      ...this.networkStats,
      ...simulatorStats,
      snapshotAge: this.networkStats.lastSnapshotTime
        ? performance.now() - this.networkStats.lastSnapshotTime
        : 0,
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.isJoined = false;

    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    this.queue = [];

    if (this.socket) {
      this.socket.close(1000, 'Client disconnected');
      this.socket = null;
      this.isJoined = false;
    }
  }
}
