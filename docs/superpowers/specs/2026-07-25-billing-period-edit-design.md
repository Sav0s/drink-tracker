# Billing Period Edit Design

**Date:** 2026-07-25
**Scope:** Let an admin edit the active billing period's dates and payment instructions, and explicitly mark it done (closed) without creating a replacement period in the same action. Changes the existing "create closes the previous active period automatically" behavior to a blocking rule instead: a new period can only be created once the current one has been explicitly marked done.

---

## Behavior Change: Active-Period Lifecycle

Today, `POST /api/admin/billing-periods` closes whichever period is currently active (via `updateMany`) and opens a new one in the same request — there is no way to close a period without simultaneously opening the next one.

This changes to an explicit two-step lifecycle:

1. **Create** (`POST /api/admin/billing-periods`) only succeeds when no period is currently active. If one is active, it fails (409) instead of auto-closing it.
2. **Close** (new `POST /api/admin/billing-periods/[id]/close`) explicitly marks the active period done. This is the only way a period transitions from active to closed.

The single-active-period invariant that `getActivePeriod()` (`src/lib/period.ts`) and the rest of the app already rely on is preserved — just enforced at creation time by rejection instead of by silently closing the previous one.

---

## Components

### API

#### `PATCH /api/admin/billing-periods/[id]`

New route file: `src/app/api/admin/billing-periods/[id]/route.ts`.

Body: `{ startDate?, endDate?, paymentInstructions? }` — same partial-update convention as `PATCH /api/admin/drinks/[id]` (only present fields are changed).

- 401/403 via `requireAdmin()` (existing pattern).
- 400 `API_ERROR.PERIOD_NOT_ACTIVE` if the target period's `status !== PERIOD_STATUS.ACTIVE`.
- 400 `API_ERROR.START_DATE_REQUIRED` if the request body includes `startDate` as an empty/falsy value (omitting the field entirely is fine — partial update, `startDate` stays untouched; `startDate` is NOT NULL in the schema, so it can never be cleared).
- 400 `API_ERROR.END_DATE_BEFORE_START` if, after applying this request's changes on top of the row's current values, the resulting `endDate < startDate`.
- 200 `{ ok: true }` on success.

#### `POST /api/admin/billing-periods/[id]/close`

New route file: `src/app/api/admin/billing-periods/[id]/close/route.ts`.

Body: `{ endDate? }` — optional; only needed if the admin wants to set an end date as part of closing (e.g. they typed one into the edit modal but hadn't hit Speichern first).

- 401/403 via `requireAdmin()`.
- 400 `API_ERROR.PERIOD_NOT_ACTIVE` if the target period isn't currently active (already closed — prevents double-close).
- Sets `status: PERIOD_STATUS.CLOSED`, `endDate: <sent endDate> ?? <period's existing endDate> ?? <today>`.
- 200 `{ ok: true }`.

#### `POST /api/admin/billing-periods` (existing route, modified)

- Before creating, checks `getActivePeriod()` (existing helper, already used elsewhere — e.g. `src/app/api/bookings/route.ts`). If it returns a period, respond 409 `API_ERROR.ACTIVE_PERIOD_EXISTS` and do not create anything.
- The `updateMany` auto-close block is removed entirely — creation no longer touches any other row.
- Everything else (validation, the created period's shape) is unchanged.

#### New constants (`src/lib/constants.ts`)

```ts
API_ERROR.PERIOD_NOT_ACTIVE = "Billing period is not active"
API_ERROR.END_DATE_BEFORE_START = "endDate must not be before startDate"
API_ERROR.ACTIVE_PERIOD_EXISTS = "An active billing period already exists"
```

### UI (`src/app/admin/dashboard/page.tsx`, billing tab)

All new modals follow the file's existing overlay + centered-card pattern (see the current edit-drink modal and, for the confirm dialog, `src/app/account/page.tsx`'s leave-confirmation modal) — same z-index layering, border/background/shadow tokens, button row shape. No new shared component is introduced; this file already inlines each modal in place, and these follow suit.

- **"Bearbeiten" button**, in the toolbar immediately after "Neue Abrechnung", same button styling (icon + label, `Pencil` icon already imported from `lucide-react`). Rendered only when an active period exists (`periods.some(p => p.status === PERIOD_STATUS.ACTIVE)`); otherwise omitted from the toolbar entirely (not merely disabled — there's nothing to edit).
- **Edit modal** (new local state, mirrors `editDrink`/`openEdit`/`saveEdit`): title "Abrechnung bearbeiten". Fields Startdatum, Enddatum, Zahlungshinweise (reusing `FieldInput`/`Textarea` exactly as the "Neue Abrechnung" form does), prefilled from the active period on open. `Abbrechen` closes without saving. `Speichern` calls the `PATCH`, then `reloadPeriods()`, then closes the modal. A visually distinct destructive-leaning action, `Als abgeschlossen markieren`, sits below the field group and opens the confirm dialog (below) rather than acting immediately.
- **Close-confirmation modal**: title "Abrechnung abschließen", body explains this can't be undone. `Abbrechen` returns to the edit modal. `Abschließen` calls `POST .../close` (passing the modal's current `endDate` field if the admin had typed one), then `reloadPeriods()`, resets `selPeriod` to `0` (the just-closed period is still the newest, so it stays visible in the picker), and closes both modals.
- **"Active period exists" info modal**: shown instead of opening the create form when `openNewPeriod()` is called and `periods.some(p => p.status === PERIOD_STATUS.ACTIVE)` is already true. Title "Aktive Abrechnung vorhanden", body: "Es gibt bereits eine aktive Abrechnungsperiode. Bitte schließe sie zuerst ab, bevor du eine neue erstellst." Single button, "Okay", closes the modal — no confirm/cancel pair needed since it's informational, not an action.

---

## Data Flow

```
Admin clicks "Bearbeiten"
  → opens edit modal, prefilled from the active period (already in `periods` state)

Admin edits fields, clicks "Speichern"
  → PATCH /api/admin/billing-periods/[id]
  → reloadPeriods()
  → close edit modal

Admin clicks "Als abgeschlossen markieren"
  → opens close-confirmation modal (edit modal stays mounted underneath)

Admin clicks "Abschließen"
  → POST /api/admin/billing-periods/[id]/close
  → reloadPeriods(); setSelPeriod(0)
  → close both modals

Admin clicks "Neue Abrechnung" while a period is active
  → client-side check against already-loaded `periods` state
  → info modal instead of the create form (no request sent)

Admin clicks "Neue Abrechnung" with no active period
  → existing create-form flow, unchanged
```

Errors follow the file's existing convention: mutations `.catch(() => {})` and rely on `reloadPeriods()` to reflect actual server state — no new toast/banner system introduced for this feature, consistent with how `createPeriod`/`saveEdit`/`markPaid` already behave in this file.

---

## Testing

- **`src/app/api/admin/billing-periods/[id]/route.test.ts`** (new, mocked Prisma/auth): PATCH updates only the sent fields on an active period; 400 when the target period is closed; 400 when the resulting `endDate < startDate`.
- **`src/app/api/admin/billing-periods/[id]/close/route.test.ts`** (new, mocked): closes an active period; defaults `endDate` to today when none is sent and none already exists; keeps an existing `endDate` when none is sent; 400 when the target period is already closed.
- **`src/app/api/admin/billing-periods/route.test.ts`** (existing — extended): `POST` now asserts 409 + `ACTIVE_PERIOD_EXISTS` when `getActivePeriod()` resolves a period, and that no `create`/`update` call happens in that case. The old "closes previously active period" assertions move out (that behavior no longer exists on this route).
- **`src/app/api/admin/billing-periods/route.integration.test.ts`** (existing — updated): the "POST opens a new active period and closes the previously active one" case is replaced with two cases — POST rejects (409) while a period is active, and POST succeeds once that period has been closed via the new close endpoint. New integration test files for the `[id]` PATCH and `[id]/close` POST routes, following the existing `seedPlayer`/`seedActivePeriod` fixture pattern in `src/test-integration-helpers.ts`, covering the same auth-gating + real-DB-state assertions the other integration tests use.
- UI: no new component tests — this file has none today for its existing modals (`createPeriod`, `saveEdit`), and the new modals are thin Chakra JSX over already-tested API routes.

---

## Explicitly Out of Scope

- Reopening a closed period (no "undo done" action).
- Editing a closed period's dates/notes after the fact (Edit only ever targets the active period).
- Any structured-logging events for these new mutations — the structured-logging feature (PR #35) is not yet merged to `main`; this spec is written against `main` as it stands today and doesn't assume it.
- Toast/error-banner UI for failed mutations — matches this file's existing silent-fail-and-reload convention.
