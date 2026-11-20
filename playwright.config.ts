import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3000);
export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 12000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run start',
    url: `http://127.0.0.1:${port}/api/rooms`,
    reuseExistingServer: !process.env.CI,
    timeout: 45000,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
  },
});
