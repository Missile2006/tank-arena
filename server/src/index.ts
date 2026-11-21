
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { config } from './config.ts';
import { RoomManager } from './room-manager.ts';
import { setupWebSocket } from './websocket.ts';
import { createEventLogger } from './logger.ts';
import { createGameLoop } from './game-loop.ts';
import { encodeSnapshot } from 'tank-arena-shared/protocol';
import { performance } from 'node:perf_hooks';
import { recordOutbound, sampleTrafficMetrics } from './traffic-metrics.ts';

const createRoomSchema = z.strictObject({
  name: z.string().trim().min(1).max(50),
  maxPlayers: z.number().int().min(1).max(16).optional(),
  asteroidCount: z.number().int().min(0).max(50).optional(),
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function errorStatus(error: unknown): number {
  if (error instanceof z.ZodError) return 400;
  if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') return error.statusCode;
  return 400;
}


const serverDir = path.dirname(fileURLToPath(import.meta.url));

const clientDistDir = path.resolve(
  serverDir,
  '../../client/dist',
);

const roomManager = new RoomManager();
const eventLogger = createEventLogger(config.logDir);

const tickDurations: number[] = [];

let totalTicks = 0;
let previousEventLoopUtilization =
  performance.eventLoopUtilization();

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;

  return sorted[Math.max(0, index)] ?? 0;
}

const gameLoop = createGameLoop(({ tick, dt }) => {
  const tickStart = performance.now();
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
        recordOutbound(binaryData.byteLength);
      } else {
        socket.send(jsonData);
        recordOutbound(Buffer.byteLength(jsonData));
      }
    }
  }

    const tickDuration = performance.now() - tickStart;

    totalTicks += 1;
    tickDurations.push(tickDuration);

  if (tickDurations.length >= 300) {
    const p50 = percentile(tickDurations, 50);
    const p95 = percentile(tickDurations, 95);
    const p99 = percentile(tickDurations, 99);
    const max = Math.max(...tickDurations);

    console.log('\n=== SERVER TICK PERFORMANCE ===');
    console.table({
      samples: tickDurations.length,
      p50Ms: p50.toFixed(2),
      p95Ms: p95.toFixed(2),
      p99Ms: p99.toFixed(2),
      maxMs: max.toFixed(2),
      ticksOver33Ms: tickDurations.filter(ms => ms > 33).length,
    });

    tickDurations.length = 0;
  }
});

console.log('Event log:', eventLogger.logPath);

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify(data));
}


const mimeTypes: Record<string, string> = {
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

async function serveStaticFile(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  if (/%2f|%5c/i.test(pathname)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let decodedPath: string;

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

  let fileHandle: Awaited<ReturnType<typeof fs.promises.open>> | undefined;

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

    if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      sendJson(res, 404, { error: 'File not found' });
      return;
    }

    console.error('Static file error:', errorMessage(error));
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
}

// Читаємо JSON із POST-запиту
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalSize += buffer.length;

    if (totalSize > 10_240) {
      throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    }

    chunks.push(buffer);
  }

  try {
    return JSON.parse(
      Buffer.concat(chunks).toString('utf8'),
    );
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 });
  }
}

let serverReady = false;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`,
    );

    // Перевірка стану сервера
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'tank-arena-server',
        uptime: process.uptime(),
        gitSha: config.gitSha,
      });

      return;
    }

    if (req.method === 'GET' && url.pathname === '/ready') {
      sendJson(res, serverReady ? 200 : 503, {
        status: serverReady ? 'ready' : 'not_ready',
        service: 'tank-arena-server',
      });

      return;
    }

    if (req.method === 'GET' && url.pathname === '/metrics') {
    const rooms = [...roomManager.rooms.values()];

    const players = rooms.reduce(
      (total, room) => total + room.playerCount,
      0,
    );

    const currentEventLoopUtilization =
      performance.eventLoopUtilization();

    const eventLoopDelta = performance.eventLoopUtilization(
      currentEventLoopUtilization,
      previousEventLoopUtilization
    );

    previousEventLoopUtilization = currentEventLoopUtilization;

    sendJson(res, 200, {
      service: 'tank-arena-server',
      uptimeSeconds: Math.round(process.uptime()),
      rooms: rooms.length,
      players,
      totalTicks,
      ...sampleTrafficMetrics(),
      tickDurationMs: {
        p50: percentile(tickDurations, 50),
        p95: percentile(tickDurations, 95),
        p99: percentile(tickDurations, 99),
      },
      memoryUsageMb: Math.round(
        process.memoryUsage().rss / 1024 / 1024,
      ),
      eventLoopUtilization: eventLoopDelta.utilization,
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
      const body = createRoomSchema.parse(await readJsonBody(req));

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
    console.error('HTTP error:', errorMessage(error));

    sendJson(res, errorStatus(error), {
      error: errorMessage(error),
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
  serverReady = true;

  console.log('Game loop started: 30 ticks/sec');
  console.log('Server readiness: ready');
});


let shuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  serverReady = false;
  gameLoop.stop();

  console.log(`\nReceived ${signal}`);
  console.log('Shutting down server...');

  // Не приймаємо нові HTTP-з'єднання
  const httpClosed = new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'shutdown',
        reason: 'Server shutting down',
      }));
    }

    client.close(1001, 'Server shutting down');
  }

  // Чекаємо закриття WebSocket-сервера
  const wsClosed = new Promise<void>((resolve) => {
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
    console.error('Shutdown error:', errorMessage(error));
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
