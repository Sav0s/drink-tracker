// e2e/admin-billing.spec.ts
import { test, expect } from '@playwright/test';

test('admin closes a billing period by creating a new one', async ({ page }) => {
  await page.goto('/admin/dashboard');

  // Switch to billing tab
  await page.getByRole('button', { name: 'Abrechnung', exact: true }).click();

  // Wait for billing tab content to load
  await expect(page.locator('text=Neue Abrechnung').first()).toBeVisible({ timeout: 10_000 });

  // ── Create the first (active) period ──────────────────────────────────────
  await page.locator('text=Neue Abrechnung').click();
  await page.locator('input[type="date"]').first().fill('2026-07-01');
  await page.getByRole('button', { name: 'Abrechnung erstellen' }).click();

  // First period is now active — picker badge reads "Aktiv"
  await expect(page.locator('text=Aktiv').first()).toBeVisible({ timeout: 8_000 });

  // ── Create a second period, which closes the first ────────────────────────
  await page.locator('text=Neue Abrechnung').click();
  await page.locator('input[type="date"]').first().fill('2026-08-01');
  await page.getByRole('button', { name: 'Abrechnung erstellen' }).click();

  // After reload, the picker shows August as active.
  // Wait for the picker button text to update to "01.08." (confirms reload is done).
  await expect(page.locator('button').filter({ hasText: '01.08.' })).toBeVisible({ timeout: 8_000 });

  // Open the period picker dropdown by clicking the button that shows August's range.
  await page.locator('button').filter({ hasText: '01.08.' }).click();

  // The July dropdown entry appears — click it to select the closed period.
  // (picker button now shows August, so "01.07." only appears inside the open dropdown)
  await page.locator('button').filter({ hasText: '01.07.' }).first().click();

  // The picker now shows July; its badge should read "Abgeschlossen".
  await expect(page.locator('text=Abgeschlossen').first()).toBeVisible({ timeout: 8_000 });
});
