// e2e/player-drink.spec.ts
import { test, expect } from '@playwright/test';

test('player logs a drink and balance updates', async ({ page }) => {
  await page.goto('/home');

  // Wait for the drink list to load
  const drinkCard = page.locator('text=E2E Bier').first();
  await expect(drinkCard).toBeVisible({ timeout: 10_000 });

  // Initial balance is 0,00 € for a fresh player
  await expect(page.locator('text=0,00 €').first()).toBeVisible();

  // Tap the drink
  await drinkCard.click();

  // Balance should update to 1,50 €
  await expect(page.locator('text=1,50 €').first()).toBeVisible({ timeout: 5_000 });
});
