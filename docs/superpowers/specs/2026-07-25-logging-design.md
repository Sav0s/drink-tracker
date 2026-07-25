# Structured Logging Design

**Date:** 2026-07-25
**Scope:** Targeted structured logging — auth outcomes, admin/self-service payment audit trail, and uncaught server errors. Explicitly *not* logging: individual successful drink bookings, page views (Vercel Analytics covers those). `console.log(JSON.stringify(...))`-based, captured automatically by Vercel; no external logging service (Sentry/Axiom) in this iteration — the field shape is chosen to make that migration mechanical later.

---

## Components

### `src/lib/logger.ts`

Pure, dependency-free structured logger with three severity levels, each mapped to the matching `console` method so Vercel's log-severity filter (and any future Sentry/Axiom ingestion) can distinguish them:

```ts
type LogFields = { userId?: string; meta?: Record<string, unknown> };

logger.info(event: string, fields?: LogFields)   // console.info  — audit trail, auth success
logger.warn(event: string, fields?: LogFields)   // console.warn  — expected auth failures (bad code/OTP)
logger.error(event: string, fields?: LogFields)  // console.error — uncaught exceptions
```

Each call emits a single JSON line with exactly four top-level keys: `{ event, userId, meta, timestamp }`. `timestamp` is `new Date().toISOString()`, generated internally — callers never pass it. `userId` is omitted from the object (not passed as `undefined`) when not applicable; `meta` defaults to `{}` when omitted so the shape is always parseable the same way downstream.

### `src/lib/withErrorLogging.ts`

A small higher-order function applied to every exported route handler in `src/app/api/**/route.ts` (14 handlers total):

```ts
export function withErrorLogging<Args extends unknown[]>(
  routeName: string,
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse>
```

Generic over `Args` so it works unchanged for zero-arg `GET()`, single-arg `(request)`, and dynamic-route `(request, { params })` signatures. On success, passes the response through untouched. On a thrown exception: calls `logger.error(LOG_EVENT.SERVER_ERROR, { meta: { route: routeName, message } })` (message extracted via `e instanceof Error ? e.message : String(e)`), then returns `NextResponse.json({ error: API_ERROR.INTERNAL_ERROR }, { status: 500 })`. Deliberately-returned error responses (401/403/400 from existing validation and `requireAdmin()`) are untouched — this wrapper only catches *unexpected* exceptions, not the app's normal error-response paths.

`auth/callback/route.ts` is **not** wrapped with this HOF — it redirects rather than returning JSON, and already has its own try/catch structure. It's updated to call `logger.info`/`logger.warn`/`logger.error` directly at its existing decision points instead of `console.error`.

### `src/lib/constants.ts` additions

```ts
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

Plus `API_ERROR.INTERNAL_ERROR = "Internal server error"`.

---

## Event Catalog

| Event | Route | Level | `userId` | `meta` |
|---|---|---|---|---|
| `auth_success` | `GET /auth/callback` | info | the logged-in user's id | `{ flow: "code_exchange" \| "otp", isAdmin }` |
| `auth_failure` | `GET /auth/callback` | warn | — | `{ reason: "exchange_failed" \| "no_user", message? }` |
| `drink_created` | `POST /api/admin/drinks` | info | admin id | `{ drinkId, name, price_cents, active }` |
| `drink_updated` | `PATCH /api/admin/drinks/[id]` | info | admin id | `{ drinkId, changes }` (whatever fields were in the request body) |
| `billing_period_closed` | `POST /api/admin/billing-periods` | info | admin id | `{ periodId }` — only logged if a previously-active period existed |
| `billing_period_opened` | `POST /api/admin/billing-periods` | info | admin id | `{ periodId, startDate, endDate }` |
| `payment_marked` / `payment_reset` | `PATCH /api/admin/payments` | info | admin id | `{ playerId, periodId }` |
| `payment_self_marked` / `payment_self_reset` | `POST /api/payments` | info | player id (self) | `{ periodId }` |
| `server_error` | any of the 14 API routes (via `withErrorLogging`) | error | — | `{ route, message }` |

Unexpected exceptions in `auth/callback` (the existing outer `catch`) also log `server_error` with `meta: { route: "GET /auth/callback", message }`, keeping that one event name consistent regardless of where it's thrown from.

---

## Implementation Detail: Billing Period Rotation

`POST /api/admin/billing-periods` currently closes the previous active period with `updateMany` (no way to get its id back). Since only one period can be active at a time (app invariant), this changes to `findFirst` (to get the id, if any) + `update`, so the `billing_period_closed` event can carry a real `periodId`. This is the only behavior-adjacent change; the resulting DB state is identical to before.

---

## Testing

- **`src/lib/logger.test.ts`** — spies on `console.info/warn/error`; asserts each level calls the right console method and the emitted JSON has exactly `{ event, userId?, meta, timestamp }` with a valid ISO timestamp.
- **`src/lib/withErrorLogging.test.ts`** — wraps a stub handler: (1) success path returns the handler's response unchanged and never logs; (2) throwing handler is caught, calls `logger.error` with the right event/route, and returns a 500 with `API_ERROR.INTERNAL_ERROR`.
- **Existing route unit tests** (mocked Prisma) for admin drinks, admin billing-periods, admin payments, and self-service payments get `vi.mock('@/lib/logger')` added, with new assertions that the right event/userId/meta was logged on each mutating path.
- **`auth/callback` route test** — extended to assert `logger.info(LOG_EVENT.AUTH_SUCCESS, ...)` on the happy path and `logger.warn(LOG_EVENT.AUTH_FAILURE, ...)` on the existing failure branches (exchange failure, no user), replacing the current bare `console.error` expectations if any exist.
- No changes needed to integration tests — logging is orthogonal to the auth-gating/transition behavior they cover.

---

## Explicitly Out of Scope

- No logging for individual successful bookings or page views (per task description).
- No logging for `requireAdmin()` 401/403 denials on admin API routes — those are routine access-control responses, not auth *outcomes* in the OTP-debugging sense this task targets.
- No Sentry/Axiom integration — `logger.ts`'s fixed field shape (`event`, `userId`, `meta`, `timestamp`) is chosen to make that swap mechanical later, but the swap itself is future work.
