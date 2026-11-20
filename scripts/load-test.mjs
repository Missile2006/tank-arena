import { WebSocket } from 'ws';
import { writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const base = process.env.LOAD_URL ?? 'http://127.0.0.1:3000';
const counts = (process.env.LOAD_COUNTS ?? '8,32,64,128').split(',').map(Number);
const seconds = Number(process.env.LOAD_SECONDS ?? 30);
const intervalMs = 50; // 20 inputs/second per client; under the server's 60/s limit
const roomSize = 4;
const baseUrl = new URL(base);
if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.hostname !== '127.0.0.1' && baseUrl.hostname !== 'localhost') {
  throw new Error('For safety, LOAD_URL must point to localhost or 127.0.0.1');
}
if (counts.some(n => !Number.isInteger(n) || n < 1 || n > 128) || !Number.isFinite(seconds) || seconds < 1 || seconds > 120) {
  throw new Error('Invalid LOAD_COUNTS or LOAD_SECONDS');
}
const wsUrl = new URL('/ws', baseUrl); wsUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
const apiUrl = new URL('/api/rooms', baseUrl);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(p * sorted.length / 100) - 1)] * 100) / 100;
};

async function createRoom(index) {
  const response = await fetch(apiUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `LoadTest-${Date.now()}-${index}`, maxPlayers: roomSize, asteroidCount: 6 }),
  });
  if (!response.ok) throw new Error(`Create room: HTTP ${response.status}: ${await response.text()}`);
  return (await response.json()).id;
}

function connectBot(roomId, index, metrics) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl, { handshakeTimeout: 5000, perMessageDeflate: false });
    const bot = { socket, seq: 0, joined: false, timer: null };
    const timeout = setTimeout(() => { socket.terminate(); reject(new Error(`Bot ${index}: join timeout`)); }, 7000);
    const fail = error => { clearTimeout(timeout); reject(error); };
    socket.once('error', fail);
    socket.once('open', () => socket.send(JSON.stringify({ type: 'join', roomId, playerName: `LoadBot${index}`, protocolMode: 'json' })));
    socket.on('message', raw => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }
      if (data.type === 'joined' && !bot.joined) {
        bot.joined = true;
        clearTimeout(timeout);
        socket.off('error', fail);
        resolve(bot);
      }
      if (data.type === 'snapshot') metrics.snapshots++;
      if (data.type === 'error') metrics.errors++;
    });
    socket.on('close', () => { if (bot.joined) metrics.disconnections++; });
    socket.on('error', () => { if (bot.joined) metrics.errors++; });
  });
}

async function run(count) {
  console.log(`\n--- ${count} clients, ${seconds}s ---`);
  const metrics = { snapshots: 0, errors: 0, disconnections: 0, inputsSent: 0 };
  const bots = [];
  const start = performance.now();
  let connected = 0;
  try {
    const roomIds = [];
    for (let i = 0; i < Math.ceil(count / roomSize); i++) roomIds.push(await createRoom(i));
    // Join sequentially to avoid a short-lived connection storm and to keep within room capacity.
    for (let i = 0; i < count; i++) {
      const bot = await connectBot(roomIds[Math.floor(i / roomSize)], i, metrics);
      bots.push(bot);
      connected++;
    }
    const joinedMs = Math.round(performance.now() - start);
    const loopLag = [];
    let expected = performance.now() + 100;
    const lagTimer = setInterval(() => {
      const now = performance.now();
      loopLag.push(Math.max(0, now - expected));
      expected = now + 100;
    }, 100);
    try {
      bots.forEach((bot, i) => {
        bot.timer = setInterval(() => {
          if (bot.socket.readyState !== WebSocket.OPEN) return;
          bot.seq++;
          const phase = Math.floor(bot.seq / 30) % 4;
          bot.socket.send(JSON.stringify({ type: 'input', seq: bot.seq,
            thrust: phase !== 3, backward: false, left: phase === 1, right: phase === 2,
            fire: bot.seq % 10 === 0 }));
          metrics.inputsSent++;
        }, intervalMs);
      });
      await sleep(seconds * 1000);
    } finally {
      clearInterval(lagTimer);
      bots.forEach(bot => clearInterval(bot.timer));
    }
    const result = {
      clientsRequested: count, clientsJoined: connected, rooms: roomIds.length,
      durationSeconds: seconds, joinTotalMs: joinedMs,
      inputsSent: metrics.inputsSent, snapshotsReceived: metrics.snapshots,
      errors: metrics.errors, disconnections: metrics.disconnections,
      loadClientEventLoopLagP95Ms: percentile(loopLag, 95),
      loadClientEventLoopLagP99Ms: percentile(loopLag, 99),
      serverTickP99Ms: null,
      note: 'Client event-loop lag is NOT server tick duration. Server tick must be instrumented separately.',
    };
    console.table(result);
    return result;
  } finally {
    bots.forEach(bot => { if (bot.timer) clearInterval(bot.timer); bot.socket.close(); });
    await sleep(300);
    bots.forEach(bot => { if (bot.socket.readyState !== WebSocket.CLOSED) bot.socket.terminate(); });
  }
}

const response = await fetch(new URL('/health', baseUrl));
if (!response.ok) throw new Error(`Server health failed: ${response.status}`);
const results = [];
for (const count of counts) results.push(await run(count));
await mkdir('load-results', { recursive: true });
const filename = `load-results/load-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(filename, JSON.stringify({ base, results }, null, 2), 'utf8');
console.log(`\nSaved: ${filename}`);
