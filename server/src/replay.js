
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { config } from './config.js';

const logPath = path.join(config.logDir, 'events.ndjson');

async function replayEvents() {
  if (!fs.existsSync(logPath)) {
    console.error('Log file not found:', logPath);
    process.exitCode = 1;
    return;
  }

  const stream = fs.createReadStream(logPath, {
    encoding: 'utf8',
  });

  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let count = 0;

  try {
    for await (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let event;

      try {
        event = JSON.parse(line);
      } catch {
        console.warn('Skipping invalid JSON line');
        continue;
      }

      count++;

      const time = event.timestamp ?? 'Unknown time';

      if (event.type === 'join') {
        console.log(
          `[${time}] JOIN: ${event.playerName} -> ${event.roomId}`,
        );
      } else if (event.type === 'chat') {
        console.log(
          `[${time}] CHAT: ${event.playerName}: ${event.text}`,
        );
      } else if (event.type === 'leave') {
        console.log(
          `[${time}] LEAVE: ${event.playerName} <- ${event.roomId}`,
        );
      } else {
        console.log(`[${time}] OTHER:`, event);
      }
    }

    console.log(`\nReplay finished. Events processed: ${count}`);
  } catch (error) {
    console.error('Replay failed:', error.message);
    process.exitCode = 1;
  }
}

replayEvents();
