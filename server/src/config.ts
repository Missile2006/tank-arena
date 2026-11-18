import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Runtime validation is necessary: environment variables are external input.
const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_DIR: z.string().trim().min(1).default('./logs'),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
});

const environment = environmentSchema.parse(process.env);
export const config = Object.freeze({
  port: environment.PORT,
  logDir: path.resolve(serverDir, environment.LOG_DIR),
  host: environment.HOST,
});
