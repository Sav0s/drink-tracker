// e2e/login-otp.spec.ts
// Runs as unauthenticated (no storageState). Supabase auth endpoints are mocked
// via page.route() so no real emails are sent.
import { test, expect } from '@playwright/test';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function mockOtpSend(page: import('@playwright/test').Page) {
  return page.route(`${supabaseUrl}/auth/v1/otp*`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
}

function mockOtpVerifyError(page: import('@playwright/test').Page) {
  return page.route(`${supabaseUrl}/auth/v1/verify*`, (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Token has expired or is invalid' }),
    })
  );
}

test.describe('OTP Login', () => {
  test('shows 6-digit code input after entering a valid email', async ({ page }) => {
    await mockOtpSend(page);

    await page.goto('/login');
    await page.getByPlaceholder('deine@email.de').fill('test@example.com');
    await page.getByText('Code senden').click();

    await expect(page.getByText('Code eingeben')).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();
    await expect(page.locator('[data-testid^="otp-digit-"]')).toHaveCount(6);

    await page.screenshot({ path: 'e2e/screenshots/otp-code-input.png', fullPage: false });
  });

  test('shows an error message for an invalid OTP code', async ({ page }) => {
    await mockOtpSend(page);
    await mockOtpVerifyError(page);

    await page.goto('/login');
    await page.getByPlaceholder('deine@email.de').fill('test@example.com');
    await page.getByText('Code senden').click();
    await expect(page.getByText('Code eingeben')).toBeVisible();

    // Type digits one by one (each auto-advances focus)
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).type(String(i + 1));
    }

    await expect(page.getByText(/Ungültiger oder abgelaufener Code/)).toBeVisible();
    // Digits are cleared after a wrong attempt
    for (let i = 0; i < 6; i++) {
      await expect(page.locator(`[data-testid="otp-digit-${i}"]`)).toHaveValue('');
    }
  });

  test('navigates back to the email step via "Andere E-Mail"', async ({ page }) => {
    await mockOtpSend(page);

    await page.goto('/login');
    await page.getByPlaceholder('deine@email.de').fill('test@example.com');
    await page.getByText('Code senden').click();
    await expect(page.getByText('Code eingeben')).toBeVisible();

    await page.getByText('Andere E-Mail').click();

    await expect(page.getByPlaceholder('deine@email.de')).toBeVisible();
    await expect(page.getByText('Code senden')).toBeVisible();
  });

  test('resends the code via "Code erneut senden"', async ({ page }) => {
    const requests: string[] = [];
    await page.route(`${supabaseUrl}/auth/v1/otp*`, (route) => {
      requests.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/login');
    await page.getByPlaceholder('deine@email.de').fill('test@example.com');
    await page.getByText('Code senden').click();
    await expect(page.getByText('Code eingeben')).toBeVisible();

    await page.getByText('Code erneut senden').click();

    await expect(async () => expect(requests).toHaveLength(2)).toPass({ timeout: 3000 });
  });
});
