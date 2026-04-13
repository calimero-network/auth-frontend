import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';
import { seedAdminSession } from './helpers/session';

const VALID_URL =
  '/auth/?mode=admin&callback-url=http://callback.local/done&permissions=admin';

const REFRESH_OK = {
  data: { access_token: 'mock-access', refresh_token: 'mock-refresh' },
};

test.describe('AdminFlow', () => {
  test('1 – happy path → generates token and redirects', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, { refresh: REFRESH_OK });

    let redirectUrl = '';
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('callback.local')) {
        redirectUrl = frame.url();
      }
    });

    await page.goto(VALID_URL);
    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Generate Token' }).click();

    // Wait for redirect
    await page.waitForURL((url) => url.hostname === 'callback.local', { timeout: 10_000 }).catch(() => {});
    // Try to get redirect from navigation event
    const finalUrl = redirectUrl || page.url();

    expect(finalUrl).toContain('access_token=scoped-access');
    expect(finalUrl).toContain('refresh_token=scoped-refresh');
  });

  test('2 – missing callback-url → error shown', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, { refresh: REFRESH_OK });

    await page.goto('/auth/?mode=admin&permissions=admin');
    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Generate Token' }).click();

    await expect(page.getByText('Missing callback URL')).toBeVisible({ timeout: 10_000 });
  });

  test('3 – client-key API error → error view shown', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, { refresh: REFRESH_OK, clientKey: null });

    await page.goto(VALID_URL);
    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Generate Token' }).click();

    await expect(page.getByTestId('error-view')).toBeVisible({ timeout: 10_000 });
  });

  test('4 – click Cancel (back) – no error, same page or history back', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, { refresh: REFRESH_OK });

    await page.goto(VALID_URL);
    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 10_000 });

    // Cancel should trigger window.history.back() – on a fresh page it stays
    await page.getByRole('button', { name: 'Cancel' }).click();

    // No error view should appear
    await expect(page.getByTestId('error-view')).not.toBeVisible();
  });
});
