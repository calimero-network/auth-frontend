import { test, expect } from '@playwright/test';

function buildAuthUrl(params: Record<string, string>): string {
  const base = process.env.PW_BASE_URL || 'http://localhost:3001';
  const url = new URL('/auth/login', base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

test.describe('Auth frontend flows', () => {
  test('admin token flow returns tokens to callback', async ({ page }) => {
    const base = process.env.PW_BASE_URL || 'http://localhost:3001';
    const callback = `${base}/callback`;
    const targetApp = base;
    const url = buildAuthUrl({
      'callback-url': callback,
      'app-url': targetApp,
      'permissions': 'admin',
    });

    await page.goto(url);

    // For dev: providers may include user_password; select it and submit dummy creds
    // Select user_password provider if present; otherwise this test will be skipped
    const up = page.getByText('user_password');
    if (!(await up.isVisible().catch(() => false))) test.skip();
    await up.click();
    await page.getByPlaceholder('Username').fill('dev');
    await page.getByPlaceholder('Password').fill('dev');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Approve permissions
    await page.getByRole('button', { name: 'Approve' }).click();

    await expect(page).toHaveURL(/#access_token=.+&refresh_token=.+/);
  });

  test('application token flow without context', async ({ page }) => {
    const base = process.env.PW_BASE_URL || 'http://localhost:3001';
    const callback = `${base}/callback`;
    const targetApp = base;
    const url = buildAuthUrl({
      'callback-url': callback,
      'app-url': targetApp,
    });

    await page.goto(url);

    const up2 = page.getByText('user_password');
    if (!(await up2.isVisible().catch(() => false))) test.skip();
    await up2.click();
    await page.getByPlaceholder('Username').fill('dev');
    await page.getByPlaceholder('Password').fill('dev');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Application install check may appear; if so, click proceed/install anyway
    const installButton = page.getByRole('button', { name: /Install/ });
    if (await installButton.isVisible().catch(() => false)) {
      await installButton.click();
    }

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page).toHaveURL(/#access_token=.+&refresh_token=.+/);
  });

  test('context token flow by selecting context and identity', async ({ page }) => {
    const base = process.env.PW_BASE_URL || 'http://localhost:3001';
    const callback = `${base}/callback`;
    const targetApp = base;
    const url = buildAuthUrl({
      'callback-url': callback,
      'app-url': targetApp,
      'application-id': 'demo-app',
      'application-path': 'apps/demo-app',
    });

    await page.goto(url);

    const up3 = page.getByText('user_password');
    if (!(await up3.isVisible().catch(() => false))) test.skip();
    await up3.click();
    await page.getByPlaceholder('Username').fill('dev');
    await page.getByPlaceholder('Password').fill('dev');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // If we are prompted to install or create a context, accept flow
    const createContext = page.getByRole('button', { name: /Create Context/ });
    if (await createContext.isVisible().catch(() => false)) {
      await createContext.click();
    }

    // Select first context then first identity (using SDK UI selectors)
    const firstContext = page.locator('[data-testid="context-item"]').first();
    if (await firstContext.isVisible().catch(() => false)) {
      await firstContext.click();
    }
    const firstIdentity = page.locator('[data-testid="context-identity-item"]').first();
    if (await firstIdentity.isVisible().catch(() => false)) {
      await firstIdentity.click();
    }

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page).toHaveURL(/#access_token=.+&refresh_token=.+/);
  });
});


