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
  await page.locator('text=Abgeschlossen').first().waitFor({ timeout: 5_000 });
  await expect(page.locator('text=Abgeschlossen').first()).toBeVisible();
});
