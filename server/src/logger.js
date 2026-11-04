
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough, Transform, pipeline } from 'node:stream';

export function createEventLogger(logDir) {
  // Створюємо директорію для логів
  fs.mkdirSync(logDir, { recursive: true });

  const logPath = path.join(logDir, 'events.ndjson');

  // Потік, до якого надходитимуть події
  const source = new PassThrough({
    objectMode: true,
    highWaterMark: 100,
  });

  // Перетворюємо об'єкти JavaScript на рядки NDJSON
  const transform = new Transform({
    writableObjectMode: true,

    transform(event, encoding, callback) {
      try {
        const line = `${JSON.stringify(event)}\n`;
        callback(null, line);
      } catch (error) {
        callback(error);
      }
    },
  });

  // Записуємо події у файл, не перезаписуючи старі
  const destination = fs.createWriteStream(logPath, {
    flags: 'a',
    encoding: 'utf8',
  });

  let loggerError = null;
  let closed = false;

  pipeline(source, transform, destination, (error) => {
    if (error) {
      loggerError = error;
      console.error('Event logger failed:', error.message);
    } else {
      console.log('Event logger closed');
    }
  });

  function log(type, data = {}) {
    if (closed || loggerError || source.destroyed) {
      return false;
    }

    return source.write({
      timestamp: new Date().toISOString(),
      type,
      ...data,
    });
  }

  function close() {
  return new Promise((resolve, reject) => {
    if (closed) {
      resolve();
      return;
    }

    closed = true;

    destination.once('finish', resolve);
    destination.once('error', reject);

    source.end();
    });
  }

  return {
    log,
    close,
    logPath,
  };
}
