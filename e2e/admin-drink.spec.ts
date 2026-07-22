// e2e/admin-drink.spec.ts
import { test, expect } from '@playwright/test';

test('admin creates a drink and it appears in the list', async ({ page }) => {
  await page.goto('/admin/dashboard');

  // Wait for the drinks tab to load
  await expect(page.locator('text=Getränke verwalten')).toBeVisible({ timeout: 10_000 });

  // Fill in the new drink row
  await page.getByPlaceholder('Name').fill('Neues E2E Getränk');
  await page.getByPlaceholder('1,50').fill('2,50');

  // Click the "+" button to add
  await page.getByRole('button', { name: '+' }).click();

  // The new drink should appear in the list
  await expect(page.locator('text=Neues E2E Getränk').first()).toBeVisible({ timeout: 5_000 });
});
