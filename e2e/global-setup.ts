import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Load .env.local for local development; in CI DATABASE_URL is already in env
dotenv.config({ path: '.env.local' });

const BASE = 'http://localhost:3000';
const PLAYER_ID = 'e2e-player-001';
const ADMIN_ID  = 'e2e-admin-001';

async function setupSession(userId: string, isAdmin: boolean): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page    = await context.newPage();

    // Navigate the browser (not page.request) to the session route so that the
    // auth cookies set on the redirect response land in the browser's cookie
    // store. page.request.post() is a separate context and does NOT share
    // cookies with the browser.
    await page.goto(`${BASE}/api/test/session?userId=${userId}&isAdmin=${isAdmin}`);

    const finalUrl = page.url();
    console.log(`[setup ${userId}] Final URL: ${finalUrl}`);
    if (finalUrl.includes('/login')) {
      throw new Error(`Session for ${userId} was not authenticated — ended up at login`);
    }

    const dest = path.resolve(__dirname, `.auth/${isAdmin ? 'admin' : 'player'}.json`);
    await context.storageState({ path: dest });

    const saved = JSON.parse(fs.readFileSync(dest, 'utf-8')) as { cookies: { name: string }[] };
    const cookieNames = saved.cookies.map(c => c.name).join(', ') || 'NONE';
    console.log(`[setup ${userId}] StorageState cookies: ${cookieNames}`);
  } finally {
    await browser.close();
  }
}

async function cleanup(): Promise<void> {
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
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
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
  await cleanup();
  await setupSession(PLAYER_ID, false);
  await setupSession(ADMIN_ID,  true);
  await seedDrink();
}
