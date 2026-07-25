# Billing Period Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin edit the active billing period's dates/payment instructions and explicitly mark it done, via a new Edit button and modal on `/admin/dashboard?tab=billing`, replacing today's implicit "creating a new period auto-closes the old one" behavior with an explicit close step.

**Architecture:** Two new sub-resource API routes (`PATCH .../[id]` for field edits, `POST .../[id]/close` for the done-transition) plus a behavior change to the existing `POST /api/admin/billing-periods` (blocks with 409 instead of auto-closing) and a small addition to its `GET` (expose raw `startDate`/`endDate` so the edit modal can prefill date inputs). The UI adds one button, one edit modal, one confirm modal, and one informational modal to the existing admin dashboard billing tab, all following that file's existing inline-modal pattern.

**Tech Stack:** Next.js 16 App Router API routes, Prisma, Chakra UI style props, Vitest (mocked-Prisma unit tests + `*.integration.test.ts` against the real disposable test DB).

## Global Constraints

- Money amounts stay integer cents; not touched by this feature.
- All in-app UI copy is German; code/comments/commits stay English (per `CLAUDE.md`).
- No Tailwind, no inline `style={}` — Chakra style props only, matching the exact tokens already used elsewhere in `src/app/admin/dashboard/page.tsx` (`#141921` surface, `#6478a0` steel/primary, `#e0535f` danger, `rgba(255,255,255,0.12)` borders, etc. — copy these verbatim from the existing edit-drink modal and the account page's leave-confirm modal, don't invent new tokens).
- New/changed API route logic needs corresponding tests in the same PR (per `CLAUDE.md`).
- The single-active-period invariant (`getActivePeriod()` in `src/lib/period.ts`) must hold after every task — at most one `BillingPeriod` row has `status: "active"` at any time.
- This plan targets `main` as it stands today (no structured-logging dependency — that feature is a separate, not-yet-merged PR; do not add `logger`/`withErrorLogging` calls in this work).
- Full spec: `docs/superpowers/specs/2026-07-25-billing-period-edit-design.md`.

---

## File Structure

**New files:**
- `src/app/api/admin/billing-periods/[id]/route.ts` — `PATCH` for date/payment-instructions edits on the active period.
- `src/app/api/admin/billing-periods/[id]/route.test.ts` — unit tests (mocked Prisma/auth).
- `src/app/api/admin/billing-periods/[id]/route.integration.test.ts` — integration tests (real disposable DB).
- `src/app/api/admin/billing-periods/[id]/close/route.ts` — `POST` to mark the active period done.
- `src/app/api/admin/billing-periods/[id]/close/route.test.ts` — unit tests.
- `src/app/api/admin/billing-periods/[id]/close/route.integration.test.ts` — integration tests.

**Modified files:**
- `src/lib/constants.ts` — three new `API_ERROR` entries.
- `src/app/api/admin/billing-periods/route.ts` — `GET` gains raw `startDate`/`endDate` fields; `POST` drops its auto-close `updateMany` and instead 409s when a period is already active.
- `src/app/api/admin/billing-periods/route.integration.test.ts` — replace the auto-close assertions with 409-when-active / succeeds-once-none-active assertions; extend the `GET` case to check the new fields.
- `src/app/admin/dashboard/page.tsx` — new state, three new handler functions, one modified handler (`openNewPeriod`), one new toolbar button, three new modals.

No `unit test file exists today for src/app/api/admin/billing-periods/route.ts beyond its integration test — this plan keeps that established pattern (integration tests for this route's DB-state transitions) rather than introducing a new mocked-unit-test file for it, since the design spec's testing intent (the transition logic is meaningfully DB-state-dependent) is already met.

---

### Task 1: `API_ERROR` constants

**Files:**
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Produces: `API_ERROR.PERIOD_NOT_ACTIVE`, `API_ERROR.END_DATE_BEFORE_START`, `API_ERROR.ACTIVE_PERIOD_EXISTS` (all `string`). Tasks 2, 3, and 4 import these.

Trivial glue (a constants object) — no dedicated test, per `CLAUDE.md`'s "trivial glue code... can be skipped."

- [ ] **Step 1: Add the three new error messages**

In `src/lib/constants.ts`, add to the existing `API_ERROR` object (after `PAYMENT_FIELDS_REQUIRED`):

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
  PERIOD_NOT_ACTIVE: "Billing period is not active",
  END_DATE_BEFORE_START: "endDate must not be before startDate",
  ACTIVE_PERIOD_EXISTS: "An active billing period already exists",
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add billing-period-edit error constants"
```

---

### Task 2: `PATCH /api/admin/billing-periods/[id]`

**Files:**
- Create: `src/app/api/admin/billing-periods/[id]/route.ts`
- Test: `src/app/api/admin/billing-periods/[id]/route.test.ts`
- Test: `src/app/api/admin/billing-periods/[id]/route.integration.test.ts`

**Interfaces:**
- Consumes: `requireAdmin()` from `@/lib/auth` (existing), `API_ERROR.{PERIOD_NOT_ACTIVE,START_DATE_REQUIRED,END_DATE_BEFORE_START,NOT_FOUND}` (`NOT_FOUND` existing, others from Task 1), `PERIOD_STATUS.ACTIVE` (existing).
- Produces: nothing consumed by later tasks in this plan (Task 5's UI calls this route by URL, not by import).

- [ ] **Step 1: Write the failing unit test**

Create `src/app/api/admin/billing-periods/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdmin = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { billingPeriod: { findUnique, update } } }));

const { PATCH } = await import('./route');

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods/period-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/admin/billing-periods/[id]', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    findUnique.mockReset();
    update.mockReset();
  });

  it('updates only the sent fields on an active period', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({
      id: 'period-1', status: 'active', startDate: new Date('2026-07-01'), endDate: null, paymentInstructions: null,
    });
    update.mockResolvedValue({});

    const res = await PATCH(patchRequest({ paymentInstructions: 'IBAN X' }), ctx('period-1'));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { paymentInstructions: 'IBAN X' },
    });
  });

  it('rejects with 400 when the target period is not active', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({
      id: 'period-1', status: 'closed', startDate: new Date('2026-06-01'), endDate: new Date('2026-07-01'), paymentInstructions: null,
    });

    const res = await PATCH(patchRequest({ paymentInstructions: 'IBAN X' }), ctx('period-1'));

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the resulting endDate is before startDate', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({
      id: 'period-1', status: 'active', startDate: new Date('2026-07-10'), endDate: null, paymentInstructions: null,
    });

    const res = await PATCH(patchRequest({ endDate: '2026-07-01' }), ctx('period-1'));

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 404 when the period does not exist', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue(null);

    const res = await PATCH(patchRequest({ paymentInstructions: 'IBAN X' }), ctx('missing'));

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/admin/billing-periods/[id]/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/admin/billing-periods/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { API_ERROR, PERIOD_STATUS } from "@/lib/constants";

/** PATCH { startDate?, endDate?, paymentInstructions? } → updates the active billing period. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const period = await prisma.billingPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: API_ERROR.NOT_FOUND }, { status: 404 });
  if (period.status !== PERIOD_STATUS.ACTIVE) {
    return NextResponse.json({ error: API_ERROR.PERIOD_NOT_ACTIVE }, { status: 400 });
  }

  const data: { startDate?: Date; endDate?: Date | null; paymentInstructions?: string | null } = {};
  if ("startDate" in body) {
    if (!body.startDate) return NextResponse.json({ error: API_ERROR.START_DATE_REQUIRED }, { status: 400 });
    data.startDate = new Date(body.startDate);
  }
  if ("endDate" in body) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }
  if ("paymentInstructions" in body) {
    data.paymentInstructions = body.paymentInstructions || null;
  }

  const nextStartDate = data.startDate ?? period.startDate;
  const nextEndDate = "endDate" in data ? data.endDate : period.endDate;
  if (nextEndDate && nextEndDate < nextStartDate) {
    return NextResponse.json({ error: API_ERROR.END_DATE_BEFORE_START }, { status: 400 });
  }

  await prisma.billingPeriod.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/admin/billing-periods/[id]/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the integration test**

Create `src/app/api/admin/billing-periods/[id]/route.integration.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlayer, seedActivePeriod } from '@/test-integration-helpers';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { PATCH } = await import('./route');

function patchRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/admin/billing-periods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('/api/admin/billing-periods/[id]', () => {
  it('PATCH rejects non-admins with 403', async () => {
    const player = await seedPlayer({ isAdmin: false });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });
    const period = await seedActivePeriod();

    const res = await PATCH(patchRequest(period.id, { paymentInstructions: 'IBAN X' }), ctx(period.id));

    expect(res.status).toBe(403);
  });

  it('PATCH updates the active period', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    const period = await seedActivePeriod({ startDate: new Date('2026-07-01') });

    const res = await PATCH(
      patchRequest(period.id, { endDate: '2026-07-15', paymentInstructions: 'IBAN X' }),
      ctx(period.id)
    );

    expect(res.status).toBe(200);
    const updated = await prisma.billingPeriod.findUnique({ where: { id: period.id } });
    expect(updated?.endDate?.toISOString().slice(0, 10)).toBe('2026-07-15');
    expect(updated?.paymentInstructions).toBe('IBAN X');
  });

  it('PATCH rejects editing a closed period', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    const period = await prisma.billingPeriod.create({
      data: { startDate: new Date('2026-06-01'), endDate: new Date('2026-07-01'), status: 'closed' },
    });

    const res = await PATCH(patchRequest(period.id, { paymentInstructions: 'IBAN X' }), ctx(period.id));

    expect(res.status).toBe(400);
    const stillClosed = await prisma.billingPeriod.findUnique({ where: { id: period.id } });
    expect(stillClosed?.paymentInstructions).toBeNull();
  });
});
```

- [ ] **Step 6: Run the integration test**

Run: `npm run test:integration -- src/app/api/admin/billing-periods/[id]/route.integration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/admin/billing-periods/[id]/route.ts" "src/app/api/admin/billing-periods/[id]/route.test.ts" "src/app/api/admin/billing-periods/[id]/route.integration.test.ts"
git commit -m "feat: add PATCH /api/admin/billing-periods/[id] for editing the active period"
```

---

### Task 3: `POST /api/admin/billing-periods/[id]/close`

**Files:**
- Create: `src/app/api/admin/billing-periods/[id]/close/route.ts`
- Test: `src/app/api/admin/billing-periods/[id]/close/route.test.ts`
- Test: `src/app/api/admin/billing-periods/[id]/close/route.integration.test.ts`

**Interfaces:**
- Consumes: same as Task 2.
- Produces: nothing consumed by later tasks in this plan (called by URL from Task 5's UI).

- [ ] **Step 1: Write the failing unit test**

Create `src/app/api/admin/billing-periods/[id]/close/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdmin = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { billingPeriod: { findUnique, update } } }));

const { POST } = await import('./route');

function closeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods/period-1/close', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/admin/billing-periods/[id]/close', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    findUnique.mockReset();
    update.mockReset();
  });

  it('closes an active period using the sent endDate', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({ id: 'period-1', status: 'active', endDate: null });
    update.mockResolvedValue({});

    const res = await POST(closeRequest({ endDate: '2026-07-20' }), ctx('period-1'));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { status: 'closed', endDate: new Date('2026-07-20') },
    });
  });

  it('keeps the existing endDate when none is sent and one is already set', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({ id: 'period-1', status: 'active', endDate: new Date('2026-07-05') });
    update.mockResolvedValue({});

    await POST(closeRequest({ endDate: null }), ctx('period-1'));

    expect(update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { status: 'closed', endDate: new Date('2026-07-05') },
    });
  });

  it('defaults endDate to today when none is sent and none already exists', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({ id: 'period-1', status: 'active', endDate: null });
    update.mockResolvedValue({});

    const before = new Date();
    await POST(closeRequest({ endDate: null }), ctx('period-1'));
    const after = new Date();

    const calledEndDate = update.mock.calls[0][0].data.endDate as Date;
    expect(calledEndDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(calledEndDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('rejects with 400 when the target period is already closed', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({ id: 'period-1', status: 'closed', endDate: new Date('2026-07-01') });

    const res = await POST(closeRequest({ endDate: null }), ctx('period-1'));

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/admin/billing-periods/[id]/close/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/admin/billing-periods/[id]/close/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { API_ERROR, PERIOD_STATUS } from "@/lib/constants";

/** POST { endDate? } → marks the active billing period done (closed). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { endDate } = await request.json();

  const period = await prisma.billingPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: API_ERROR.NOT_FOUND }, { status: 404 });
  if (period.status !== PERIOD_STATUS.ACTIVE) {
    return NextResponse.json({ error: API_ERROR.PERIOD_NOT_ACTIVE }, { status: 400 });
  }

  await prisma.billingPeriod.update({
    where: { id },
    data: {
      status: PERIOD_STATUS.CLOSED,
      endDate: endDate ? new Date(endDate) : (period.endDate ?? new Date()),
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/admin/billing-periods/[id]/close/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the integration test**

Create `src/app/api/admin/billing-periods/[id]/close/route.integration.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlayer, seedActivePeriod } from '@/test-integration-helpers';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { POST } = await import('./route');

function closeRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/admin/billing-periods/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('/api/admin/billing-periods/[id]/close', () => {
  it('rejects non-admins with 403', async () => {
    const player = await seedPlayer({ isAdmin: false });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });
    const period = await seedActivePeriod();

    const res = await POST(closeRequest(period.id, { endDate: null }), ctx(period.id));

    expect(res.status).toBe(403);
  });

  it('closes the active period, leaving zero active periods', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    const period = await seedActivePeriod({ startDate: new Date('2026-07-01') });

    const res = await POST(closeRequest(period.id, { endDate: '2026-07-20' }), ctx(period.id));

    expect(res.status).toBe(200);
    const closed = await prisma.billingPeriod.findUnique({ where: { id: period.id } });
    expect(closed?.status).toBe('closed');
    expect(closed?.endDate?.toISOString().slice(0, 10)).toBe('2026-07-20');

    const activePeriods = await prisma.billingPeriod.findMany({ where: { status: 'active' } });
    expect(activePeriods).toHaveLength(0);
  });

  it('rejects closing an already-closed period', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    const period = await prisma.billingPeriod.create({
      data: { startDate: new Date('2026-06-01'), endDate: new Date('2026-07-01'), status: 'closed' },
    });

    const res = await POST(closeRequest(period.id, { endDate: null }), ctx(period.id));

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run the integration test**

Run: `npm run test:integration -- src/app/api/admin/billing-periods/[id]/close/route.integration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/admin/billing-periods/[id]/close/route.ts" "src/app/api/admin/billing-periods/[id]/close/route.test.ts" "src/app/api/admin/billing-periods/[id]/close/route.integration.test.ts"
git commit -m "feat: add POST /api/admin/billing-periods/[id]/close to mark a period done"
```

---

### Task 4: Modify `GET`/`POST /api/admin/billing-periods`

**Files:**
- Modify: `src/app/api/admin/billing-periods/route.ts`
- Modify: `src/app/api/admin/billing-periods/route.integration.test.ts`

**Interfaces:**
- Consumes: `getActivePeriod()` from `@/lib/period` (existing), `API_ERROR.ACTIVE_PERIOD_EXISTS` (Task 1).
- Produces: `GET`'s response now includes `startDate: string` (YYYY-MM-DD) and `endDate: string | null` per period — Task 5's UI reads these to prefill the edit modal.

- [ ] **Step 1: Update the integration test first (documents the new behavior)**

Replace the full contents of `src/app/api/admin/billing-periods/route.integration.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlayer, seedActivePeriod } from '@/test-integration-helpers';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { GET, POST } = await import('./route');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('/api/admin/billing-periods', () => {
  it('POST rejects non-admins with 403', async () => {
    const player = await seedPlayer({ isAdmin: false });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });

    const res = await POST(postRequest({ startDate: '2026-07-01' }));

    expect(res.status).toBe(403);
  });

  it('POST requires a startDate', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });

    const res = await POST(postRequest({}));

    expect(res.status).toBe(400);
  });

  it('POST rejects with 409 when a period is already active', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    await seedActivePeriod({ startDate: new Date('2026-06-01') });

    const res = await POST(postRequest({ startDate: '2026-07-01' }));

    expect(res.status).toBe(409);
    const activePeriods = await prisma.billingPeriod.findMany({ where: { status: 'active' } });
    expect(activePeriods).toHaveLength(1);
  });

  it('POST opens a new active period once none is active', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    await prisma.billingPeriod.create({
      data: { startDate: new Date('2026-01-01'), endDate: new Date('2026-02-01'), status: 'closed' },
    });

    const res = await POST(
      postRequest({ startDate: '2026-07-01', endDate: null, paymentInstructions: 'IBAN X' })
    );
    expect(res.status).toBe(200);

    const activePeriods = await prisma.billingPeriod.findMany({ where: { status: 'active' } });
    expect(activePeriods).toHaveLength(1);
    expect(activePeriods[0]).toMatchObject({ paymentInstructions: 'IBAN X' });
  });

  it('GET returns 401 when not authenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('GET lists periods newest first with raw startDate/endDate', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    await prisma.billingPeriod.createMany({
      data: [
        { startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'), status: 'closed' },
        { startDate: new Date('2026-06-01'), status: 'active' },
      ],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.periods).toHaveLength(2);
    expect(body.periods[0]).toMatchObject({ status: 'active', startDate: '2026-06-01', endDate: null });
    expect(body.periods[1]).toMatchObject({ status: 'closed', startDate: '2026-05-01', endDate: '2026-06-01' });
  });
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `npm run test:integration -- src/app/api/admin/billing-periods/route.integration.test.ts`
Expected: FAIL — `POST` still auto-closes and always returns 200 (no 409 branch yet); `GET` doesn't return `startDate`/`endDate` yet.

- [ ] **Step 3: Update the implementation**

Replace the full contents of `src/app/api/admin/billing-periods/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formatPeriodRange, getActivePeriod } from "@/lib/period";
import { API_ERROR, PERIOD_STATUS } from "@/lib/constants";

/** GET → all billing periods, newest first. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const periods = await prisma.billingPeriod.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json({
    periods: periods.map((p) => ({
      id: p.id,
      range: formatPeriodRange(p.startDate, p.endDate),
      status: p.status,
      paymentInstructions: p.paymentInstructions,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
    })),
  });
}

/**
 * POST { startDate, endDate, paymentInstructions } → opens a new active
 * period. Fails with 409 if one is already active — the admin must mark
 * it done (POST .../[id]/close) first.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { startDate, endDate, paymentInstructions } = await request.json();
  if (!startDate) return NextResponse.json({ error: API_ERROR.START_DATE_REQUIRED }, { status: 400 });

  const activePeriod = await getActivePeriod();
  if (activePeriod) {
    return NextResponse.json({ error: API_ERROR.ACTIVE_PERIOD_EXISTS }, { status: 409 });
  }

  const period = await prisma.billingPeriod.create({
    data: {
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: PERIOD_STATUS.ACTIVE,
      paymentInstructions: paymentInstructions ?? null,
    },
  });

  return NextResponse.json({ id: period.id });
}
```

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `npm run test:integration -- src/app/api/admin/billing-periods/route.integration.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/billing-periods/route.ts src/app/api/admin/billing-periods/route.integration.test.ts
git commit -m "feat: block creating a new billing period while one is active"
```

---

### Task 5: Admin dashboard UI

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/billing-periods/[id]` (Task 2), `POST /api/admin/billing-periods/[id]/close` (Task 3), `GET /api/admin/billing-periods`'s new `startDate`/`endDate` fields (Task 4).
- Produces: nothing consumed elsewhere — this is the leaf UI task.

No new tests in this task: this file has no existing component tests for its other inline modals/handlers (`createPeriod`, `saveEdit`), and the new modals are Chakra JSX over the already-tested routes from Tasks 2–4 — consistent with that established (lack of) pattern, per the design spec's Testing section.

- [ ] **Step 1: Extend the `PeriodRow` interface**

In `src/app/admin/dashboard/page.tsx`, find:

```ts
interface PeriodRow {
  id: string;
  range: string;
  status: PeriodStatus;
  paymentInstructions: string | null;
}
```

Replace with:

```ts
interface PeriodRow {
  id: string;
  range: string;
  status: PeriodStatus;
  paymentInstructions: string | null;
  startDate: string;
  endDate: string | null;
}
```

- [ ] **Step 2: Add new state**

Find (around line 135-139):

```ts
  // Edit-drink modal
  const [editDrink,  setEditDrink]  = useState<DrinkRow | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editPrice,  setEditPrice]  = useState("");
  const [editActive, setEditActive] = useState(true);
```

Add immediately after it:

```ts

  // Edit-period modal
  const [editPeriodOpen,  setEditPeriodOpen]  = useState(false);
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd,   setEditPeriodEnd]   = useState("");
  const [editPeriodNote,  setEditPeriodNote]  = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showActiveExists, setShowActiveExists] = useState(false);
```

- [ ] **Step 3: Add the `activePeriod`/`openEditPeriod`/`saveEditPeriod`/`closeActivePeriod` handlers, and modify `openNewPeriod`**

Find the existing `openNewPeriod` and `createPeriod` functions (lines 244–268):

```ts
  function openNewPeriod() {
    // When opening the form, default the payment instructions to the most recent
    // period that has them (so the admin doesn't retype them every time).
    if (!showNew && !payNote) {
      const last = periods.find((p) => p.paymentInstructions);
      if (last?.paymentInstructions) setPayNote(last.paymentInstructions);
    }
    setShowNew((v) => !v);
  }

  function createPeriod() {
    if (!startDate) return;
    fetch("/api/admin/billing-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate: endDate || null,
        paymentInstructions: payNote || null,
      }),
    })
      .then(() => {
        reloadPeriods();
        setSelPeriod(0);
        setShowNew(false);
        setStartDate(""); setEndDate(""); setPayNote("");
      })
      .catch(() => {});
  }
```

Replace with:

```ts
  function activePeriod() {
    return periods.find((p) => p.status === PERIOD_STATUS.ACTIVE) ?? null;
  }

  function openNewPeriod() {
    if (!showNew) {
      if (activePeriod()) {
        setShowActiveExists(true);
        return;
      }
      // When opening the form, default the payment instructions to the most recent
      // period that has them (so the admin doesn't retype them every time).
      if (!payNote) {
        const last = periods.find((p) => p.paymentInstructions);
        if (last?.paymentInstructions) setPayNote(last.paymentInstructions);
      }
    }
    setShowNew((v) => !v);
  }

  function createPeriod() {
    if (!startDate) return;
    fetch("/api/admin/billing-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate: endDate || null,
        paymentInstructions: payNote || null,
      }),
    })
      .then(() => {
        reloadPeriods();
        setSelPeriod(0);
        setShowNew(false);
        setStartDate(""); setEndDate(""); setPayNote("");
      })
      .catch(() => {});
  }

  function openEditPeriod() {
    const period = activePeriod();
    if (!period) return;
    setEditPeriodStart(period.startDate);
    setEditPeriodEnd(period.endDate ?? "");
    setEditPeriodNote(period.paymentInstructions ?? "");
    setEditPeriodOpen(true);
  }

  function saveEditPeriod() {
    const period = activePeriod();
    if (!period || !editPeriodStart) return;
    fetch(`/api/admin/billing-periods/${period.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: editPeriodStart,
        endDate: editPeriodEnd || null,
        paymentInstructions: editPeriodNote || null,
      }),
    })
      .then(() => reloadPeriods())
      .catch(() => {});
    setEditPeriodOpen(false);
  }

  function closeActivePeriod() {
    const period = activePeriod();
    if (!period) return;
    fetch(`/api/admin/billing-periods/${period.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: editPeriodEnd || null }),
    })
      .then(() => {
        reloadPeriods();
        setSelPeriod(0);
      })
      .catch(() => {});
    setShowCloseConfirm(false);
    setEditPeriodOpen(false);
  }
```

- [ ] **Step 4: Add the "Bearbeiten" toolbar button**

Find the "Neue Abrechnung" button and the toolbar's closing tag:

```tsx
              <Flex
                as="button"
                alignItems="center"
                gap="6px"
                bg="none"
                border="1px solid rgba(255,255,255,0.12)"
                borderRadius="12px"
                px="14px"
                py={2}
                fontSize="14px"
                color="#eaedf2"
                cursor="pointer"
                onClick={openNewPeriod}
              >
                <Plus size={14} />
                Neue Abrechnung
              </Flex>
            </Flex>
```

Replace with (adds the new button between "Neue Abrechnung" and the toolbar's closing `</Flex>`):

```tsx
              <Flex
                as="button"
                alignItems="center"
                gap="6px"
                bg="none"
                border="1px solid rgba(255,255,255,0.12)"
                borderRadius="12px"
                px="14px"
                py={2}
                fontSize="14px"
                color="#eaedf2"
                cursor="pointer"
                onClick={openNewPeriod}
              >
                <Plus size={14} />
                Neue Abrechnung
              </Flex>

              {activePeriod() && (
                <Flex
                  as="button"
                  alignItems="center"
                  gap="6px"
                  bg="none"
                  border="1px solid rgba(255,255,255,0.12)"
                  borderRadius="12px"
                  px="14px"
                  py={2}
                  fontSize="14px"
                  color="#eaedf2"
                  cursor="pointer"
                  onClick={openEditPeriod}
                >
                  <Pencil size={14} />
                  Bearbeiten
                </Flex>
              )}
            </Flex>
```

- [ ] **Step 5: Add the three new modals**

Find the end of the existing edit-drink modal block and the component's closing tags:

```tsx
                  Speichern
                </Box>
              </Flex>
            </Box>
          </Flex>
        </>
      )}
    </Box>
  );
```

Replace with (adds the three new modals between the edit-drink modal's closing `)}` and the component's final `</Box>`):

```tsx
                  Speichern
                </Box>
              </Flex>
            </Box>
          </Flex>
        </>
      )}

      {/* Edit-period modal */}
      {editPeriodOpen && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.65)"
            zIndex={200}
            onClick={() => setEditPeriodOpen(false)}
          />
          <Flex
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            alignItems="center"
            justifyContent="center"
            px={5}
            zIndex={201}
          >
            <Box
              w="full"
              maxW="380px"
              bg="#141921"
              border="1px solid rgba(255,255,255,0.1)"
              borderRadius="16px"
              p={5}
              boxShadow="0 16px 40px -12px rgba(0,0,0,0.7)"
            >
              <Text fontSize="17px" fontWeight="700" color="#eaedf2" mb={4}>
                Abrechnung bearbeiten
              </Text>

              <Flex gap={3} mb={4}>
                <Box flex={1}>
                  <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                    Startdatum
                  </Text>
                  <FieldInput type="date" value={editPeriodStart} onChange={setEditPeriodStart} />
                </Box>
                <Box flex={1}>
                  <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                    Enddatum
                  </Text>
                  <FieldInput type="date" value={editPeriodEnd} onChange={setEditPeriodEnd} />
                </Box>
              </Flex>

              <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="#5a6473" mb="6px">
                Zahlungshinweise
              </Text>
              <Textarea
                rows={3}
                placeholder="IBAN, PayPal, Empfänger…"
                value={editPeriodNote}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditPeriodNote(e.target.value)}
                w="full"
                bg="#1a202a"
                border="1px solid rgba(255,255,255,0.12)"
                borderRadius="8px"
                px="12px"
                py="10px"
                fontSize="14px"
                color="#eaedf2"
                outline="none"
                resize="vertical"
                mb={5}
              />

              <Box
                as="button"
                w="full"
                h="42px"
                borderRadius="10px"
                fontSize="14px"
                fontWeight="700"
                bg="rgba(224,83,95,0.12)"
                color="#e0535f"
                border="1px solid rgba(224,83,95,0.3)"
                cursor="pointer"
                mb={5}
                onClick={() => setShowCloseConfirm(true)}
              >
                Als abgeschlossen markieren
              </Box>

              <Flex gap={3} justifyContent="flex-end">
                <Box
                  as="button"
                  h="42px"
                  px={5}
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight="700"
                  bg="transparent"
                  color="#939dab"
                  border="1px solid rgba(255,255,255,0.16)"
                  cursor="pointer"
                  onClick={() => setEditPeriodOpen(false)}
                >
                  Abbrechen
                </Box>
                <Box
                  as="button"
                  h="42px"
                  px={5}
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight="700"
                  bg="#6478a0"
                  color="white"
                  border="none"
                  cursor="pointer"
                  onClick={saveEditPeriod}
                >
                  Speichern
                </Box>
              </Flex>
            </Box>
          </Flex>
        </>
      )}

      {/* Close-period confirmation modal */}
      {showCloseConfirm && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.6)"
            zIndex={300}
            onClick={() => setShowCloseConfirm(false)}
          />
          <Flex
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            alignItems="center"
            justifyContent="center"
            px={6}
            zIndex={301}
          >
            <Box
              w="full"
              maxW="340px"
              bg="#151a21"
              border="1px solid rgba(255,255,255,0.09)"
              borderRadius="16px"
              p={5}
              boxShadow="0 16px 40px -12px rgba(0,0,0,0.7)"
            >
              <Text fontSize="17px" fontWeight="700" color="#eaedf2" mb={2}>
                Abrechnung abschließen
              </Text>
              <Text fontSize="14px" color="#939dab" mb={5}>
                Diese Abrechnung wird abgeschlossen und kann nicht mehr bearbeitet werden. Fortfahren?
              </Text>
              <Flex gap={3}>
                <Box
                  as="button"
                  flex={1}
                  h="46px"
                  borderRadius="10px"
                  fontSize="15px"
                  fontWeight="700"
                  bg="#1b212b"
                  color="#eaedf2"
                  border="1px solid rgba(255,255,255,0.16)"
                  cursor="pointer"
                  onClick={() => setShowCloseConfirm(false)}
                >
                  Abbrechen
                </Box>
                <Box
                  as="button"
                  flex={1}
                  h="46px"
                  borderRadius="10px"
                  fontSize="15px"
                  fontWeight="700"
                  bg="#e0535f"
                  color="white"
                  border="none"
                  cursor="pointer"
                  onClick={closeActivePeriod}
                >
                  Abschließen
                </Box>
              </Flex>
            </Box>
          </Flex>
        </>
      )}

      {/* Active-period-exists info modal */}
      {showActiveExists && (
        <>
          <Box
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            bg="rgba(0,0,0,0.6)"
            zIndex={300}
            onClick={() => setShowActiveExists(false)}
          />
          <Flex
            position="fixed"
            top={0} left={0} right={0} bottom={0}
            alignItems="center"
            justifyContent="center"
            px={6}
            zIndex={301}
          >
            <Box
              w="full"
              maxW="340px"
              bg="#151a21"
              border="1px solid rgba(255,255,255,0.09)"
              borderRadius="16px"
              p={5}
              boxShadow="0 16px 40px -12px rgba(0,0,0,0.7)"
            >
              <Text fontSize="17px" fontWeight="700" color="#eaedf2" mb={2}>
                Aktive Abrechnung vorhanden
              </Text>
              <Text fontSize="14px" color="#939dab" mb={5}>
                Es gibt bereits eine aktive Abrechnungsperiode. Bitte schließe sie zuerst ab, bevor du eine neue erstellst.
              </Text>
              <Box
                as="button"
                w="full"
                h="46px"
                borderRadius="10px"
                fontSize="15px"
                fontWeight="700"
                bg="#6478a0"
                color="white"
                border="none"
                cursor="pointer"
                onClick={() => setShowActiveExists(false)}
              >
                Okay
              </Box>
            </Box>
          </Flex>
        </>
      )}
    </Box>
  );
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run the full unit + integration suites**

Run: `npm test`
Expected: PASS, no regressions.

Run: `npm run test:integration`
Expected: PASS, no regressions (all billing-period tests from Tasks 2–4 included).

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/dashboard/page.tsx
git commit -m "feat: add edit/close billing-period UI to the admin dashboard"
```

---

### Task 6: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Start the dev server and exercise the flow**

Run: `npm run dev`, sign in as the seeded admin, go to `/admin/dashboard?tab=billing`.

Verify manually:
- With an active period selected: "Bearbeiten" is visible; clicking it opens the edit modal prefilled with the current dates/notes.
- Editing dates/notes and clicking "Speichern" persists the change (reload the page, confirm it stuck).
- Clicking "Neue Abrechnung" while a period is active shows the "Aktive Abrechnung vorhanden" info modal, not the create form.
- In the edit modal, clicking "Als abgeschlossen markieren" opens the confirm dialog; "Abbrechen" returns to the edit modal; "Abschließen" closes the period (badge flips to "Abgeschlossen", "Bearbeiten" disappears from the toolbar).
- "Neue Abrechnung" now works again (no active period exists) and creates a new one.

- [ ] **Step 3: Full verification pass**

Run: `npx tsc --noEmit && npm test && npm run test:integration`
Expected: all clean/passing.

No commit for this task — pure verification. Once green, the branch is ready for a PR per `CLAUDE.md`'s git workflow.

---

## Self-Review

**Spec coverage:**
- Edit only targets the active period, hidden when none exists → Task 5 (`activePeriod()` gate on the button). ✓
- `PATCH .../[id]` for dates/notes, rejecting non-active periods → Task 2. ✓
- `POST .../[id]/close` for the done-transition, defaulting `endDate` to today → Task 3. ✓
- `POST /api/admin/billing-periods` blocks with 409 instead of auto-closing → Task 4. ✓
- "Neue Abrechnung" shows an info modal (not an inline error) when blocked, checked client-side against already-loaded state → Task 5 (`openNewPeriod`). ✓
- Close is a separate action with its own confirm step, distinct from the field-edit Save → Task 5 (`showCloseConfirm`, "Als abgeschlossen markieren" button). ✓
- Info-modal button reads "Okay" (user's correction during design review) → Task 5. ✓
- All error constants (`PERIOD_NOT_ACTIVE`, `END_DATE_BEFORE_START`, `ACTIVE_PERIOD_EXISTS`) → Task 1, used in Tasks 2–4. ✓
- Testing section: unit + integration tests for both new routes (Tasks 2, 3), integration test extended for the modified route (Task 4), no new UI tests (matches existing file convention, per spec). ✓
- Out-of-scope items (reopening, editing closed periods, structured-logging events, toast/error UI) — respected; no task adds any of these. ✓
- Necessary implementation-level addition beyond the spec's literal text: `GET`'s response needed raw `startDate`/`endDate` fields for the edit modal to prefill real date-input values (the spec only had the formatted `range` string) — added to Task 4, flagged here explicitly since it's not spelled out verbatim in the spec but is required for the spec's own "prefilled from the active period's current startDate/endDate" data-flow requirement to be implementable.

**Placeholder scan:** no TBD/TODO, no "add appropriate error handling," every step has complete code. ✓

**Type consistency:** `PeriodRow` (Task 5) matches the exact shape `GET /api/admin/billing-periods` now returns (Task 4): `{ id, range, status, paymentInstructions, startDate, endDate }`. `PATCH .../[id]`'s body shape (Task 2) matches what `saveEditPeriod` sends (Task 5): `{ startDate, endDate, paymentInstructions }`. `POST .../[id]/close`'s body shape (Task 3) matches what `closeActivePeriod` sends (Task 5): `{ endDate }`. `API_ERROR.ACTIVE_PERIOD_EXISTS`/`PERIOD_NOT_ACTIVE`/`END_DATE_BEFORE_START` (Task 1) are referenced with identical names in Tasks 2–4. ✓
