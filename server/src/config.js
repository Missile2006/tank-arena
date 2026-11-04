
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Визначаємо папку server незалежно від місця запуску
const serverDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

// Перевірка порту сервера
function getPort(value) {
  const port = Number(value);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'PORT must be an integer between 1 and 65535',
    );
  }

  return port;
}

// Перевірка каталогу логів
function getLogDir(value) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw new Error('LOG_DIR must not be empty');
  }

  // Відносні шляхи обчислюємо від папки server
  return path.resolve(serverDir, value);
}

// Конфігурація сервера
export const config = Object.freeze({
  port: getPort(process.env.PORT ?? '3000'),
  logDir: getLogDir(process.env.LOG_DIR ?? './logs'),
  host: process.env.HOST ?? '127.0.0.1',
});
