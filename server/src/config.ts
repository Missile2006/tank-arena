
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const serverDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  HOST: z.string().trim().min(1).default('127.0.0.1'),

  LOG_DIR: z.string().trim().min(1).default('./logs'),

  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),

  MAX_CONNECTIONS_PER_IP: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(5),

  MAX_ROOMS: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50),

  MAX_PLAYERS_PER_ROOM: z.coerce
    .number()
    .int()
    .min(1)
    .max(16)
    .default(4),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  GIT_SHA: z.string().default('local'),
});

const environment = environmentSchema.parse(process.env);

export const config = Object.freeze({
  port: environment.PORT,
  host: environment.HOST,
  logDir: path.resolve(serverDir, environment.LOG_DIR),

  allowedOrigins: environment.ALLOWED_ORIGINS,
  maxConnectionsPerIp: environment.MAX_CONNECTIONS_PER_IP,
  maxRooms: environment.MAX_ROOMS,
  maxPlayersPerRoom: environment.MAX_PLAYERS_PER_ROOM,

  logLevel: environment.LOG_LEVEL,
  gitSha: environment.GIT_SHA,
});
