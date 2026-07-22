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
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();

  // Wait for save to complete (button returns to non-saving label)
  await expect(page.getByRole('button', { name: 'Speichern', exact: true })).toBeVisible({ timeout: 5_000 });

  // Navigate away and back to confirm persistence
  await page.goto('/home');
  await page.goto('/account');

  await expect(page.getByRole('textbox')).toHaveValue('E2E Renamed Player', { timeout: 10_000 });
});
