import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const PLAYER_ID = 'e2e-player-001';
const ADMIN_ID  = 'e2e-admin-001';

async function setupSession(userId: string, isAdmin: boolean): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page    = await context.newPage();
    const res = await page.request.post(`${BASE}/api/test/session`, {
      data: { userId, isAdmin },
    });
    if (!res.ok()) {
      throw new Error(`Session setup failed for ${userId}: ${await res.text()}`);
    }
    // Navigate to the landing page for this role so the session cookie is
    // confirmed before we save storageState.
    await page.goto(isAdmin ? `${BASE}/admin/dashboard` : `${BASE}/home`);
    if (page.url().includes('/login')) {
      throw new Error(`Session for ${userId} was not authenticated — ended up at login`);
    }
    const dest = path.resolve(__dirname, `.auth/${isAdmin ? 'admin' : 'player'}.json`);
    await context.storageState({ path: dest });
  } finally {
    await browser.close();
  }
}

async function seedDrink(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      storageState: path.resolve(__dirname, '.auth/admin.json'),
    });
    const page = await context.newPage();
    const res = await page.request.post(`${BASE}/api/admin/drinks`, {
      data: { name: 'E2E Bier', price_cents: 150, active: true },
    });
    if (!res.ok()) {
      throw new Error(`seedDrink failed: ${await res.text()}`);
    }
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  fs.mkdirSync(path.resolve(__dirname, '.auth'), { recursive: true });
  await setupSession(PLAYER_ID, false);
  await setupSession(ADMIN_ID,  true);
  await seedDrink();
}
