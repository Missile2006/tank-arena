
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { parseClientMessage } from '../../shared/messages.ts';

const MAX_MESSAGE_BYTES = 4096;
const MAX_MESSAGES_PER_SECOND = 60;
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

      // JSON.parse returns untrusted data. Zod validates the complete shape.
      let rawMessage;
      try {
        rawMessage = JSON.parse(raw.toString('utf8'));
      } catch (error) {
        console.warn('Invalid JSON received:', error instanceof Error ? error.message : String(error));
        socket.close(1007, 'Invalid JSON');
        return;
      }

      let message;
      try {
        message = parseClientMessage(rawMessage);
      } catch (error) {
        console.warn('Invalid client message:', error instanceof Error ? error.message : String(error));
        socket.close(1008, 'Invalid message format');
        return;
      }

      if (message.type === 'ping') {
        if (!joined) {
          return;
        }

        sendJson(socket, {
          type: 'pong',
          id: message.id,
        });

        return;
      }

      // Вхід у кімнату
      if (message.type === 'join') {
        if (
          joined
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

        // Режим передавання ігрових snapshot
        socket.protocolMode =
          message.protocolMode === 'binary' ? 'binary' : 'json';

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
          !currentRoom
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


      // Команди керування кораблем
      if (message.type === 'input') {
        if (
          !joined ||
          !currentRoom
        ) {
          socket.close(1008, 'Invalid input');
          return;
        }

        const accepted = currentRoom.simulation.setInput(
          playerId,
          {
            seq: message.seq,
            thrust: message.thrust,
            backward: message.backward,
            left: message.left,
            right: message.right,
            fire: message.fire,
          },
        );

        if (!accepted) {
          return;
        }

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
