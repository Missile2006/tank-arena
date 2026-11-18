
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { config } from './config.ts';
import { RoomManager } from './room-manager.ts';
import { setupWebSocket } from './websocket.ts';
import { createEventLogger } from './logger.js';
import { createGameLoop } from './game-loop.ts';
import { encodeSnapshot } from 'tank-arena-shared/protocol';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

const clientDistDir = path.resolve(
  serverDir,
  '../../client/dist',
);

const roomManager = new RoomManager();
const eventLogger = createEventLogger(config.logDir);


const gameLoop = createGameLoop(({ tick, dt }) => {
  for (const room of roomManager.rooms.values()) {
    if (!room.simulation || room.playerCount === 0) {
      continue;
    }

    room.simulation.update(dt);

    const snapshot = room.simulation.getSnapshot();

    // Підготовка двох форматів одного стану гри
    const jsonData = JSON.stringify(snapshot);
    const binaryData = encodeSnapshot(snapshot);

    for (const player of room.players.values()) {
      const socket = player.socket;

      if (
        !socket ||
        socket.readyState !== 1 ||
        socket.bufferedAmount >= 1024 * 1024
      ) {
        continue;
      }

      // Поки що JSON використовується за замовчуванням
      const useBinary = socket.protocolMode === 'binary';

      if (useBinary) {
        socket.send(binaryData, { binary: true });
      } else {
        socket.send(jsonData);
      }
    }
  }

  if (tick > 0 && tick % 300 === 0) {
    console.log(`Game loop tick: ${tick}`);
  }
});

console.log('Event log:', eventLogger.logPath);

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify(data));
}


const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

async function serveStaticFile(req, res, pathname) {
  if (/%2f|%5c/i.test(pathname)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let decodedPath;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(res, 400, { error: 'Invalid path' });
    return;
  }
  if (
    decodedPath.includes('\0') ||
    decodedPath.includes('\\') ||
    decodedPath.split('/').includes('..')
  ) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  const requestedPath =
    decodedPath === '/' ? '/index.html' : decodedPath;

  const filePath = path.resolve(
    clientDistDir,
    `.${requestedPath}`,
  );

  const relativePath = path.relative(clientDistDir, filePath);

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileHandle;

  try {
    fileHandle = await fs.promises.open(filePath, 'r');
    const stats = await fileHandle.stat();

    if (!stats.isFile()) {
      await fileHandle.close();
      sendJson(res, 404, { error: 'File not found' });
      return;
    }

    // Не дозволяємо читати файл через символічне посилання
    const realRoot = await fs.promises.realpath(clientDistDir);
    const realFile = await fs.promises.realpath(filePath);
    const realRelative = path.relative(realRoot, realFile);

    if (
      realRelative === '..' ||
      realRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(realRelative)
    ) {
      await fileHandle.close();
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    const contentType =
      mimeTypes[path.extname(filePath).toLowerCase()] ??
      'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    });

    await pipeline(
      fileHandle.createReadStream({ autoClose: true }),
      res,
    );
  } catch (error) {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
    }

    if (res.headersSent) {
      res.destroy();
      return;
    }

    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      sendJson(res, 404, { error: 'File not found' });
      return;
    }

    console.error('Static file error:', error.message);
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
}

// Читаємо JSON із POST-запиту
async function readJsonBody(req) {
  const chunks = [];
  let totalSize = 0;

  for await (const chunk of req) {
    totalSize += chunk.length;

    if (totalSize > 10_240) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  try {
    return JSON.parse(
      Buffer.concat(chunks).toString('utf8'),
    );
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url,
      `http://${req.headers.host ?? 'localhost'}`,
    );

    // Перевірка стану сервера
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'tank-arena-server',
        uptime: process.uptime(),
      });

      return;
    }

    // Отримання списку кімнат
    if (
      req.method === 'GET' &&
      url.pathname === '/api/rooms'
    ) {
      sendJson(res, 200, roomManager.listRooms());
      return;
    }

    // Створення нової кімнати
    if (
      req.method === 'POST' &&
      url.pathname === '/api/rooms'
    ) {
      const body = await readJsonBody(req);

      const room = roomManager.createRoom({
        name: body.name,
        maxPlayers: body.maxPlayers ?? 4,
        asteroidCount: body.asteroidCount ?? 6,
      });

      sendJson(res, 201, room.toJSON());
      return;
    }

    if (req.method === 'GET') {
  await serveStaticFile(req, res, url.pathname);
  return;
  }

  sendJson(res, 404, {
    error: 'Not Found',
  });
  } catch (error) {
    console.error('HTTP error:', error.message);

    sendJson(res, error.statusCode ?? 400, {
      error: error.message,
    });
  }
});

const wss = setupWebSocket(
  server,
  roomManager,
  eventLogger,
);


server.listen(config.port, config.host, () => {
  console.log('=================================');
  console.log(' TANK ARENA SERVER');
  console.log('=================================');
  console.log(
    `Server: http://${config.host}:${config.port}`,
  );
  console.log(`Logs directory: ${config.logDir}`);
  console.log('Status: running');

  gameLoop.start();
  console.log('Game loop started: 30 ticks/sec');
});


let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  gameLoop.stop();

  console.log(`\nReceived ${signal}`);
  console.log('Shutting down server...');

  // Не приймаємо нові HTTP-з'єднання
  const httpClosed = new Promise((resolve) => {
    server.close(() => resolve());
  });

  // Закриваємо активні WebSocket-з'єднання
  for (const client of wss.clients) {
    client.close(1001, 'Server shutting down');
  }

  // Чекаємо закриття WebSocket-сервера
  const wsClosed = new Promise((resolve) => {
    wss.close(() => resolve());
  });

  // Захист від зависання клієнтів
  const forceCloseTimer = setTimeout(() => {
    for (const client of wss.clients) {
      client.terminate();
    }

    server.closeAllConnections();
  }, 3000);

  forceCloseTimer.unref();

  try {
    await Promise.all([httpClosed, wsClosed]);

    // Зберігаємо останні події
    await eventLogger.close();

    console.log('All connections closed');
    console.log('Event log saved');
    console.log('Server stopped successfully');
  } catch (error) {
    console.error('Shutdown error:', error.message);
    process.exitCode = 1;
  } finally {
    clearTimeout(forceCloseTimer);
  }
}

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
