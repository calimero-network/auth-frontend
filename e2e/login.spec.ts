import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';
import { seedAdminSession } from './helpers/session';

const BASE_URL =
  '/auth/?mode=admin&callback-url=http://callback.local/done&permissions=admin';

test.describe('EnsureAdminSession / Login', () => {
  test('1 – no token → shows provider selector', async ({ page }) => {
    await setupMocks(page);
    await page.goto(BASE_URL);

    await expect(
      page.getByText('Choose an authentication method'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Username/Password')).toBeVisible();
  });

  test('2 – valid token → skip login, children rendered', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, { refresh: DEFAULT_REFRESH });
    await page.goto(BASE_URL);

    // Children = AdminFlow = PermissionsView
    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Choose an authentication method')).not.toBeVisible();
  });

  test('3 – expired token → clears token and shows provider selector', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, { refresh: 'fail' });
    await page.goto(BASE_URL);

    await expect(
      page.getByText('Choose an authentication method'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('4 – user_password login success → children rendered', async ({ page }) => {
    await setupMocks(page, { login: DEFAULT_TOKENS, refresh: 'fail' });
    await page.goto(BASE_URL);

    // Click provider
    await page.getByText('Username/Password').click();

    // Fill form
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('secret');

    // Submit
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Expect PermissionsView
    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 10_000 });
  });

  test('5 – login failure → error message shown', async ({ page }) => {
    await setupMocks(page, { login: null, refresh: 'fail' });
    await page.goto(BASE_URL);

    await page.getByText('Username/Password').click();
    await page.locator('#username').fill('wrong');
    await page.locator('#password').fill('creds');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Login failure shows HTTP error inline in the form
    await expect(page.getByText('HTTP 401 Unauthorized')).toBeVisible({ timeout: 10_000 });
  });

  test('6 – provider API failure → no providers available', async ({ page }) => {
    await setupMocks(page, { providers: null });
    await page.goto(BASE_URL);

    // When providers fail to load, ProviderSelector shows empty state
    await expect(page.getByText('No providers available')).toBeVisible({ timeout: 10_000 });
  });
});

// Shared helpers
const DEFAULT_TOKENS = {
  data: { access_token: 'mock-access', refresh_token: 'mock-refresh' },
};

const DEFAULT_REFRESH = {
  data: { access_token: 'mock-access', refresh_token: 'mock-refresh' },
};
