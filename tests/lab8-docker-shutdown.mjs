import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';

// Run on the host with Docker Desktop running; no server source changes.
const container = 'tank-arena-lab8';
const origin = 'http://localhost:3000';
const base = 'http://127.0.0.1:3000';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function docker(args, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true, shell: process.platform === 'win32' });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`docker ${args.join(' ')} timed out`)); }, timeout);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (err) => { clearTimeout(timer); reject(err); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`docker ${args.join(' ')} failed (${code}): ${stderr || stdout}`));
      else resolve(stdout.trim());
    });
  });
}

async function waitReady() {
  for (let i = 0; i < 70; i++) {
    try {
      const response = await fetch(`${base}/ready`, { signal: AbortSignal.timeout(800) });
      if (response.ok) return;
    } catch { /* waiting for server */ }
    await sleep(200);
  }
  throw new Error('Container did not become ready at http://127.0.0.1:3000/ready');
}

async function run() {
  let socket;
  let stopped = false;
  try {
    const state = await docker(['inspect', '-f', '{{.State.Running}}', container]);
    assert.equal(state, 'true', `Container ${container} must be running before the test`);
    await waitReady();
    console.log('PASS Docker server is ready');

    socket = new WebSocket('ws://127.0.0.1:3000/ws', { origin });
    await Promise.race([
      once(socket, 'open'),
      sleep(5000).then(() => { throw new Error('WebSocket open timeout'); }),
    ]);
    console.log('PASS WebSocket connected with permitted Origin');

    const messages = [];
    socket.on('message', (raw) => {
      try { messages.push(JSON.parse(raw.toString())); } catch { /* not JSON */ }
    });
    const closed = new Promise((resolve, reject) => {
      socket.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      socket.once('error', reject);
    });

    const start = Date.now();
    const stop = docker(['stop', '-t', '10', container], 17000);
    stopped = true;
    const [close] = await Promise.all([
      Promise.race([closed, sleep(15000).then(() => { throw new Error('WebSocket close timeout'); })]),
      stop,
    ]);
    assert.equal(close.code, 1001, `Expected WebSocket close 1001, got ${close.code}`);
    assert.ok(messages.some((message) => message.type === 'shutdown'),
      `Expected shutdown message, got: ${JSON.stringify(messages.map(m => m.type))}`);
    console.log('PASS shutdown message and WebSocket close code 1001');

    const exitCode = await docker(['inspect', '-f', '{{.State.ExitCode}}', container]);
    assert.equal(exitCode, '0', `Expected exit code 0, got ${exitCode}`);
    assert.ok(Date.now() - start < 10000, 'Shutdown took 10 seconds or more');
    const logs = await docker(['logs', '--tail', '80', container]);
    assert.match(logs, /Received SIGTERM/);
    assert.match(logs, /Event log saved/);
    assert.match(logs, /Server stopped successfully/);
    console.log('PASS clean exit 0 under 10 seconds and event log saved');
    console.log('\nResult: 4/4 passed');
  } finally {
    if (socket && socket.readyState === WebSocket.OPEN) socket.terminate();
    if (stopped) {
      console.log('Restarting container after test...');
      try { await docker(['start', container]); await waitReady(); console.log('Container restarted and ready'); }
      catch (error) { console.error('IMPORTANT: Could not restart container:', error.message); process.exitCode = 1; }
    }
  }
}

run().catch((error) => { console.error('FAIL', error); process.exitCode = 1; });
