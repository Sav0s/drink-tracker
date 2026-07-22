import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Separate config for integration tests (*.integration.test.ts). These hit a
 * real Postgres database through the actual Prisma client — unlike the unit
 * config (vitest.config.ts), which mocks '@/lib/prisma' and runs in jsdom.
 * Requires DATABASE_URL to point at a disposable database; see CLAUDE.md.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-integration-setup.ts'],
    include: ['src/**/*.integration.test.ts'],
    // Integration tests share a single database — run files sequentially so
    // one file's beforeEach TRUNCATE doesn't race with another file's inserts.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
