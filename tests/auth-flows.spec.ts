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

async function proceedToApprove(page: import('@playwright/test').Page) {
  // Skip if application info is missing (cannot proceed without params)
  const missingInfo = page.getByText('Missing Application Information', { exact: false });
  if (await missingInfo.isVisible().catch(() => false)) {
    throw new Error('Unexpected Missing Application Information screen');
  }

  // If an install button is presented, try to proceed
  const installBtn = page.getByRole('button', { name: /Install/ });
  if (await installBtn.isVisible().catch(() => false)) {
    await installBtn.click();
  }

  // Wait briefly for Approve to become available; skip if it doesn’t
  const approve = page.getByRole('button', { name: 'Approve' });
  await expect(approve).toBeVisible({ timeout: 15000 });
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
    await proceedToApprove(page);
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
      'application-id': '5PMPWDv1k9x2AQpgPxteRYrUbMyPWm7Nk7ETWjcLmstH',
      'application-path': 'kv_store',
    });

    await page.goto(url);

    await loginIfNeeded(page);
    await proceedToApprove(page);
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
      'application-id': '5PMPWDv1k9x2AQpgPxteRYrUbMyPWm7Nk7ETWjcLmstH',
      'application-path': 'kv_store',
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

    await proceedToApprove(page);
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page).toHaveURL(/#access_token=.+&refresh_token=.+/);
  });
});


