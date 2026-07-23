import { chromium, type BrowserContext } from '@playwright/test';
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

// Build the Supabase auth-token cookie name from the project URL.
// Format: sb-<project-ref>-auth-token
function supabaseCookieName(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const ref = new URL(url).hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}

// Encode a Supabase session object the same way @supabase/ssr does:
//   "base64-" + base64url(JSON.stringify(session))
// This matches the decodeChunkedCookieValue logic in @supabase/ssr/cookies.js.
function encodeSession(session: object): string {
  const json = JSON.stringify(session);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  return `base64-${b64}`;
}

async function injectSession(context: BrowserContext, session: object): Promise<void> {
  await context.addCookies([{
    name:     supabaseCookieName(),
    value:    encodeSession(session),
    domain:   'localhost',
    path:     '/',
    httpOnly: false,
    secure:   false,
    sameSite: 'Lax',
    // expires: -1 means session cookie — the session object's expires_at handles expiry
  }]);
}

async function setupSession(userId: string, isAdmin: boolean): Promise<void> {
  // 1. Get a fresh Supabase session for this test user.
  //    The route also returns the real Supabase UUID (may differ from userId
  //    when the auth user already existed from a previous CI run).
  const res = await fetch(`${BASE}/api/test/session`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId, isAdmin }),
  });
  if (!res.ok) {
    throw new Error(`Session setup failed for ${userId}: ${await res.text()}`);
  }
  const { session, actualUserId } = (await res.json()) as { session: object; actualUserId: string };
  if (!session) throw new Error(`Session setup for ${userId}: no session in response`);

  // 2. Create a browser context, inject the session cookie, verify auth works
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await injectSession(context, session);

    const page = await context.newPage();

    // Verify /api/me works with the injected cookie (confirms the player row
    // exists and the Supabase user.id matches our DB player id).
    const meRes = await page.request.get(`${BASE}/api/me`);
    if (!meRes.ok()) {
      throw new Error(`/api/me failed for ${userId}: HTTP ${meRes.status()} — ${await meRes.text()}`);
    }
    const me = await meRes.json() as { id: string; name: string };
    console.log(`[setup ${userId}] /api/me → id=${me.id} name="${me.name}" (actualUserId=${actualUserId})`);
    if (me.id !== actualUserId) {
      throw new Error(`/api/me returned id ${me.id} but expected actualUserId ${actualUserId}`);
    }

    await page.goto(isAdmin ? `${BASE}/admin/dashboard` : `${BASE}/home`);

    const finalUrl = page.url();
    console.log(`[setup ${userId}] Final URL: ${finalUrl}`);
    if (finalUrl.includes('/login')) {
      throw new Error(`Session for ${userId} was not authenticated — ended up at login`);
    }

    // 3. Save storageState (includes the injected cookie)
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
