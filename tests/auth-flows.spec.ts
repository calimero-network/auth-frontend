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

async function clickApproveAndAssertTokens(page: import('@playwright/test').Page) {
  // Observe the client key generation API when it happens
  const maybeClientKey = page
    .waitForResponse(
      (res) => res.url().includes('/admin/client-key') && res.ok(),
      { timeout: 30000 }
    )
    .catch(() => null);

  await page.getByRole('button', { name: 'Approve' }).click();

  // Wait until both tokens are present in the URL fragment
  await page.waitForFunction(
    () =>
      (location.hash || '').includes('access_token=') &&
      (location.hash || '').includes('refresh_token='),
    { timeout: 30000 }
  );

  // Assert full URL and token shape
  expect(page.url()).toMatch(/#access_token=.+&refresh_token=.+/);

  const tokens = await page.evaluate(() => {
    const params = new URLSearchParams((location.hash || '').slice(1));
    return {
      access: params.get('access_token') || '',
      refresh: params.get('refresh_token') || ''
    };
  });
  expect(tokens.access.length).toBeGreaterThan(20);
  expect(tokens.refresh.length).toBeGreaterThan(20);

  await maybeClientKey;
}

async function createContextIfPrompted(page: import('@playwright/test').Page) {
  // Handles the create context flow if the UI prompts for it
  const createNewBtn = page.getByRole('button', { name: /Create New Context/ });
  if (await createNewBtn.isVisible().catch(() => false)) {
    await createNewBtn.click();

    // Pick any available protocol button (first enabled non-Back button)
    const protocolButtons = page.locator('button:not([disabled])');
    const count = await protocolButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = protocolButtons.nth(i);
      const name = (await btn.innerText().catch(() => '')).trim();
      if (!/Back|Create New Context|Install Application|Approve|Cancel/i.test(name)) {
        await btn.click();
        break;
      }
    }

    // Now create the context
    const createBtn = page.getByRole('button', { name: /^Create Context$/ });
    await expect(createBtn).toBeEnabled({ timeout: 15000 });
    await createBtn.click();
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
    await proceedToApprove(page);
    await clickApproveAndAssertTokens(page);
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
    await clickApproveAndAssertTokens(page);
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
    await createContextIfPrompted(page);

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
    await clickApproveAndAssertTokens(page);
  });
});


