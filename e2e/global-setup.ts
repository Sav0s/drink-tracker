import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loadEnvConfig } from '@next/env';

// Load .env* files so DATABASE_URL is available when Prisma is imported
// (in CI the var is already in process.env; this handles local development)
loadEnvConfig(process.cwd());

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

async function cleanup(): Promise<void> {
  // Retry a few times — on CI the dev server may be warming up cold routes
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`${BASE}/api/test/cleanup`, { method: 'POST' });
    if (res.ok) return;
    const body = await res.text();
    console.error(`Cleanup attempt ${attempt}/5 failed (HTTP ${res.status}): ${body}`);
    if (attempt < 5) await new Promise(r => setTimeout(r, 2000));
    else throw new Error(`Cleanup failed after 5 attempts (HTTP ${res.status}): ${body}`);
  }
}

async function seedDrink(): Promise<void> {
  // Use Prisma directly — bypasses browser auth cookie handling which is
  // unreliable when loading storageState into a fresh browser context.
  const { prisma } = await import('../src/lib/prisma');
  try {
    await prisma.drink.create({
      data: { name: 'E2E Bier', priceCents: 150, active: true },
    });
  } finally {
    await prisma.$disconnect();
  }
}

export default async function globalSetup() {
  fs.mkdirSync(path.resolve(__dirname, '.auth'), { recursive: true });
  await cleanup();                          // wipe e2e data before seeding
  await setupSession(PLAYER_ID, false);
  await setupSession(ADMIN_ID,  true);
  await seedDrink();
}
