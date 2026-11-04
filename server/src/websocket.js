
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

const MAX_MESSAGE_BYTES = 4096;
const MAX_MESSAGES_PER_SECOND = 20;
const MAX_BUFFERED_BYTES = 1024 * 1024;

function sendJson(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  // Не накопичуємо повідомлення у повільного клієнта
  if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function broadcast(room, message) {
  for (const player of room.players.values()) {
    if (player.socket) {
      sendJson(player.socket, message);
    }
  }
}

export function setupWebSocket(server, roomManager, eventLogger) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: MAX_MESSAGE_BYTES,
  });

  wss.on('connection', (socket) => {
    const playerId = randomUUID();

    let currentRoom = null;
    let joined = false;

    let messagesThisSecond = 0;
    let missedPongs = 0;

    // Гравець повинен увійти протягом 5 секунд
    const joinTimeout = setTimeout(() => {
      if (!joined) {
        socket.close(1008, 'Join timeout');
      }
    }, 5000);

    // Обмеження кількості повідомлень
    const rateTimer = setInterval(() => {
      messagesThisSecond = 0;
    }, 1000);

    // Перевірка активності клієнта
    const pingTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }

      if (missedPongs >= 2) {
        socket.terminate();
        return;
      }

      missedPongs++;
      socket.ping();
    }, 15000);

    socket.on('pong', () => {
      missedPongs = 0;
    });

    socket.on('message', (raw, isBinary) => {
      messagesThisSecond++;

      if (messagesThisSecond > MAX_MESSAGES_PER_SECOND) {
        socket.close(1008, 'Rate limit exceeded');
        return;
      }

      if (isBinary || raw.length > MAX_MESSAGE_BYTES) {
        socket.close(1009, 'Invalid message size');
        return;
      }

      let message;

      try {
        message = JSON.parse(raw.toString('utf8'));
      } catch {
        socket.close(1007, 'Invalid JSON');
        return;
      }

      if (
        !message ||
        typeof message !== 'object' ||
        Array.isArray(message) ||
        typeof message.type !== 'string'
      ) {
        socket.close(1008, 'Invalid message format');
        return;
      }

      // Вхід у кімнату
      if (message.type === 'join') {
        if (
          joined ||
          typeof message.roomId !== 'string' ||
          typeof message.playerName !== 'string' ||
          message.playerName.trim().length === 0 ||
          message.playerName.length > 30
        ) {
          socket.close(1008, 'Invalid join');
          return;
        }

        const room = roomManager.getRoom(message.roomId);

        if (!room || room.isFull) {
          sendJson(socket, {
            type: 'error',
            message: 'Room unavailable or full',
          });

          socket.close(1008, 'Room unavailable');
          return;
        }

        const playerName = message.playerName.trim();

        // Зберігаємо WebSocket разом із гравцем
        room.join(playerId, playerName);

        const player = room.players.get(playerId);
        player.socket = socket;

        currentRoom = room;
        joined = true;

        clearTimeout(joinTimeout);

        sendJson(socket, {
          type: 'joined',
          playerId,
          room: room.toJSON(),
        });

        broadcast(room, {
          type: 'players',
          players: [...room.players.values()].map(
            (item) => ({
              id: item.id,
              name: item.name,
            }),
          ),
        });
        eventLogger.log('join', {
            playerId,
            playerName,
            roomId: room.id,
        });

        console.log(
          `${playerName} joined ${room.name}`,
        );

        return;
      }

      // Чат
      if (message.type === 'chat') {
        if (
          !joined ||
          !currentRoom ||
          typeof message.text !== 'string' ||
          message.text.trim().length === 0 ||
          message.text.length > 500
        ) {
          socket.close(1008, 'Invalid chat message');
          return;
        }

        const player = currentRoom.players.get(playerId);

        broadcast(currentRoom, {
          type: 'chat',
          playerId,
          playerName: player.name,
          text: message.text.trim(),
          timestamp: Date.now(),
        });

        eventLogger.log('chat', {
            playerId,
            playerName: player.name,
            roomId: currentRoom.id,
            text: message.text.trim(),
        });

        return;
      }

      // Невідомий тип повідомлення
      socket.close(1008, 'Unknown message type');
    });

    socket.on('close', () => {
      clearTimeout(joinTimeout);
      clearInterval(rateTimer);
      clearInterval(pingTimer);

      if (currentRoom) {
        const player = currentRoom.players.get(playerId);

        eventLogger.log('leave', {
            playerId,
            playerName: player?.name ?? 'Unknown',
            roomId: currentRoom.id,
        });

        currentRoom.leave(playerId);

        broadcast(currentRoom, {
          type: 'players',
          players: [...currentRoom.players.values()].map(
            (item) => ({
              id: item.id,
              name: item.name,
            }),
          ),
        });

        console.log(
          `${player?.name ?? playerId} disconnected`,
        );
      }
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  return wss;
}
