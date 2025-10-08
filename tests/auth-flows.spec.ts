import { test, expect } from '@playwright/test';

async function loginIfNeeded(page: import('@playwright/test').Page) {
  // If provider selector shows user_password, pick it
  const userPasswordProvider = page.getByText('user_password', { exact: true });
  if (await userPasswordProvider.isVisible().catch(() => false)) {
    await userPasswordProvider.click();
  }

  // If username/password form is visible, fill and submit
  const usernameByPh = page.getByPlaceholder('Username');
  const passwordByPh = page.getByPlaceholder('Password');
  const usernameByLabel = page.getByLabel('Username');
  const passwordByLabel = page.getByLabel('Password');

  const usernameVisible = (await usernameByPh.isVisible().catch(() => false))
    || (await usernameByLabel.isVisible().catch(() => false));

  if (usernameVisible) {
    if (await usernameByPh.isVisible().catch(() => false)) {
      await usernameByPh.fill('dev');
    } else {
      await usernameByLabel.fill('dev');
    }

    if (await passwordByPh.isVisible().catch(() => false)) {
      await passwordByPh.fill('dev');
    } else {
      await passwordByLabel.fill('dev');
    }

    await page.getByRole('button', { name: /Sign in/i }).click();
  }
}

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

    await loginIfNeeded(page);

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

    await loginIfNeeded(page);

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

    await loginIfNeeded(page);

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


