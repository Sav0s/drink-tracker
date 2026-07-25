# Structured Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured JSON logging (auth outcomes, admin/self-service payment + drink/billing-period audit trail, and uncaught server errors) across the API, per the approved design spec at `docs/superpowers/specs/2026-07-25-logging-design.md`.

**Architecture:** A pure `logger.ts` emits one JSON line per event via the matching `console` method (`info`/`warn`/`error`), captured automatically by Vercel. A `withErrorLogging` higher-order function wraps every exported handler in `src/app/api/**/route.ts` to catch unexpected exceptions, log them, and return a uniform 500. Mutating admin/payment/drink/billing-period routes additionally call `logger.info` directly at their success points. `auth/callback` (which redirects rather than returning JSON) calls the logger directly instead of using the wrapper, replacing its existing `console.error` calls.

**Tech Stack:** Next.js 16 App Router API routes, Vitest + Testing Library (mocked-Prisma unit tests for this feature — no DB/UI logic changes, so no integration tests are added), TypeScript strict mode.

## Global Constraints

- Money amounts stay integer cents; this feature touches no money math, only logs existing values.
- No new user-facing strings — logging is server-side only, no German-copy concerns.
- New/changed API route logic needs corresponding tests in the same PR (per `CLAUDE.md`) — every task below that changes route behavior ships a `route.test.ts`.
- `console.log(JSON.stringify(...))`-style logging only — no new dependency, no Sentry/Axiom integration.
- Each `logger.*` call emits exactly `{ event, userId?, meta, timestamp }` — `userId` omitted (not `undefined`) when not applicable, `meta` defaults to `{}`.
- Deliberately-returned error responses (401/403/400/404/409) are never touched by `withErrorLogging` — it only catches exceptions the handler itself didn't handle.
- Follow the existing repo test-mocking convention: `vi.mock('@/lib/...')` with a factory object, imported via `const { X } = await import('./route')` **after** the mocks (see `src/lib/auth.test.ts`, `src/app/api/admin/drinks/route.integration.test.ts`).

---

## File Structure

**New files:**
- `src/lib/logger.ts` — the structured logger (`info`/`warn`/`error`).
- `src/lib/logger.test.ts`
- `src/lib/withErrorLogging.ts` — the route-wrapping HOF.
- `src/lib/withErrorLogging.test.ts`
- `src/app/api/admin/drinks/route.test.ts` — new unit test (none existed; only an integration test covers auth-gating today).
- `src/app/api/admin/drinks/[id]/route.test.ts`
- `src/app/api/admin/billing-periods/route.test.ts`
- `src/app/api/admin/payments/route.test.ts`
- `src/app/api/payments/route.test.ts`
- `src/app/auth/callback/route.test.ts` — no test currently exists for this route.

**Modified files:**
- `src/lib/constants.ts` — add `LOG_EVENT` and `API_ERROR.INTERNAL_ERROR`.
- `src/app/api/bookings/route.ts`, `src/app/api/bookings/last/route.ts`, `src/app/api/home/route.ts`, `src/app/api/me/route.ts`, `src/app/api/admin/billing-periods/[id]/members/route.ts` — wrapped with `withErrorLogging` only, no new business-event logging (none of these are in the spec's event catalog).
- `src/app/api/admin/drinks/route.ts`, `src/app/api/admin/drinks/[id]/route.ts`, `src/app/api/admin/billing-periods/route.ts`, `src/app/api/admin/payments/route.ts`, `src/app/api/payments/route.ts` — wrapped + new business-event `logger.info` calls.
- `src/app/auth/callback/route.ts` — `console.error` → `logger.warn`/`logger.error`, plus a new `logger.info` on success. Not wrapped with the HOF (see spec rationale).

**Naming convention used throughout:** each route file renames its exported `GET`/`POST`/`PATCH`/`DELETE` function to a lowercase, descriptive internal name (e.g. `getDrinks`, `postDrink`), then re-exports the uppercase name as `withErrorLogging("METHOD /api/path", internalName)`.

---

### Task 1: `LOG_EVENT` + `API_ERROR.INTERNAL_ERROR` constants

**Files:**
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Produces: `LOG_EVENT.{AUTH_SUCCESS,AUTH_FAILURE,DRINK_CREATED,DRINK_UPDATED,BILLING_PERIOD_OPENED,BILLING_PERIOD_CLOSED,PAYMENT_MARKED,PAYMENT_RESET,PAYMENT_SELF_MARKED,PAYMENT_SELF_RESET,SERVER_ERROR}` (all `string` literals), `API_ERROR.INTERNAL_ERROR: "Internal server error"`. Every later task imports these from `@/lib/constants`.

This is trivial glue (a constants object, no logic) — per `CLAUDE.md` it doesn't need a dedicated test; it's exercised by every later task's tests.

- [ ] **Step 1: Add `API_ERROR.INTERNAL_ERROR`**

In `src/lib/constants.ts`, add a line to the existing `API_ERROR` object:

```ts
export const API_ERROR = {
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Not found",
  NO_ACTIVE_PERIOD: "No active billing period",
  DRINK_ID_REQUIRED: "drinkId required",
  START_DATE_REQUIRED: "startDate required",
  NAME_AND_PRICE_REQUIRED: "name and price_cents required",
  NAME_REQUIRED: "name required",
  PAYMENT_FIELDS_REQUIRED: "playerId, periodId, paid required",
  INTERNAL_ERROR: "Internal server error",
} as const;
```

- [ ] **Step 2: Add the `LOG_EVENT` constant**

Add this new export directly below `API_ERROR` in `src/lib/constants.ts`:

```ts
/** Event names for structured logging (src/lib/logger.ts). Kept as string literals so log lines stay stable if this file is refactored. */
export const LOG_EVENT = {
  AUTH_SUCCESS: "auth_success",
  AUTH_FAILURE: "auth_failure",
  DRINK_CREATED: "drink_created",
  DRINK_UPDATED: "drink_updated",
  BILLING_PERIOD_OPENED: "billing_period_opened",
  BILLING_PERIOD_CLOSED: "billing_period_closed",
  PAYMENT_MARKED: "payment_marked",
  PAYMENT_RESET: "payment_reset",
  PAYMENT_SELF_MARKED: "payment_self_marked",
  PAYMENT_SELF_RESET: "payment_self_reset",
  SERVER_ERROR: "server_error",
} as const;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add LOG_EVENT and API_ERROR.INTERNAL_ERROR constants"
```

---

### Task 2: `src/lib/logger.ts`

**Files:**
- Create: `src/lib/logger.ts`
- Test: `src/lib/logger.test.ts`

**Interfaces:**
- Consumes: nothing (pure, dependency-free).
- Produces: `logger.info(event: string, fields?: { userId?: string; meta?: Record<string, unknown> }): void`, `logger.warn(...)` (same signature), `logger.error(...)` (same signature). Every later task that logs imports `{ logger } from "@/lib/logger"` and every route-test task does `vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/logger.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info() calls console.info with event/meta/timestamp and omits userId when not given', () => {
    logger.info('drink_created', { meta: { drinkId: 'd1' } });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(infoSpy.mock.calls[0][0] as string);

    expect(Object.keys(parsed).sort()).toEqual(['event', 'meta', 'timestamp']);
    expect(parsed.event).toBe('drink_created');
    expect(parsed.meta).toEqual({ drinkId: 'd1' });
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it('warn() calls console.warn and includes userId when provided', () => {
    logger.warn('auth_failure', { userId: 'u1', meta: { reason: 'exchange_failed' } });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);

    expect(Object.keys(parsed).sort()).toEqual(['event', 'meta', 'timestamp', 'userId']);
    expect(parsed.userId).toBe('u1');
  });

  it('error() calls console.error and defaults meta to {} when omitted entirely', () => {
    logger.error('server_error');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);

    expect(parsed.event).toBe('server_error');
    expect(parsed.meta).toEqual({});
    expect(parsed.userId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/logger.test.ts`
Expected: FAIL — `Cannot find module './logger'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/logger.ts`:

```ts
export type LogFields = { userId?: string; meta?: Record<string, unknown> };

type LogEntry =
  | { event: string; userId: string; meta: Record<string, unknown>; timestamp: string }
  | { event: string; meta: Record<string, unknown>; timestamp: string };

function buildEntry(event: string, fields?: LogFields): LogEntry {
  const timestamp = new Date().toISOString();
  const meta = fields?.meta ?? {};
  if (fields?.userId !== undefined) {
    return { event, userId: fields.userId, meta, timestamp };
  }
  return { event, meta, timestamp };
}

/**
 * Structured JSON-line logger. Each call emits exactly one console line via
 * the console method matching its severity, so Vercel's log-severity filter
 * (and any future Sentry/Axiom ingestion) can distinguish them.
 */
export const logger = {
  info(event: string, fields?: LogFields) {
    console.info(JSON.stringify(buildEntry(event, fields)));
  },
  warn(event: string, fields?: LogFields) {
    console.warn(JSON.stringify(buildEntry(event, fields)));
  },
  error(event: string, fields?: LogFields) {
    console.error(JSON.stringify(buildEntry(event, fields)));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/logger.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/logger.ts src/lib/logger.test.ts
git commit -m "feat: add structured JSON logger"
```

---

### Task 3: `src/lib/withErrorLogging.ts`

**Files:**
- Create: `src/lib/withErrorLogging.ts`
- Test: `src/lib/withErrorLogging.test.ts`

**Interfaces:**
- Consumes: `logger.error` from `@/lib/logger` (Task 2), `LOG_EVENT.SERVER_ERROR` + `API_ERROR.INTERNAL_ERROR` from `@/lib/constants` (Task 1).
- Produces: `withErrorLogging<Args extends unknown[]>(routeName: string, handler: (...args: Args) => Promise<NextResponse>): (...args: Args) => Promise<NextResponse>`. Every mechanical-wrap and business-event route task (4–10) imports this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/withErrorLogging.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { withErrorLogging } = await import('./withErrorLogging');
const { logger } = await import('./logger');

describe('withErrorLogging', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockReset();
  });

  it('passes the handler response through unchanged on success and never logs', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }, { status: 200 }));
    const wrapped = withErrorLogging('GET /api/example', handler);

    const res = await wrapped();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('catches a thrown exception, logs server_error with the route and message, and returns a 500', async () => {
    const handler = vi.fn(async () => {
      throw new Error('boom');
    });
    const wrapped = withErrorLogging('POST /api/example', handler);

    const res = await wrapped();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
    expect(logger.error).toHaveBeenCalledWith('server_error', {
      meta: { route: 'POST /api/example', message: 'boom' },
    });
  });

  it('stringifies a non-Error throw', async () => {
    const handler = vi.fn(async () => {
      throw 'raw string failure';
    });
    const wrapped = withErrorLogging('POST /api/example', handler);

    await wrapped();

    expect(logger.error).toHaveBeenCalledWith('server_error', {
      meta: { route: 'POST /api/example', message: 'raw string failure' },
    });
  });

  it('forwards arguments to the wrapped handler (dynamic-route signature)', async () => {
    const handler = vi.fn(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      return NextResponse.json({ id });
    });
    const wrapped = withErrorLogging('PATCH /api/example/[id]', handler);

    const res = await wrapped(new Request('http://localhost'), { params: Promise.resolve({ id: 'abc' }) });

    expect(await res.json()).toEqual({ id: 'abc' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/withErrorLogging.test.ts`
Expected: FAIL — `Cannot find module './withErrorLogging'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/withErrorLogging.ts`:

```ts
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT } from "@/lib/constants";

/**
 * Wraps an API route handler so an unexpected thrown exception is logged as
 * server_error and turned into a uniform 500 JSON response instead of
 * crashing the route. Deliberately-returned error responses (401/403/400/...)
 * pass through untouched — this only catches exceptions the handler itself
 * didn't handle.
 */
export function withErrorLogging<Args extends unknown[]>(
  routeName: string,
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(LOG_EVENT.SERVER_ERROR, { meta: { route: routeName, message } });
      return NextResponse.json({ error: API_ERROR.INTERNAL_ERROR }, { status: 500 });
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/withErrorLogging.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/withErrorLogging.ts src/lib/withErrorLogging.test.ts
git commit -m "feat: add withErrorLogging route-handler wrapper"
```

---

### Task 4: Wrap the 5 mechanical (no-business-event) routes

These five routes have no entry in the spec's event catalog — they only gain `withErrorLogging`'s uncaught-exception → `server_error` behavior. None of them currently has a dedicated unit test (only `bookings` has an `.integration.test.ts`, which exercises the real handler and isn't affected by wrapping since the success/auth-error paths are untouched). No new tests are added in this task; the wrapper's own behavior is already fully covered by Task 3. Verification is the full existing test suite plus a manual check that `tsc` stays clean.

**Files:**
- Modify: `src/app/api/bookings/route.ts`
- Modify: `src/app/api/bookings/last/route.ts`
- Modify: `src/app/api/home/route.ts`
- Modify: `src/app/api/me/route.ts`
- Modify: `src/app/api/admin/billing-periods/[id]/members/route.ts`

**Interfaces:**
- Consumes: `withErrorLogging` from `@/lib/withErrorLogging` (Task 3).
- Produces: nothing new consumed by later tasks — these are leaf routes.

- [ ] **Step 1: Wrap `src/app/api/bookings/route.ts`**

Replace the full file contents:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { getActivePeriod, formatPeriodRange, formatDateShort } from "@/lib/period";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { API_ERROR, PERIOD_STATUS, PROFILE_STATUS } from "@/lib/constants";

/** GET → billing periods relevant to the current player, with their bookings + payment status. */
async function getBookings() {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    where: { playerId: player.id },
    include: { drink: true },
    orderBy: { createdAt: "desc" },
  });

  const periodIds = [...new Set(bookings.map((b) => b.periodId))];
  if (periodIds.length === 0) return NextResponse.json({ periods: [] });

  const periods = await prisma.billingPeriod.findMany({
    where: { id: { in: periodIds } },
    orderBy: { startDate: "desc" },
  });

  const payments = await prisma.payment.findMany({
    where: { playerId: player.id, periodId: { in: periodIds } },
  });
  const paidByPeriod = new Map(payments.map((p) => [p.periodId, p.paid]));

  const result = periods.map((period) => {
    const periodBookings = bookings.filter((b) => b.periodId === period.id);
    const total_cents = periodBookings.reduce((s, b) => s + b.drink.priceCents, 0);

    const status =
      period.status === PERIOD_STATUS.ACTIVE
        ? PROFILE_STATUS.ACTIVE
        : paidByPeriod.get(period.id)
          ? PROFILE_STATUS.PAID
          : PROFILE_STATUS.PENDING;

    return {
      id: period.id,
      range: formatPeriodRange(period.startDate, period.endDate),
      status,
      count: periodBookings.length,
      total_cents,
      rows: periodBookings.map((b) => ({
        date: formatDateShort(b.createdAt),
        drink: b.drink.name,
        price_cents: b.drink.priceCents,
      })),
    };
  });

  return NextResponse.json({ periods: result });
}

/** POST { drinkId } → books one drink for the current player in the active period. */
async function postBooking(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const { drinkId } = await request.json();
  if (!drinkId) return NextResponse.json({ error: API_ERROR.DRINK_ID_REQUIRED }, { status: 400 });

  const period = await getActivePeriod();
  if (!period) return NextResponse.json({ error: API_ERROR.NO_ACTIVE_PERIOD }, { status: 409 });

  const booking = await prisma.booking.create({
    data: { playerId: player.id, drinkId, periodId: period.id },
  });

  return NextResponse.json({ id: booking.id });
}

export const GET = withErrorLogging("GET /api/bookings", getBookings);
export const POST = withErrorLogging("POST /api/bookings", postBooking);
```

- [ ] **Step 2: Wrap `src/app/api/bookings/last/route.ts`**

Replace the full file contents:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { API_ERROR } from "@/lib/constants";

/**
 * DELETE ?drinkId=... → removes the current player's most recent booking
 * for the given drink (used for the "undo" toast on the home screen).
 */
async function deleteLastBooking(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const drinkId = searchParams.get("drinkId");
  if (!drinkId) return NextResponse.json({ error: API_ERROR.DRINK_ID_REQUIRED }, { status: 400 });

  const last = await prisma.booking.findFirst({
    where: { playerId: player.id, drinkId },
    orderBy: { createdAt: "desc" },
  });

  if (!last) return NextResponse.json({ error: API_ERROR.NOT_FOUND }, { status: 404 });

  await prisma.booking.delete({ where: { id: last.id } });
  return NextResponse.json({ ok: true });
}

export const DELETE = withErrorLogging("DELETE /api/bookings/last", deleteLastBooking);
```

- [ ] **Step 3: Wrap `src/app/api/home/route.ts`**

Replace the full file contents (only the exported `GET` changes — `getUnpaidClosedPeriod` stays as-is):

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { getActivePeriod, formatPeriodRange, formatDateShort } from "@/lib/period";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { API_ERROR, PERIOD_STATUS } from "@/lib/constants";

/**
 * Finds the most recently closed billing period that the player still owes
 * money for (has a positive total and no recorded/confirmed payment), if any.
 */
async function getUnpaidClosedPeriod(playerId: string) {
  const closedPeriod = await prisma.billingPeriod.findFirst({
    where: { status: PERIOD_STATUS.CLOSED },
    orderBy: { startDate: "desc" },
  });
  if (!closedPeriod) return null;

  const bookings = await prisma.booking.findMany({
    where: { playerId, periodId: closedPeriod.id },
    include: { drink: true },
  });
  const total_cents = bookings.reduce((s, b) => s + b.drink.priceCents, 0);
  if (total_cents <= 0) return null;

  const payment = await prisma.payment.findUnique({
    where: { playerId_periodId: { playerId, periodId: closedPeriod.id } },
  });
  if (payment?.paid) return null;

  return {
    id: closedPeriod.id,
    range: formatPeriodRange(closedPeriod.startDate, closedPeriod.endDate),
    total_cents,
    payment_instructions: closedPeriod.paymentInstructions,
  };
}

/** GET → active drinks with the current player's booking count in the active period. */
async function getHome() {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const drinks = await prisma.drink.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const period = await getActivePeriod();

  const bookings = period
    ? await prisma.booking.findMany({
        where: { playerId: player.id, periodId: period.id },
      })
    : [];

  const countByDrink = new Map<string, number>();
  for (const b of bookings) {
    countByDrink.set(b.drinkId, (countByDrink.get(b.drinkId) ?? 0) + 1);
  }

  const closedPeriod = await getUnpaidClosedPeriod(player.id);

  // First-visit welcome: true until the player completes it (sets onboarded_at).
  // Raw SQL so this compiles before `prisma generate` adds the new column.
  const onboardRows = await prisma.$queryRaw<{ onboarded_at: Date | null }[]>`
    SELECT onboarded_at FROM players WHERE id = ${player.id}
  `;
  const firstVisit = onboardRows[0]?.onboarded_at == null;

  return NextResponse.json({
    periodId: period?.id ?? null,
    periodStart: period ? formatDateShort(period.startDate) : null,
    playerName: player.name,
    firstVisit,
    drinks: drinks.map((d) => ({
      id: d.id,
      name: d.name,
      price_cents: d.priceCents,
      count: countByDrink.get(d.id) ?? 0,
    })),
    closedPeriod,
  });
}

export const GET = withErrorLogging("GET /api/home", getHome);
```

- [ ] **Step 4: Wrap `src/app/api/me/route.ts`**

Replace the full file contents:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { API_ERROR } from "@/lib/constants";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const player = await prisma.player.findUnique({ where: { id: user.id } });

  if (!player) return NextResponse.json({ error: API_ERROR.NOT_FOUND }, { status: 404 });

  return NextResponse.json({
    id: player.id,
    name: player.name,
    isAdmin: player.isAdmin,
  });
}

/** PATCH { name, onboarded? } → updates the display name; marks the first-visit welcome done. */
async function patchMe(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const { name, onboarded } = await request.json();
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return NextResponse.json({ error: API_ERROR.NAME_REQUIRED }, { status: 400 });

  const player = await prisma.player.update({
    where: { id: user.id },
    data: { name: trimmed },
  });

  // Mark the first-visit welcome as completed (only the first time).
  // Raw SQL so this compiles before `prisma generate` adds the new column.
  if (onboarded === true) {
    await prisma.$executeRaw`UPDATE players SET onboarded_at = now() WHERE id = ${user.id} AND onboarded_at IS NULL`;
  }

  return NextResponse.json({
    id: player.id,
    name: player.name,
    isAdmin: player.isAdmin,
  });
}

export const GET = withErrorLogging("GET /api/me", getMe);
export const PATCH = withErrorLogging("PATCH /api/me", patchMe);
```

- [ ] **Step 5: Wrap `src/app/api/admin/billing-periods/[id]/members/route.ts`**

Replace the full file contents:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";

/** GET → per-member booking + payment breakdown for the given billing period. */
async function getMembers(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: periodId } = await params;

  const bookings = await prisma.booking.findMany({
    where: { periodId },
    include: { drink: true, player: true },
  });

  const payments = await prisma.payment.findMany({ where: { periodId } });
  const paidByPlayer = new Map(payments.map((p) => [p.playerId, p.paid]));

  const byPlayer = new Map<
    string,
    { id: string; name: string; count: number; total_cents: number; items: Map<string, { drink: string; count: number; price_cents: number }> }
  >();

  for (const b of bookings) {
    if (!byPlayer.has(b.playerId)) {
      byPlayer.set(b.playerId, {
        id: b.playerId,
        name: b.player.name,
        count: 0,
        total_cents: 0,
        items: new Map(),
      });
    }
    const entry = byPlayer.get(b.playerId)!;
    entry.count += 1;
    entry.total_cents += b.drink.priceCents;

    const item = entry.items.get(b.drinkId) ?? { drink: b.drink.name, count: 0, price_cents: b.drink.priceCents };
    item.count += 1;
    entry.items.set(b.drinkId, item);
  }

  const members = [...byPlayer.values()].map((m) => ({
    id: m.id,
    name: m.name,
    count: m.count,
    total_cents: m.total_cents,
    paid: paidByPlayer.get(m.id) ?? false,
    items: [...m.items.values()],
  }));

  return NextResponse.json({ members });
}

export const GET = withErrorLogging("GET /api/admin/billing-periods/[id]/members", getMembers);
```

- [ ] **Step 6: Run the full unit test suite**

Run: `npm test`
Expected: PASS, no regressions (these routes have no unit tests, so this just confirms nothing else broke — e.g. any snapshot/component test that imports these modules transitively).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Run the integration suite covering `bookings`**

Run: `npm run test:integration -- src/app/api/bookings/route.integration.test.ts`
Expected: PASS — confirms wrapping didn't change the auth-gating / success behavior this test already covers.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/bookings/route.ts src/app/api/bookings/last/route.ts src/app/api/home/route.ts src/app/api/me/route.ts "src/app/api/admin/billing-periods/[id]/members/route.ts"
git commit -m "feat: wrap bookings, home, me, and members routes with withErrorLogging"
```

---

### Task 5: `admin/drinks` route — wrap + `drink_created` logging

**Files:**
- Modify: `src/app/api/admin/drinks/route.ts`
- Test: `src/app/api/admin/drinks/route.test.ts` (new)

**Interfaces:**
- Consumes: `withErrorLogging` (Task 3), `logger` (Task 2), `LOG_EVENT.DRINK_CREATED` (Task 1), `requireAdmin` (existing, returns `{ player: Player, error?: undefined } | { player?: undefined, error: NextResponse }`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/drinks/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const requireAdmin = vi.fn();
const create = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { drink: { create, findMany: vi.fn() } } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { POST } = await import('./route');
const { logger } = await import('@/lib/logger');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/drinks', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/admin/drinks', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    create.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('creates the drink and logs drink_created with the admin id and drink fields', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    create.mockResolvedValue({ id: 'drink-1', name: 'Radler', priceCents: 140, active: true });

    const res = await POST(postRequest({ name: 'Radler', price_cents: 140, active: true }));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('drink_created', {
      userId: 'admin-1',
      meta: { drinkId: 'drink-1', name: 'Radler', price_cents: 140, active: true },
    });
  });

  it('does not create or log when requireAdmin rejects the request', async () => {
    requireAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });

    const res = await POST(postRequest({ name: 'Radler', price_cents: 140 }));

    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/admin/drinks/route.test.ts`
Expected: FAIL — first test fails because `logger.info` is not called yet (current route has no logging).

- [ ] **Step 3: Implement**

Replace the full contents of `src/app/api/admin/drinks/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT } from "@/lib/constants";

/** GET → all drinks (active + inactive). */
async function getDrinks() {
  const { error } = await requireAdmin();
  if (error) return error;

  const drinks = await prisma.drink.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    drinks: drinks.map((d) => ({ id: d.id, name: d.name, price_cents: d.priceCents, active: d.active })),
  });
}

/** POST { name, price_cents, active } → creates a new drink. */
async function postDrink(request: Request) {
  const { player, error } = await requireAdmin();
  if (error) return error;

  const { name, price_cents, active } = await request.json();
  if (!name || typeof price_cents !== "number") {
    return NextResponse.json({ error: API_ERROR.NAME_AND_PRICE_REQUIRED }, { status: 400 });
  }

  const drink = await prisma.drink.create({
    data: { name, priceCents: price_cents, active: active ?? true },
  });

  logger.info(LOG_EVENT.DRINK_CREATED, {
    userId: player.id,
    meta: { drinkId: drink.id, name: drink.name, price_cents: drink.priceCents, active: drink.active },
  });

  return NextResponse.json({ id: drink.id });
}

export const GET = withErrorLogging("GET /api/admin/drinks", getDrinks);
export const POST = withErrorLogging("POST /api/admin/drinks", postDrink);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/admin/drinks/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing integration test for this route**

Run: `npm run test:integration -- src/app/api/admin/drinks/route.integration.test.ts`
Expected: PASS — auth-gating and creation behavior unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/drinks/route.ts src/app/api/admin/drinks/route.test.ts
git commit -m "feat: log drink_created and wrap admin drinks route"
```

---

### Task 6: `admin/drinks/[id]` route — wrap + `drink_updated` logging

**Files:**
- Modify: `src/app/api/admin/drinks/[id]/route.ts`
- Test: `src/app/api/admin/drinks/[id]/route.test.ts` (new)

**Interfaces:**
- Consumes: same as Task 5.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/drinks/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const requireAdmin = vi.fn();
const update = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { drink: { update } } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { PATCH } = await import('./route');
const { logger } = await import('@/lib/logger');

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/drinks/drink-1', { method: 'PATCH', body: JSON.stringify(body) });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/admin/drinks/[id]', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    update.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('updates the drink and logs drink_updated with only the changed fields', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    update.mockResolvedValue({});

    const res = await PATCH(patchRequest({ price_cents: 160 }), ctx('drink-1'));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('drink_updated', {
      userId: 'admin-1',
      meta: { drinkId: 'drink-1', changes: { priceCents: 160 } },
    });
  });

  it('does not update or log when requireAdmin rejects the request', async () => {
    requireAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });

    const res = await PATCH(patchRequest({ price_cents: 160 }), ctx('drink-1'));

    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/admin/drinks/[id]/route.test.ts"`
Expected: FAIL — `logger.info` not called yet.

- [ ] **Step 3: Implement**

Replace the full contents of `src/app/api/admin/drinks/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { LOG_EVENT } from "@/lib/constants";

/** PATCH { name?, price_cents?, active? } → updates a drink. */
async function patchDrink(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { player, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const data: { name?: string; priceCents?: number; active?: boolean } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.price_cents === "number") data.priceCents = body.price_cents;
  if (typeof body.active === "boolean") data.active = body.active;

  await prisma.drink.update({ where: { id }, data });

  logger.info(LOG_EVENT.DRINK_UPDATED, { userId: player.id, meta: { drinkId: id, changes: data } });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorLogging("PATCH /api/admin/drinks/[id]", patchDrink);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/admin/drinks/[id]/route.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/admin/drinks/[id]/route.ts" "src/app/api/admin/drinks/[id]/route.test.ts"
git commit -m "feat: log drink_updated and wrap admin drink-by-id route"
```

---

### Task 7: `admin/billing-periods` route — wrap + rotation refactor + open/close logging

**Files:**
- Modify: `src/app/api/admin/billing-periods/route.ts`
- Test: `src/app/api/admin/billing-periods/route.test.ts` (new)
- Existing: `src/app/api/admin/billing-periods/route.integration.test.ts` (verify unchanged behavior, no edits expected)

**Interfaces:**
- Consumes: same as Task 5, plus `PERIOD_STATUS` (existing).
- Produces: nothing consumed by later tasks.

**Behavior change:** `updateMany` (no id) → `findFirst` + `update`, so the closed period's real id can be logged. Per the spec, the resulting DB state is identical — only one period can ever be active (app invariant), so `findFirst` finds the same row `updateMany` would have updated.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/billing-periods/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdmin = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({
  prisma: { billingPeriod: { findFirst, update, create, findMany: vi.fn() } },
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { POST } = await import('./route');
const { logger } = await import('@/lib/logger');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/admin/billing-periods', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    findFirst.mockReset();
    update.mockReset();
    create.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('closes the previous active period by id, then logs billing_period_closed and billing_period_opened', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findFirst.mockResolvedValue({ id: 'old-period' });
    update.mockResolvedValue({});
    create.mockResolvedValue({ id: 'new-period' });

    const res = await POST(postRequest({ startDate: '2026-07-01', endDate: null, paymentInstructions: 'IBAN X' }));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'old-period' },
      data: { status: 'closed', endDate: new Date('2026-07-01') },
    });
    expect(logger.info).toHaveBeenNthCalledWith(1, 'billing_period_closed', {
      userId: 'admin-1',
      meta: { periodId: 'old-period' },
    });
    expect(logger.info).toHaveBeenNthCalledWith(2, 'billing_period_opened', {
      userId: 'admin-1',
      meta: { periodId: 'new-period', startDate: '2026-07-01', endDate: null },
    });
  });

  it('skips billing_period_closed when there was no active period', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'new-period' });

    await POST(postRequest({ startDate: '2026-07-01' }));

    expect(update).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('billing_period_opened', {
      userId: 'admin-1',
      meta: { periodId: 'new-period', startDate: '2026-07-01', endDate: null },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/admin/billing-periods/route.test.ts`
Expected: FAIL — current route uses `updateMany` (never calls the mocked `update`/`findFirst`) and doesn't log.

- [ ] **Step 3: Implement**

Replace the full contents of `src/app/api/admin/billing-periods/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formatPeriodRange } from "@/lib/period";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT, PERIOD_STATUS } from "@/lib/constants";

/** GET → all billing periods, newest first. */
async function getBillingPeriods() {
  const { error } = await requireAdmin();
  if (error) return error;

  const periods = await prisma.billingPeriod.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json({
    periods: periods.map((p) => ({
      id: p.id,
      range: formatPeriodRange(p.startDate, p.endDate),
      status: p.status,
      paymentInstructions: p.paymentInstructions,
    })),
  });
}

/**
 * POST { startDate, endDate, paymentInstructions } → closes the current
 * active period (if any) and opens a new one.
 */
async function postBillingPeriod(request: Request) {
  const { player, error } = await requireAdmin();
  if (error) return error;

  const { startDate, endDate, paymentInstructions } = await request.json();
  if (!startDate) return NextResponse.json({ error: API_ERROR.START_DATE_REQUIRED }, { status: 400 });

  // findFirst (not updateMany) so we get the previous period's id back to log it.
  // Only one period is ever active at a time (app invariant), so this closes
  // the same row updateMany would have — no behavior change.
  const previousActive = await prisma.billingPeriod.findFirst({
    where: { status: PERIOD_STATUS.ACTIVE },
  });
  if (previousActive) {
    await prisma.billingPeriod.update({
      where: { id: previousActive.id },
      data: { status: PERIOD_STATUS.CLOSED, endDate: endDate ? new Date(endDate) : new Date(startDate) },
    });
    logger.info(LOG_EVENT.BILLING_PERIOD_CLOSED, {
      userId: player.id,
      meta: { periodId: previousActive.id },
    });
  }

  const period = await prisma.billingPeriod.create({
    data: {
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: PERIOD_STATUS.ACTIVE,
      paymentInstructions: paymentInstructions ?? null,
    },
  });

  logger.info(LOG_EVENT.BILLING_PERIOD_OPENED, {
    userId: player.id,
    meta: { periodId: period.id, startDate, endDate: endDate ?? null },
  });

  return NextResponse.json({ id: period.id });
}

export const GET = withErrorLogging("GET /api/admin/billing-periods", getBillingPeriods);
export const POST = withErrorLogging("POST /api/admin/billing-periods", postBillingPeriod);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/admin/billing-periods/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing integration test to confirm the DB-observable behavior is unchanged**

Run: `npm run test:integration -- src/app/api/admin/billing-periods/route.integration.test.ts`
Expected: PASS — same closed/active/endDate assertions as before, now driven by `findFirst`+`update` instead of `updateMany`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/billing-periods/route.ts src/app/api/admin/billing-periods/route.test.ts
git commit -m "feat: log billing_period_opened/closed and wrap admin billing-periods route"
```

---

### Task 8: `admin/payments` route — wrap + `payment_marked`/`payment_reset` logging

**Files:**
- Modify: `src/app/api/admin/payments/route.ts`
- Test: `src/app/api/admin/payments/route.test.ts` (new)

**Interfaces:**
- Consumes: same as Task 5, plus `LOG_EVENT.PAYMENT_MARKED` / `LOG_EVENT.PAYMENT_RESET`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/payments/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const requireAdmin = vi.fn();
const upsert = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { upsert } } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { PATCH } = await import('./route');
const { logger } = await import('@/lib/logger');

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/payments', { method: 'PATCH', body: JSON.stringify(body) });
}

describe('PATCH /api/admin/payments', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    upsert.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('logs payment_marked (by the admin, about the target player) when paid is true', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    upsert.mockResolvedValue({});

    const res = await PATCH(patchRequest({ playerId: 'player-1', periodId: 'period-1', paid: true }));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('payment_marked', {
      userId: 'admin-1',
      meta: { playerId: 'player-1', periodId: 'period-1' },
    });
  });

  it('logs payment_reset when paid is false', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    upsert.mockResolvedValue({});

    await PATCH(patchRequest({ playerId: 'player-1', periodId: 'period-1', paid: false }));

    expect(logger.info).toHaveBeenCalledWith('payment_reset', {
      userId: 'admin-1',
      meta: { playerId: 'player-1', periodId: 'period-1' },
    });
  });

  it('does not upsert or log when requireAdmin rejects the request', async () => {
    requireAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });

    const res = await PATCH(patchRequest({ playerId: 'player-1', periodId: 'period-1', paid: true }));

    expect(res.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/admin/payments/route.test.ts`
Expected: FAIL — `logger.info` not called yet.

- [ ] **Step 3: Implement**

Replace the full contents of `src/app/api/admin/payments/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT } from "@/lib/constants";

/** PATCH { playerId, periodId, paid } → upserts a player's payment status for a period. */
async function patchPayment(request: Request) {
  const { player, error } = await requireAdmin();
  if (error) return error;

  const { playerId, periodId, paid } = await request.json();
  if (!playerId || !periodId || typeof paid !== "boolean") {
    return NextResponse.json({ error: API_ERROR.PAYMENT_FIELDS_REQUIRED }, { status: 400 });
  }

  await prisma.payment.upsert({
    where: { playerId_periodId: { playerId, periodId } },
    update: { paid, paidAt: paid ? new Date() : null },
    create: { playerId, periodId, paid, paidAt: paid ? new Date() : null },
  });

  logger.info(paid ? LOG_EVENT.PAYMENT_MARKED : LOG_EVENT.PAYMENT_RESET, {
    userId: player.id,
    meta: { playerId, periodId },
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorLogging("PATCH /api/admin/payments", patchPayment);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/admin/payments/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/payments/route.ts src/app/api/admin/payments/route.test.ts
git commit -m "feat: log payment_marked/payment_reset and wrap admin payments route"
```

---

### Task 9: `payments` (self-service) route — wrap + `payment_self_marked`/`payment_self_reset` logging

**Files:**
- Modify: `src/app/api/payments/route.ts`
- Test: `src/app/api/payments/route.test.ts` (new)

**Interfaces:**
- Consumes: `withErrorLogging` (Task 3), `logger` (Task 2), `LOG_EVENT.PAYMENT_SELF_MARKED` / `LOG_EVENT.PAYMENT_SELF_RESET` (Task 1), `getCurrentPlayer` (existing, returns `Player | null`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/payments/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCurrentPlayer = vi.fn();
const upsert = vi.fn();

vi.mock('@/lib/auth', () => ({ getCurrentPlayer }));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { upsert } } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { POST } = await import('./route');
const { logger } = await import('@/lib/logger');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/payments', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/payments', () => {
  beforeEach(() => {
    getCurrentPlayer.mockReset();
    upsert.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('logs payment_self_marked with the player\'s own id when paid is true', async () => {
    getCurrentPlayer.mockResolvedValue({ id: 'player-1', isAdmin: false });
    upsert.mockResolvedValue({});

    const res = await POST(postRequest({ periodId: 'period-1', paid: true }));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('payment_self_marked', {
      userId: 'player-1',
      meta: { periodId: 'period-1' },
    });
  });

  it('logs payment_self_reset when paid is false', async () => {
    getCurrentPlayer.mockResolvedValue({ id: 'player-1', isAdmin: false });
    upsert.mockResolvedValue({});

    await POST(postRequest({ periodId: 'period-1', paid: false }));

    expect(logger.info).toHaveBeenCalledWith('payment_self_reset', {
      userId: 'player-1',
      meta: { periodId: 'period-1' },
    });
  });

  it('does not upsert or log when there is no logged-in player', async () => {
    getCurrentPlayer.mockResolvedValue(null);

    const res = await POST(postRequest({ periodId: 'period-1', paid: true }));

    expect(res.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/payments/route.test.ts`
Expected: FAIL — `logger.info` not called yet.

- [ ] **Step 3: Implement**

Replace the full contents of `src/app/api/payments/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT } from "@/lib/constants";

/** POST { periodId, paid } → the current player marks their own payment for a period. */
async function postPayment(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const { periodId, paid } = await request.json();
  if (!periodId || typeof paid !== "boolean") {
    return NextResponse.json({ error: API_ERROR.PAYMENT_FIELDS_REQUIRED }, { status: 400 });
  }

  await prisma.payment.upsert({
    where: { playerId_periodId: { playerId: player.id, periodId } },
    update: { paid, paidAt: paid ? new Date() : null },
    create: { playerId: player.id, periodId, paid, paidAt: paid ? new Date() : null },
  });

  logger.info(paid ? LOG_EVENT.PAYMENT_SELF_MARKED : LOG_EVENT.PAYMENT_SELF_RESET, {
    userId: player.id,
    meta: { periodId },
  });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging("POST /api/payments", postPayment);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/payments/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/payments/route.ts src/app/api/payments/route.test.ts
git commit -m "feat: log payment_self_marked/payment_self_reset and wrap self-service payments route"
```

---

### Task 10: `auth/callback` route — direct logger calls (no HOF wrap)

**Files:**
- Modify: `src/app/auth/callback/route.ts`
- Test: `src/app/auth/callback/route.test.ts` (new — no test currently exists for this route)

**Interfaces:**
- Consumes: `logger` (Task 2), `LOG_EVENT.{AUTH_SUCCESS,AUTH_FAILURE,SERVER_ERROR}` (Task 1).
- Produces: nothing consumed by later tasks. This route is **not** wrapped with `withErrorLogging` (it redirects rather than returning JSON, and already has its own try/catch).

- [ ] **Step 1: Write the failing test**

Create `src/app/auth/callback/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const exchangeCodeForSession = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser, exchangeCodeForSession } }),
}));
vi.mock('@/lib/prisma', () => ({ prisma: { player: { findUnique, create } } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { GET } = await import('./route');
const { logger } = await import('@/lib/logger');

function request(url: string) {
  return new Request(url);
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    getUser.mockReset();
    exchangeCodeForSession.mockReset();
    findUnique.mockReset();
    create.mockReset();
    vi.mocked(logger.info).mockReset();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.error).mockReset();
  });

  it('logs auth_success with the flow and isAdmin for a successful code exchange, existing player', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com', user_metadata: {} } } });
    findUnique.mockResolvedValue({ id: 'user-1', name: 'A', isAdmin: false });

    const res = await GET(request('http://localhost/auth/callback?code=abc'));

    expect(res.headers.get('location')).toContain('/home');
    expect(logger.info).toHaveBeenCalledWith('auth_success', {
      userId: 'user-1',
      meta: { flow: 'code_exchange', isAdmin: false },
    });
  });

  it('logs auth_success with flow "otp" when there is no code param', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-2', email: 'b@c.com', user_metadata: {} } } });
    findUnique.mockResolvedValue({ id: 'user-2', name: 'B', isAdmin: false });

    await GET(request('http://localhost/auth/callback'));

    expect(logger.info).toHaveBeenCalledWith('auth_success', {
      userId: 'user-2',
      meta: { flow: 'otp', isAdmin: false },
    });
  });

  it('logs auth_failure with reason exchange_failed when the code exchange errors, and redirects to /login', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'bad code' } });

    const res = await GET(request('http://localhost/auth/callback?code=bad'));

    expect(res.headers.get('location')).toContain('/login?error=auth');
    expect(logger.warn).toHaveBeenCalledWith('auth_failure', {
      meta: { reason: 'exchange_failed', message: 'bad code' },
    });
  });

  it('logs auth_failure with reason no_user when there is no session user', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(request('http://localhost/auth/callback'));

    expect(res.headers.get('location')).toContain('/login?error=nouser');
    expect(logger.warn).toHaveBeenCalledWith('auth_failure', { meta: { reason: 'no_user' } });
  });

  it('logs server_error and redirects to /login?error=callback on an unexpected exception', async () => {
    getUser.mockRejectedValue(new Error('db down'));

    const res = await GET(request('http://localhost/auth/callback'));

    expect(res.headers.get('location')).toContain('/login?error=callback');
    expect(logger.error).toHaveBeenCalledWith('server_error', {
      meta: { route: 'GET /auth/callback', message: 'db down' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/auth/callback/route.test.ts`
Expected: FAIL — current route calls `console.error`, not `logger.warn`/`logger.error`/`logger.info`.

- [ ] **Step 3: Implement**

Replace the full contents of `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ROUTES, DEFAULT_PLAYER_NAME, LOG_EVENT } from "@/lib/constants";

/** Creates the player row, ensuring the @unique name doesn't collide with an existing one. */
async function ensurePlayer(id: string, baseName: string) {
  const existing = await prisma.player.findUnique({ where: { id } });
  if (existing) return existing;

  const base = baseName.trim() || DEFAULT_PLAYER_NAME;

  // Try the plain name first, then a few suffixed variants, then fall back to an id-based suffix.
  const candidates = [base, `${base} (2)`, `${base} (3)`, `${base} ${id.slice(0, 4)}`];
  for (const name of candidates) {
    try {
      return await prisma.player.create({ data: { id, name } });
    } catch {
      // Most likely a unique-name violation — try the next candidate.
    }
  }
  // Last resort: guaranteed-unique name from the user id.
  return prisma.player.create({ data: { id, name: `${base} ${id.slice(0, 8)}` } });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? ROUTES.HOME;
  const flow = code ? "code_exchange" : "otp";

  try {
    const supabase = await createClient();

    if (code) {
      // OAuth / magic link flow: exchange code for session
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        logger.warn(LOG_EVENT.AUTH_FAILURE, { meta: { reason: "exchange_failed", message: error.message } });
        return NextResponse.redirect(`${origin}/login?error=auth`);
      }
    }
    // No code → OTP flow: session already set by verifyOtp in the browser

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.warn(LOG_EVENT.AUTH_FAILURE, { meta: { reason: "no_user" } });
      return NextResponse.redirect(`${origin}/login?error=nouser`);
    }

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      DEFAULT_PLAYER_NAME;

    const player = await ensurePlayer(user.id, displayName);

    logger.info(LOG_EVENT.AUTH_SUCCESS, { userId: user.id, meta: { flow, isAdmin: player.isAdmin } });

    // Guard admin routes; route admins to their dashboard when they use the normal login.
    if (next.startsWith("/admin") && !player.isAdmin) {
      return NextResponse.redirect(`${origin}${ROUTES.HOME}`);
    }
    if (next === ROUTES.HOME && player.isAdmin) {
      return NextResponse.redirect(`${origin}${ROUTES.ADMIN_DASHBOARD}`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(LOG_EVENT.SERVER_ERROR, { meta: { route: "GET /auth/callback", message } });
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/auth/callback/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/auth/callback/route.ts src/app/auth/callback/route.test.ts
git commit -m "feat: log auth_success/auth_failure/server_error in auth callback"
```

---

### Task 11: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full unit suite**

Run: `npm test`
Expected: PASS, all suites green (including the 8 new test files from Tasks 2–3 and 5–10).

- [ ] **Step 4: Full integration suite**

Run: `npm run test:integration`
Expected: PASS — confirms the `admin/drinks` and `admin/billing-periods` behavior changes (Tasks 5, 7) and the `bookings` wrap (Task 4) didn't alter DB-observable behavior.

- [ ] **Step 5: Coverage sanity check**

Run: `npm run test:coverage`
Expected: `src/lib/logger.ts` and `src/lib/withErrorLogging.ts` show as fully covered; no coverage regression on modified route files.

No commit for this task — it's pure verification. If everything is green, the branch is ready for the PR (per `CLAUDE.md`'s git workflow: no direct pushes to `main`, let CI pass before merging).

---

## Self-Review

**Spec coverage:**
- `logger.ts` (3 severities, 4-key JSON shape, userId omission, meta default) → Task 2. ✓
- `withErrorLogging.ts` (generic over `Args`, passthrough on success, catches + logs + 500 on throw) → Task 3. ✓
- `auth/callback` not wrapped, direct logger calls replacing `console.error` → Task 10. ✓
- `LOG_EVENT` + `API_ERROR.INTERNAL_ERROR` constants → Task 1. ✓
- All 14 event-catalog rows: `auth_success`/`auth_failure` (Task 10), `drink_created` (Task 5), `drink_updated` (Task 6), `billing_period_opened`/`billing_period_closed` (Task 7), `payment_marked`/`payment_reset` (Task 8), `payment_self_marked`/`payment_self_reset` (Task 9), `server_error` (Task 3, exercised everywhere via the wrapper + Task 10's own catch). ✓
- Billing-period rotation `updateMany` → `findFirst`+`update` → Task 7, Step 3, verified against the existing integration test in Step 5. ✓
- All 14 handlers wrapped (5 mechanical in Task 4, 9 business-event ones in Tasks 5–9 — GET+POST admin/drinks, PATCH admin/drinks/[id], GET+POST admin/billing-periods, GET admin/billing-periods/[id]/members, PATCH admin/payments, GET+POST bookings, DELETE bookings/last, GET home, GET+PATCH me, POST payments = 14). ✓
- Testing section: logger.test.ts (Task 2), withErrorLogging.test.ts (Task 3), route tests with `vi.mock('@/lib/logger')` for admin drinks/billing-periods/payments + self payments (Tasks 5, 6, 7, 8, 9), auth/callback test (Task 10). ✓ (These route unit tests are new rather than "extended," since none existed before — noted explicitly in File Structure.)
- Out of scope items (no booking/page-view logging, no 401/403 logging, no Sentry/Axiom) — respected; no task adds any of these. ✓

**Placeholder scan:** no TBD/TODO, no "add appropriate error handling," no "similar to Task N" — every step has full code. ✓

**Type consistency:** `withErrorLogging<Args extends unknown[]>(routeName: string, handler: (...args: Args) => Promise<NextResponse>)` used identically in Task 3's implementation and every call site in Tasks 4–10. `LogFields = { userId?: string; meta?: Record<string, unknown> }` used identically by `logger.ts` (Task 2) and every `logger.info/warn/error` call across Tasks 5–10. `requireAdmin()`'s `{ player, error }` shape matches `src/lib/auth.ts`'s actual return type. ✓
