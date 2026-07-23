# Playwright E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thin Playwright E2E suite covering four critical happy paths: player logs a drink, player edits their name, admin creates a drink, admin closes a billing period.

**Architecture:** Playwright runs a dev server via `webServer`, authenticates via a test-only `/api/test/session` route that creates Supabase sessions server-side, saves `storageState` for a player and admin in `global-setup.ts`, then runs four focused specs against those sessions. A new `e2e` CI job mirrors the integration job's Postgres service container.

**Tech Stack:** `@playwright/test`, Chromium only, Next.js 16 App Router, Supabase admin API (`@supabase/supabase-js` service-role client), Prisma.

---

### Task 1: Install Playwright and scaffold config

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `e2e/.auth/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

Expected: `node_modules/@playwright/test` exists, Chromium downloaded.

- [ ] **Step 2: Add `test:e2e` script to `package.json`**

In `package.json`, add after `"test:integration"`:
```json
"test:e2e": "playwright test",
```

- [ ] **Step 3: Add auth state dir to `.gitignore`**

In `.gitignore`, add after the `.vercel` line:
```
# playwright auth state
e2e/.auth/
```

- [ ] **Step 4: Create `e2e/.auth/.gitkeep`**

```bash
mkdir -p e2e/.auth && touch e2e/.auth/.gitkeep
```

- [ ] **Step 5: Create `playwright.config.ts`**

```ts
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
  },
});
```

- [ ] **Step 6: Verify Playwright CLI works**

```bash
npx playwright test --list 2>&1 | head -5
```

Expected: output without a crash (no tests yet — that's fine).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e/.auth/.gitkeep .gitignore
git commit -m "feat(e2e): install Playwright and scaffold config"
```

---

### Task 2: Add test-only session API route

**Files:**
- Create: `src/app/api/test/session/route.ts`

This route is the auth bypass. It only responds when `PLAYWRIGHT_TEST=true` in the server environment — it returns 404 in production.

Flow: upsert player in Prisma → create Supabase auth user via admin client → generate a magic-link OTP → exchange it for a session via the server Supabase client (which writes the session cookies onto the response automatically via Next.js's `cookies()` API).

- [ ] **Step 1: Create the route**

```ts
// src/app/api/test/session/route.ts
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return new Response(null, { status: 404 });
  }

  const { userId, isAdmin } = await request.json();

  await prisma.player.upsert({
    where: { id: userId },
    update: { isAdmin },
    create: { id: userId, name: `E2E ${isAdmin ? 'Admin' : 'Player'}`, isAdmin },
  });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await admin.auth.admin.createUser({
    user_id: userId,
    email: `${userId}@e2e.test`,
    email_confirm: true,
  }).catch(() => {});

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: `${userId}@e2e.test`,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message ?? 'generateLink failed' },
      { status: 500 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    email: `${userId}@e2e.test`,
    token: linkData.properties.hashed_token,
    type: 'email',
  });

  if (otpError) {
    return NextResponse.json({ error: otpError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "^$"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/test/session/route.ts
git commit -m "feat(e2e): add test-only /api/test/session auth bypass route"
```

---

### Task 3: Write global-setup

**Files:**
- Create: `e2e/global-setup.ts`

Global-setup runs before any test. It:
1. POSTs to `/api/test/session` for the player user → saves cookies to `e2e/.auth/player.json`
2. POSTs to `/api/test/session` for the admin user → saves cookies to `e2e/.auth/admin.json`
3. Seeds one active drink (E2E Bier, 1,50 €) using the admin session so player tests have something to click

The webServer is already running when global-setup executes (Playwright starts it first).

- [ ] **Step 1: Create `e2e/global-setup.ts`**

```ts
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const PLAYER_ID = 'e2e-player-001';
const ADMIN_ID  = 'e2e-admin-001';

async function setupSession(userId: string, isAdmin: boolean): Promise<void> {
  const browser = await chromium.launch();
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

  const dest = path.resolve(__dirname, `.auth/${isAdmin ? 'admin' : 'player'}.json`);
  await context.storageState({ path: dest });
  await browser.close();
}

async function seedDrink(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: path.resolve(__dirname, '.auth/admin.json'),
  });
  const page = await context.newPage();

  await page.request.post(`${BASE}/api/admin/drinks`, {
    data: { name: 'E2E Bier', price_cents: 150, active: true },
  });
  await browser.close();
}

export default async function globalSetup() {
  fs.mkdirSync(path.resolve(__dirname, '.auth'), { recursive: true });
  await setupSession(PLAYER_ID, false);
  await setupSession(ADMIN_ID,  true);
  await seedDrink();
}
```

- [ ] **Step 2: Run global-setup in isolation to verify**

```bash
PLAYWRIGHT_TEST=true DATABASE_URL=<your-local-db> \
  NEXT_PUBLIC_SUPABASE_URL=<url> \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<key> \
  SUPABASE_SERVICE_ROLE_KEY=<key> \
  npx playwright test --list
```

Expected: no crash during setup; `e2e/.auth/player.json` and `e2e/.auth/admin.json` created.

- [ ] **Step 3: Commit**

```bash
git add e2e/global-setup.ts
git commit -m "feat(e2e): add global-setup — creates player/admin sessions and seeds drink"
```

---

### Task 4: Player logs a drink (`player-drink.spec.ts`)

**Files:**
- Create: `e2e/player-drink.spec.ts`

Uses the player storage state seeded in global-setup. The "E2E Bier" drink (1,50 €) is already in the DB. The player's booking count starts at 0 so the balance starts at 0,00 €.

- [ ] **Step 1: Create the spec**

```ts
// e2e/player-drink.spec.ts
import { test, expect } from '@playwright/test';

test('player logs a drink and balance updates', async ({ page }) => {
  await page.goto('/home');

  // Wait for the drink list to load
  const drinkCard = page.locator('text=E2E Bier').first();
  await expect(drinkCard).toBeVisible({ timeout: 10_000 });

  // Initial balance is 0,00 € for a fresh player
  await expect(page.locator('text=0,00 €').first()).toBeVisible();

  // Tap the drink
  await drinkCard.click();

  // Balance should update to 1,50 €
  await expect(page.locator('text=1,50 €').first()).toBeVisible({ timeout: 5_000 });
});
```

- [ ] **Step 2: Run just this spec (local only — skip in CI until all tasks done)**

```bash
PLAYWRIGHT_TEST=true npx playwright test e2e/player-drink.spec.ts --project=player
```

Expected: 1 test passed.

- [ ] **Step 3: Commit**

```bash
git add e2e/player-drink.spec.ts
git commit -m "feat(e2e): player-drink happy-path spec"
```

---

### Task 5: Player edits display name (`player-account.spec.ts`)

**Files:**
- Create: `e2e/player-account.spec.ts`

The account page uses a Chakra `<Input>` (renders as `<input>`) for the display name. The "Speichern" button (`<Box as="button">` → rendered as `<button>`) is only active when the name differs from the saved value.

- [ ] **Step 1: Create the spec**

```ts
// e2e/player-account.spec.ts
import { test, expect } from '@playwright/test';

test('player edits display name and it persists', async ({ page }) => {
  await page.goto('/account');

  // Wait for the name to load into the input
  const nameInput = page.getByRole('textbox');
  await expect(nameInput).toBeVisible({ timeout: 10_000 });
  await expect(nameInput).not.toHaveValue('');

  // Change the name
  await nameInput.clear();
  await nameInput.fill('E2E Renamed Player');

  // Speichern becomes active — click it
  await page.getByRole('button', { name: 'Speichern' }).click();

  // Wait for save to complete (button returns to non-saving label)
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible({ timeout: 5_000 });

  // Navigate away and back to confirm persistence
  await page.goto('/home');
  await page.goto('/account');

  await expect(page.getByRole('textbox')).toHaveValue('E2E Renamed Player', { timeout: 10_000 });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/player-account.spec.ts
git commit -m "feat(e2e): player-account happy-path spec"
```

---

### Task 6: Admin creates a drink (`admin-drink.spec.ts`)

**Files:**
- Create: `e2e/admin-drink.spec.ts`

The admin dashboard opens on the "Getränke verwalten" tab by default. The add-row has two `<input>` elements with placeholders `"Name"` and `"1,50"`, and a `"+"` button.

- [ ] **Step 1: Create the spec**

```ts
// e2e/admin-drink.spec.ts
import { test, expect } from '@playwright/test';

test('admin creates a drink and it appears in the list', async ({ page }) => {
  await page.goto('/admin/dashboard');

  // Wait for the drinks tab to load
  await expect(page.locator('text=Getränke verwalten')).toBeVisible({ timeout: 10_000 });

  // Fill in the new drink row
  await page.getByPlaceholder('Name').fill('Neues E2E Getränk');
  await page.getByPlaceholder('1,50').fill('2,50');

  // Click the "+" button to add
  await page.getByRole('button', { name: '+' }).click();

  // The new drink should appear in the list
  await expect(page.locator('text=Neues E2E Getränk').first()).toBeVisible({ timeout: 5_000 });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/admin-drink.spec.ts
git commit -m "feat(e2e): admin-drink happy-path spec"
```

---

### Task 7: Admin closes a billing period (`admin-billing.spec.ts`)

**Files:**
- Create: `e2e/admin-billing.spec.ts`

The admin creates a first period (makes it active), then creates a second period (which atomically closes the first). The first period should then show the badge "Abgeschlossen".

- [ ] **Step 1: Create the spec**

```ts
// e2e/admin-billing.spec.ts
import { test, expect } from '@playwright/test';

test('admin closes a billing period by creating a new one', async ({ page }) => {
  await page.goto('/admin/dashboard');

  // Switch to billing tab
  await page.locator('text=Abrechnung').first().click();

  // ── Create the first (active) period ──────────────────────────────────────
  await page.locator('text=Neue Abrechnung').click();

  // Fill in start date (date input — value format YYYY-MM-DD)
  await page.locator('input[type="date"]').first().fill('2026-07-01');
  await page.getByRole('button', { name: 'Abrechnung erstellen' }).click();

  // First period is now active — its badge reads "Aktiv"
  await expect(page.locator('text=Aktiv').first()).toBeVisible({ timeout: 5_000 });

  // ── Create a second period, which closes the first ────────────────────────
  await page.locator('text=Neue Abrechnung').click();
  await page.locator('input[type="date"]').first().fill('2026-08-01');
  await page.getByRole('button', { name: 'Abrechnung erstellen' }).click();

  // The first period's badge should now read "Abgeschlossen"
  // Use the period picker dropdown to navigate to it
  await page.locator('text=Abgeschlossen').first().waitFor({ timeout: 5_000 });
  await expect(page.locator('text=Abgeschlossen').first()).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/admin-billing.spec.ts
git commit -m "feat(e2e): admin-billing happy-path spec"
```

---

### Task 8: Add `e2e` CI job

**Files:**
- Modify: `.github/workflows/ci.yml`

The e2e job needs the same Postgres service as the integration job, plus three Supabase secrets. It runs on every push/PR. The Playwright HTML report is uploaded as an artifact on failure for debugging.

Before adding the CI job, add the three Supabase secrets to the GitHub repo:
- `NEXT_PUBLIC_SUPABASE_URL` (same value as in `.env.local`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same value as in `.env.local`)
- `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Project Settings → API → service_role key)

- [ ] **Step 1: Verify secrets exist in GitHub**

```bash
gh secret list
```

Expected: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` appear in the list.

If any are missing, add them:
```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "<value>"
gh secret set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY --body "<value>"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "<value>"
```

- [ ] **Step 2: Append the `e2e` job to `.github/workflows/ci.yml`**

Add after the closing `run: npm run test:integration` line of the `integration` job:

```yaml
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: drink_tracker_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/drink_tracker_test
      DIRECT_URL: postgresql://postgres:postgres@localhost:5432/drink_tracker_test
      PLAYWRIGHT_TEST: "true"
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Apply database migrations
        run: npx prisma migrate deploy

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/ci.yml package.json package-lock.json
git commit -m "feat(e2e): add Playwright CI job with Postgres + Supabase secrets"
git push origin feat/playwright-e2e
```

- [ ] **Step 5: Open PR and watch CI**

```bash
gh pr create --base main --title "Add Playwright E2E suite" --fill
```

Watch the `e2e` job. If it fails, check the uploaded `playwright-report` artifact for screenshots and traces.
