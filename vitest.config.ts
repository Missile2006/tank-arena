import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['client/**/*.vitest.test.ts', 'server/**/*.vitest.test.ts', 'shared/**/*.vitest.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      include: ['shared/simulation.ts', 'shared/protocol.ts', 'shared/messages.ts', 'shared/types.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { lines: 85, statements: 85 },
    },
  },
});
