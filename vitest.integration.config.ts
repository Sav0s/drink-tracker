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
    // DB round-trips are slower than mocked unit tests; a few sequential
    // requests per test can add up.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
