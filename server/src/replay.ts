
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { config } from './config.ts';
import { z } from 'zod';

const eventSchema = z.object({
  timestamp: z.string().optional(),
  type: z.string(),
  playerName: z.string().optional(),
  roomId: z.string().optional(),
  text: z.string().optional(),
}).passthrough();

const logPath = path.join(config.logDir, 'events.ndjson');

async function replayEvents(): Promise<void> {
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
        const raw: unknown = JSON.parse(line);
        event = eventSchema.parse(raw);
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
    console.error('Replay failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

replayEvents();
