# Playwright E2E Design

**Date:** 2026-07-22
**Scope:** Thin happy-path E2E suite covering the four critical user flows. Intentionally minimal — unit and integration tests cover correctness; E2E covers the browser-rendered golden paths.

---

## Auth Strategy

The app uses Supabase-only auth (Google OAuth + magic link). Playwright cannot drive OAuth, so a test-only bypass is used:

- **`/api/test/session` route** — active only when `PLAYWRIGHT_TEST=true` in the server environment. Accepts `{ userId, isAdmin }` in the POST body, upserts a player row via Prisma, calls the Supabase admin API (service-role key) to create a session token, and sets the Supabase auth cookies on the response. Returns **404** when `PLAYWRIGHT_TEST` is unset (production is always safe).
- Required env vars (CI secrets): `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## File Layout

```
e2e/
├── global-setup.ts          # Creates playerState.json + adminState.json via /api/test/session
├── player-drink.spec.ts     # Player logs a drink → balance updates
├── player-account.spec.ts   # Player edits display name → saved
├── admin-drink.spec.ts      # Admin creates a drink → appears in list
└── admin-billing.spec.ts    # Admin closes billing period → period marked closed
playwright.config.ts         # baseURL, webServer, storageState paths, Chromium only
```

---

## Playwright Config

- **Browser:** Chromium only.
- **`webServer`:** starts `npm run dev` (or `next start` after build) on `http://localhost:3000`, waits for it to be ready.
- **`globalSetup`:** `e2e/global-setup.ts` — calls `/api/test/session` twice (once with `isAdmin: false` for a player, once with `isAdmin: true` for an admin), saves resulting cookies to `e2e/.auth/player.json` and `e2e/.auth/admin.json` via `browser.newContext().storageState()`.
- **`projects`:** two projects — `player` (uses `player.json`) and `admin` (uses `admin.json`). Each spec imports the right one via `test.use({ storageState })`.
- **`testDir`:** `e2e/`.

---

## Test Specs

### `player-drink.spec.ts`
1. Navigate to `/home`.
2. Note the current balance displayed.
3. Click the first drink button.
4. Assert the balance has increased by that drink's price.

### `player-account.spec.ts`
1. Navigate to `/account`.
2. Clear the name field, type a new name.
3. Click "Speichern".
4. Navigate away and back; assert the new name is shown.

### `admin-drink.spec.ts`
1. Navigate to `/admin/dashboard`.
2. Fill in drink name + price, click "Hinzufügen".
3. Assert the new drink appears in the drinks list.

### `admin-billing.spec.ts`
1. Navigate to `/admin/dashboard`, go to the billing tab.
2. Click "Abrechnungszeitraum abschließen".
3. Assert the closed period now appears in the periods list with status "Abgeschlossen".

---

## CI Job

New `e2e` job in `.github/workflows/ci.yml`, runs on every PR and push to `main`.

```yaml
e2e:
  runs-on: ubuntu-latest
  services:
    postgres: { image: postgres:16, ... }   # same as integration job
  env:
    DATABASE_URL: ...
    DIRECT_URL: ...
    PLAYWRIGHT_TEST: "true"
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  steps:
    - checkout, setup-node, npm ci
    - npx prisma migrate deploy
    - npx playwright install --with-deps chromium
    - npx playwright test
    - upload-artifact: playwright-report (on failure)
```

The Supabase secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must be added to the GitHub repo's secrets. The CI Postgres uses the same setup as the integration job.

---

## What's Not In Scope

- Cross-browser testing (Firefox, WebKit).
- Visual regression / screenshot diffing.
- The login page itself (can't drive OAuth; the magic-link flow is covered by the unit test for `LoginPage`).
- Error/edge-case flows (covered by integration tests).
