import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'player',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/player.json' },
      testMatch: /player-.*\.spec\.ts/,
    },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      testMatch: /admin-.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Explicitly forward all env vars + ensure PLAYWRIGHT_TEST reaches the
    // dev server subprocess (Playwright may not inherit host env by default).
    env: {
      ...process.env as Record<string, string>,
      PLAYWRIGHT_TEST: 'true',
    },
  },
});
