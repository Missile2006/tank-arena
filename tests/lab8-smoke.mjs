import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

const base = process.env.LAB8_URL ?? 'http://localhost:3000';
const origin = process.env.LAB8_ORIGIN ?? base;
const wsUrl = new URL('/ws', base.replace(/^http/, 'ws')).href;
const tests = [];
const run = async (name, fn) => {
  try { await fn(); console.log(`PASS ${name}`); tests.push(true); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); tests.push(false); }
};
const fetchJson = async (path, options) => {
  const response = await fetch(new URL(path, base), options);
  return { status: response.status, body: await response.json() };
};
const connect = (testOrigin) => new Promise((resolve, reject) => {
  const socket = new WebSocket(wsUrl, { origin: testOrigin, handshakeTimeout: 5000 });
  socket.once('open', () => resolve(socket));
  socket.once('unexpected-response', (_req, res) => {
    const status = res.statusCode;
    res.resume();
    reject(Object.assign(new Error(`HTTP ${status}`), { status }));
  });
  socket.once('error', reject);
});
const close = (socket) => new Promise((resolve) => {
  if (socket.readyState === WebSocket.CLOSED) return resolve();
  socket.once('close', resolve);
  socket.close();
  setTimeout(() => { socket.terminate(); resolve(); }, 1500).unref();
});

await run('health and gitSha', async () => {
  const { status, body } = await fetchJson('/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.gitSha, 'string');
});
await run('readiness', async () => {
  const { status, body } = await fetchJson('/ready');
  assert.equal(status, 200);
  assert.equal(body.status, 'ready');
});
await run('metrics fields', async () => {
  const { status, body } = await fetchJson('/metrics');
  assert.equal(status, 200);
  for (const key of ['rooms', 'players', 'messagesPerSecond', 'bytesPerSecond', 'receivedMessages', 'sentMessages', 'eventLoopUtilization', 'memoryUsageMb']) {
    assert.equal(typeof body[key], 'number', `missing ${key}`);
  }
});
await run('reject forbidden WebSocket Origin', async () => {
  await assert.rejects(() => connect('https://untrusted.example'), (error) => error.status === 403);
});
await run('reject WebSocket without Origin', async () => {
  await assert.rejects(() => connect(undefined), (error) => error.status === 403);
});
await run('allow configured Origin', async () => {
  const socket = await connect(origin);
  await close(socket);
});
await run('enforce 5 simultaneous connections per IP', async () => {
  const sockets = [];
  try {
    for (let i = 0; i < 5; i++) sockets.push(await connect(origin));
    await assert.rejects(() => connect(origin), (error) => error.status === 429);
  } finally {
    await Promise.all(sockets.map(close));
  }
  // A short wait permits the server to process TCP close events.
  await new Promise(resolve => setTimeout(resolve, 150));
  const socket = await connect(origin);
  await close(socket);
});
await run('reject room exceeding maxPlayers=4', async () => {
  const { status } = await fetchJson('/api/rooms', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Lab8 limit test', maxPlayers: 5 }),
  });
  assert.equal(status, 400);
});
console.log(`\nResult: ${tests.filter(Boolean).length}/${tests.length} passed`);
if (tests.some(value => !value)) process.exitCode = 1;
