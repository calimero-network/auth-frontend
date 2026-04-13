import { Page } from '@playwright/test';

export type MockOverrides = {
  /** Return providers list; null → 500 error */
  providers?: Array<{ name: string; type: string; configured: boolean }> | null;
  /** Login response; null → 401 error */
  login?: { data: { access_token: string; refresh_token: string } } | null;
  /** Refresh token response; 'still-valid' → 400 error msg; 'fail' → 401 */
  refresh?: { data: { access_token: string; refresh_token: string } } | 'still-valid' | 'fail';
  /** Client-key generation; null → 500 error */
  clientKey?: { data: { access_token: string; refresh_token: string } } | null;
  /** GET /admin-api/applications (list) */
  getApplications?: { data: { apps: any[] } };
  /** GET /admin-api/applications/:id; null → 404 */
  getApplication?: (id: string) => any | null;
  /** GET /admin-api/packages/:id/latest; null → 404 */
  getLatestPackage?: (id: string) => any | null;
  /** POST /admin-api/install-application response; null → 500 error */
  installApplication?: { data: { applicationId: string } } | null;
  /** GET /admin-api/contexts/for-application/:id */
  getContextsForApplication?: { data: { contexts: any[] } };
  /** GET /admin-api/contexts (list all) */
  getContexts?: { data: { contexts: any[] } };
  /** GET /admin-api/contexts/:id/identities-owned */
  getIdentities?: { data: { identities: string[] } };
  /** GET https://apps.calimero.network/api/v2/bundles; null → 500; [] → empty */
  registryBundles?: any[] | null;
};

const DEFAULT_PROVIDERS = [
  { name: 'user_password', type: 'user_password', configured: true },
];
const DEFAULT_TOKENS = {
  data: { access_token: 'mock-access', refresh_token: 'mock-refresh' },
};
const DEFAULT_CLIENT_KEY = {
  data: { access_token: 'scoped-access', refresh_token: 'scoped-refresh' },
};

export async function setupMocks(page: Page, overrides: MockOverrides = {}) {
  // ── Auth: GET /auth/providers ──────────────────────────────────────────
  await page.route('**/auth/providers', async (route) => {
    const providers = overrides.providers !== undefined ? overrides.providers : DEFAULT_PROVIDERS;
    if (providers === null) {
      return route.fulfill({ status: 500, json: { error: 'Server error' } });
    }
    return route.fulfill({ json: { data: { providers } } });
  });

  // ── Auth: POST /auth/token (login) ─────────────────────────────────────
  await page.route('**/auth/token', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = overrides.login !== undefined ? overrides.login : DEFAULT_TOKENS;
    if (response === null) {
      return route.fulfill({ status: 401, json: { error: 'Invalid credentials' } });
    }
    return route.fulfill({ json: response });
  });

  // ── Auth: POST /auth/refresh ────────────────────────────────────────────
  await page.route('**/auth/refresh', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const refresh = overrides.refresh !== undefined ? overrides.refresh : DEFAULT_TOKENS;
    if (refresh === 'still-valid') {
      return route.fulfill({ status: 400, json: { error: 'Access token still valid' } });
    }
    if (refresh === 'fail') {
      return route.fulfill({ status: 401, json: { error: 'Invalid token' } });
    }
    return route.fulfill({ json: refresh });
  });

  // ── Client key: POST /admin/client-key ─────────────────────────────────
  await page.route('**/admin/client-key', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const clientKey = overrides.clientKey !== undefined ? overrides.clientKey : DEFAULT_CLIENT_KEY;
    if (clientKey === null) {
      return route.fulfill({ status: 500, json: { error: 'Server error' } });
    }
    return route.fulfill({ json: clientKey });
  });

  // ── GET /admin-api/applications (list, must be before /applications/**) ─
  await page.route('**/admin-api/applications', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const result = overrides.getApplications ?? { data: { apps: [] } };
    return route.fulfill({ json: result });
  });

  // ── GET /admin-api/applications/:id ────────────────────────────────────
  await page.route('**/admin-api/applications/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop()!;
    if (overrides.getApplication) {
      const result = overrides.getApplication(id);
      if (result === null) {
        return route.fulfill({ status: 404, json: { error: 'Not found' } });
      }
      return route.fulfill({ json: { data: result } });
    }
    return route.fulfill({ status: 404, json: { error: 'Not found' } });
  });

  // ── POST /admin-api/install-application ────────────────────────────────
  await page.route('**/admin-api/install-application', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const result =
      overrides.installApplication !== undefined
        ? overrides.installApplication
        : { data: { applicationId: 'mock-app-id-001' } };
    if (result === null) {
      return route.fulfill({ status: 500, json: { error: 'Install failed' } });
    }
    return route.fulfill({ json: result });
  });

  // ── GET /admin-api/packages/:id/latest ─────────────────────────────────
  await page.route('**/admin-api/packages/**/latest', async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split('/');
    const pkgIdx = segments.indexOf('packages');
    const id = pkgIdx >= 0 ? segments[pkgIdx + 1] : '';
    if (overrides.getLatestPackage) {
      const result = overrides.getLatestPackage(id);
      if (result === null) {
        return route.fulfill({ status: 404, json: { error: 'Not found' } });
      }
      return route.fulfill({ json: result });
    }
    return route.fulfill({ status: 404, json: { error: 'Not found' } });
  });

  // ── GET /admin-api/contexts/for-application/:id ─────────────────────────
  await page.route('**/admin-api/contexts/for-application/**', async (route) => {
    const result = overrides.getContextsForApplication ?? { data: { contexts: [] } };
    return route.fulfill({ json: result });
  });

  // ── GET /admin-api/contexts/:id/identities-owned ────────────────────────
  await page.route('**/admin-api/contexts/*/identities-owned', async (route) => {
    const result = overrides.getIdentities ?? { data: { identities: [] } };
    return route.fulfill({ json: result });
  });

  // ── /admin-api/contexts (GET list + POST create — single handler to avoid LIFO conflicts) ──
  await page.route('**/admin-api/contexts', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    // Only handle exact /admin-api/contexts (no sub-paths like /for-application/... or /.../identities-owned)
    if (!path.endsWith('/admin-api/contexts') && path !== '/admin-api/contexts') {
      return route.continue();
    }
    if (route.request().method() === 'GET') {
      const result = overrides.getContexts ?? { data: { contexts: [] } };
      return route.fulfill({ json: result });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        json: { data: { contextId: 'ctx-001', memberPublicKey: 'pk-001' } },
      });
    }
    return route.continue();
  });

  // ── Registry: https://apps.calimero.network/api/v2/bundles ─────────────
  await page.route('https://apps.calimero.network/api/v2/bundles**', async (route) => {
    const bundles = overrides.registryBundles !== undefined ? overrides.registryBundles : [];
    if (bundles === null) {
      return route.fulfill({ status: 500, json: { error: 'Registry unavailable' } });
    }
    return route.fulfill({ json: bundles });
  });

  // ── Callback URL: prevent navigation errors ─────────────────────────────
  await page.route('http://callback.local/**', async (route) => {
    return route.fulfill({ status: 200, body: '<html><body>OK</body></html>', contentType: 'text/html' });
  });
}
