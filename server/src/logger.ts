
import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';

export type EventName = 'join' | 'chat' | 'leave' | (string & {});

export interface EventLogger {
  readonly logPath: string;
  log(type: EventName, data?: Record<string, unknown>): boolean;
  close(): Promise<void>;
}

export function createEventLogger(logDir: string): EventLogger {
  fs.mkdirSync(logDir, { recursive: true });

  const logPath = path.join(logDir, 'events.ndjson');

  const destination = pino.destination({
    dest: logPath,
    sync: false,
  });

  const logger = pino(
    {
      level: 'info',
      base: {
        service: 'tank-arena-server',
      },
      redact: {
        paths: [
          'password',
          'token',
          'secret',
          'authorization',
          'data.password',
          'data.token',
          'data.secret',
        ],
        censor: '[REDACTED]',
      },
    },
    destination,
  );

  let closed = false;

  function log(
    type: EventName,
    data: Record<string, unknown> = {},
  ): boolean {
    if (closed) {
      return false;
    }

    logger.info(
      {
        event: type,
        ...data,
      },
      `Game event: ${type}`,
    );

    return true;
  }

  async function close(): Promise<void> {
    if (closed) {
      return;
    }

    closed = true;

    await new Promise<void>((resolve, reject) => {
      destination.flush((error?: Error | null) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    destination.end();
  }

  return {
    log,
    close,
    logPath,
  };
}
