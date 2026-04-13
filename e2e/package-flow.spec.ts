import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';
import { seedAdminSession } from './helpers/session';
import { mockBundle } from './fixtures/bundle';
import { mockContext, DEV_SIGNER_ID } from './fixtures/app';

const PKG_SINGLE =
  '/auth/?package-name=com.example.myapp&callback-url=http://callback.local/done&mode=single-context&permissions=context:execute';

const PKG_MULTI =
  '/auth/?package-name=com.example.myapp&callback-url=http://callback.local/done&mode=multi-context&permissions=context:execute';

const REFRESH_OK = { data: { access_token: 'mock-access', refresh_token: 'mock-refresh' } };

const REGISTRY_BUNDLE = [mockBundle()];

test.describe('PackageFlow', () => {
  test('1 – dev mode (app installed locally with DEV_SIGNER_ID) → skip registry', async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: {
        data: {
          apps: [
            {
              id: 'dev-app-id',
              package: 'com.example.myapp',
              signer_id: DEV_SIGNER_ID,
              version: '0.1.0',
            },
          ],
        },
      },
    });

    await page.goto(PKG_SINGLE);

    // Dev mode skips registry, goes straight to PermissionsView
    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 15_000 });
  });

  test('2 – already installed via registry → auto-advances to PermissionsView', async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: { data: { apps: [] } },
      registryBundles: REGISTRY_BUNDLE,
      getLatestPackage: (id) =>
        id === 'com.example.myapp' ? { applicationId: 'pkg-app-001' } : null,
    });

    await page.goto(PKG_SINGLE);

    // ManifestProcessor auto-advances when package is already installed
    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 15_000 });
  });

  test('3 – not installed → shows manifest with Install & Continue', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: { data: { apps: [] } },
      registryBundles: REGISTRY_BUNDLE,
      getLatestPackage: () => null,
    });

    await page.goto(PKG_SINGLE);

    await expect(page.getByText('My App')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Install & Continue' })).toBeVisible();
  });

  test('4 – install from registry → PermissionsView shown', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: { data: { apps: [] } },
      registryBundles: REGISTRY_BUNDLE,
      getLatestPackage: () => null,
      installApplication: { data: { applicationId: 'newly-pkg-app' } },
      getContextsForApplication: { data: { contexts: [] } },
    });

    await page.goto(PKG_SINGLE);

    await expect(page.getByRole('button', { name: 'Install & Continue' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Install & Continue' }).click();

    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 15_000 });
  });

  test('5 – registry unreachable → error shown', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: { data: { apps: [] } },
      registryBundles: null,
    });

    await page.goto(PKG_SINGLE);

    await expect(page.getByTestId('error-view')).toBeVisible({ timeout: 15_000 });
  });

  test('6 – registry returns empty bundle list → error shown', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: { data: { apps: [] } },
      registryBundles: [],
    });

    await page.goto(PKG_SINGLE);

    await expect(page.getByTestId('error-view')).toBeVisible({ timeout: 15_000 });
  });

  test('7 – multi-context mode → SummaryView → Generate Token → redirect', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: {
        data: {
          apps: [
            {
              id: 'dev-app-id',
              package: 'com.example.myapp',
              signer_id: DEV_SIGNER_ID,
              version: '0.1.0',
            },
          ],
        },
      },
    });

    let redirectUrl = '';
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('callback.local')) {
        redirectUrl = frame.url();
      }
    });

    await page.goto(PKG_MULTI);

    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Approve Permissions' }).click();

    // SummaryView
    await expect(page.getByRole('button', { name: 'Generate Token' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Generate Token' }).click();

    await page.waitForURL((url) => url.hostname === 'callback.local', { timeout: 10_000 }).catch(() => {});
    const finalUrl = redirectUrl || page.url();

    expect(finalUrl).toContain('access_token=scoped-access');
    expect(finalUrl).toContain('application_id=dev-app-id');
  });

  test('8 – single-context mode → PermissionsView → ContextSelector → SummaryView → redirect', async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: {
        data: {
          apps: [
            {
              id: 'dev-app-id',
              package: 'com.example.myapp',
              signer_id: DEV_SIGNER_ID,
              version: '0.1.0',
            },
          ],
        },
      },
      getContexts: {
        data: {
          contexts: [mockContext({ id: 'ctx-001', applicationId: 'dev-app-id' })],
        },
      },
      getIdentities: { data: { identities: ['ed25519:Identity_ABC123'] } },
    });

    let redirectUrl = '';
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('callback.local')) {
        redirectUrl = frame.url();
      }
    });

    await page.goto(PKG_SINGLE);

    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Approve Permissions' }).click();

    // ContextSelector
    await expect(page.getByText('Select a context')).toBeVisible({ timeout: 10_000 });
    await page.getByText('ctx-001').first().click();

    // Identity selector
    await expect(page.getByText('Select an identity')).toBeVisible({ timeout: 10_000 });
    await page.getByText('ed25519:Identity_ABC123').first().click();

    // SummaryView
    await expect(page.getByRole('button', { name: 'Generate Token' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Generate Token' }).click();

    await page.waitForURL((url) => url.hostname === 'callback.local', { timeout: 10_000 }).catch(() => {});
    const finalUrl = redirectUrl || page.url();

    expect(finalUrl).toContain('access_token=scoped-access');
    expect(finalUrl).toContain('context_id=ctx-001');
  });

  test('9 – back navigation from SummaryView → returns to PermissionsView', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: {
        data: {
          apps: [
            {
              id: 'dev-app-id',
              package: 'com.example.myapp',
              signer_id: DEV_SIGNER_ID,
              version: '0.1.0',
            },
          ],
        },
      },
    });

    await page.goto(PKG_MULTI);

    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Approve Permissions' }).click();

    await expect(page.getByRole('button', { name: 'Generate Token' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.getByText('Review Permissions')).toBeVisible({ timeout: 10_000 });
  });

  test('10 – installation failure (no app ID returned) → error shown', async ({ page }) => {
    await seedAdminSession(page);
    await setupMocks(page, {
      refresh: REFRESH_OK,
      getApplications: { data: { apps: [] } },
      registryBundles: REGISTRY_BUNDLE,
      getLatestPackage: () => null,
      // Return empty data object — no applicationId
      installApplication: { data: { applicationId: '' } } as any,
      getContextsForApplication: { data: { contexts: [] } },
    });

    await page.goto(PKG_SINGLE);

    await expect(page.getByRole('button', { name: 'Install & Continue' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Install & Continue' }).click();

    // ManifestProcessor throws 'Installation succeeded but no application ID returned'
    await expect(page.getByTestId('error-view')).toBeVisible({ timeout: 10_000 });
  });
});
