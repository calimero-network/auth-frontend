/**
 * True end-to-end login: a real browser drives THIS build of the auth
 * frontend against a LIVE merod with embedded auth — no mocks anywhere.
 *
 * Covers the layer nothing else tests: URL-param handling, the provider and
 * credential screens, the consent view, the redirect back to the app with
 * tokens in the URL fragment — and, closing the loop, that the delivered
 * token actually authorizes a call on the node.
 *
 * The frontend is served by `vite preview` (see playwright.config.ts) and
 * pointed at the node via the `app-url` param — the same mechanism apps use
 * in production. The node must run `--auth-mode embedded` with
 * `allow_all_origins = true` in `[server.embedded_auth.cors]` (the UI origin
 * differs from the node origin here; in production they're the same origin).
 * The admin account is provisioned before the suite runs (at `merod init`
 * on core >= rc.17, or by the CI pre-mint step on older releases) — every
 * login here is a plain existing-user authentication, which is all the UI
 * supports now that the login path never mints keys.
 *
 * Seam twins (API-level, no browser):
 *   core   crates/auth/tests/client_token_contract.rs + scripts/e2e-auth-seam.sh
 *   mero-react  tests/e2e/client-token.test.ts
 */
import { test, expect } from '@playwright/test';

const NODE_URL = process.env.NODE_URL || 'http://localhost:4081';
const USERNAME = process.env.MERO_E2E_USER || 'dev';
const PASSWORD = process.env.MERO_E2E_PASS || 'dev-password';

test('login through the UI delivers working tokens', async ({
  page,
  request,
}) => {
  const callback = 'http://localhost:4173/';

  await page.goto(
    `/auth/login?callback-url=${encodeURIComponent(callback)}` +
      `&permissions=admin&app-url=${encodeURIComponent(NODE_URL)}`,
  );

  // Provider screen (list fetched live from the node).
  await page.getByText('Username/Password').click();

  // Credential form: a plain username/password login — the setup-code
  // field is gone along with the first-login bootstrap flow it served.
  await page.getByPlaceholder('Enter your username').fill(USERNAME);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Consent screen → mint the client key.
  await page.getByRole('button', { name: 'Generate Token' }).click();

  // The app hand-off: tokens travel in the URL fragment.
  await page.waitForURL(
    (url) => url.href.startsWith(callback) && url.hash.includes('access_token='),
  );
  const fragment = new URLSearchParams(new URL(page.url()).hash.slice(1));
  const accessToken = fragment.get('access_token');
  expect(accessToken).toBeTruthy();
  expect(fragment.get('refresh_token')).toBeTruthy();
  // mero-react binds its client to this — a wrong/missing node_url strands
  // the app on a node that never issued the tokens.
  expect(fragment.get('node_url')).toBe(NODE_URL);

  // Close the loop: the delivered token must authorize a real API call.
  const res = await request.get(`${NODE_URL}/admin-api/contexts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res.status()).toBe(200);
});

/**
 * Returning user: the session check must be READ-ONLY.
 *
 * Refresh tokens are single-use since calimero-network/core#3083 — every
 * POST /auth/refresh consumes the one it is given. This screen used to probe
 * liveness *with* /auth/refresh, so every mount spent a refresh token; the
 * rotated replacement was never persisted (MeroJs had no tokenStore), so the
 * next load replayed the consumed one and the node revoked the family.
 *
 * The probe is now HEAD /auth/validate, which consumes nothing.
 */
test('a returning user resumes the session without spending a refresh token', async ({
  page,
}) => {
  const callback = 'http://localhost:4173/';
  const loginUrl =
    `/auth/login?callback-url=${encodeURIComponent(callback)}` +
    `&permissions=admin&app-url=${encodeURIComponent(NODE_URL)}`;

  await page.goto(loginUrl);
  await page.getByText('Username/Password').click();
  await page.getByPlaceholder('Enter your username').fill(USERNAME);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Generate Token' }).waitFor();

  const storedRefreshToken = await page.evaluate(() =>
    localStorage.getItem('calimero_refresh_token'),
  );
  expect(storedRefreshToken).toBeTruthy();

  const refreshCalls: string[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith('/auth/refresh')) refreshCalls.push(req.url());
  });

  // Come back to the login screen with the session still in localStorage.
  await page.goto(loginUrl);

  // Straight through to consent — no provider screen, no credentials.
  await expect(page.getByRole('button', { name: 'Generate Token' })).toBeVisible();

  expect(refreshCalls).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('calimero_refresh_token')))
    .toBe(storedRefreshToken);
});
