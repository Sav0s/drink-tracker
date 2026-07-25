# Move "Neue Abrechnung" Into the Period Picker

**Date:** 2026-07-25
**Scope:** Relocate the standalone "Neue Abrechnung" toolbar button on `/admin/dashboard?tab=billing` into the billing-period selection dropdown. Purely a UI reorganization — no API or data-model changes.

## Behavior

- **Periods exist:** the picker field keeps its current appearance and toggle behavior (selected period's range + status badge + chevron). Inside the open dropdown, after the list of periods, a divider (`borderTop="1px solid rgba(255,255,255,0.12)"`, the token already used for row separators elsewhere in this file) precedes a new "+ Neue Abrechnung" row, styled like the period rows but with the `Plus` icon. Clicking it closes the dropdown and calls the existing `openNewPeriod()` handler — same behavior as today's button (opens the create form, or the "active period exists" info modal if blocked), just relocated.
- **No periods exist:** the picker field itself renders as a "+ Neue Abrechnung" button (same icon/label/styling as today's standalone button) and calls `openNewPeriod()` directly on click. No dropdown involved — there's nothing to pick from.
- The standalone toolbar button is removed. "Bearbeiten" is unaffected and stays in the toolbar exactly as it is today.

## Testing

No behavior beyond styling/element-location changes — `openNewPeriod()`, `createPeriod()`, and the create-form/info-modal it triggers are unchanged and already covered (unit-untested by existing convention for this file's inline handlers, e2e-covered by `e2e/admin-billing.spec.ts`). That e2e spec locates today's button via `page.locator('text=Neue Abrechnung')`, which will still find the relocated text regardless of its new position, so it should keep passing unmodified — verify this by running it after the change, and update the locator only if it doesn't.
