// e2e/admin-billing.spec.ts
import { test, expect } from '@playwright/test';

test('admin marks a billing period done via Edit, then creates the next one', async ({ page }) => {
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

  // ── Creating another period while one is active is blocked ─────────────────
  await page.locator('text=Neue Abrechnung').click();
  await expect(page.locator('text=Aktive Abrechnung vorhanden')).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Okay', exact: true }).click();

  // ── Mark the active period done via the Edit modal ──────────────────────────
  await page.locator('text=Bearbeiten').click();
  await expect(page.locator('text=Abrechnung bearbeiten')).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Als abgeschlossen markieren' }).click();
  await expect(page.locator('text=Abrechnung abschließen')).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Abschließen', exact: true }).click();

  // The picker now shows the closed period with an "Abgeschlossen" badge, and
  // "Bearbeiten" disappears since no period is active anymore.
  await expect(page.locator('text=Abgeschlossen').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);

  // ── Creating the next period now works ──────────────────────────────────
  await page.locator('text=Neue Abrechnung').click();
  await page.locator('input[type="date"]').first().fill('2026-08-01');
  await page.getByRole('button', { name: 'Abrechnung erstellen' }).click();

  // After reload, the picker shows August as active.
  await expect(page.locator('button').filter({ hasText: '01.08.' })).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('text=Aktiv').first()).toBeVisible({ timeout: 8_000 });
});
