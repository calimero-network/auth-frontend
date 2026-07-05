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
 * First login on a fresh node bootstraps the root user with these
 * credentials.
 *
 * Seam twins (API-level, no browser):
 *   core   crates/auth/tests/client_token_contract.rs + scripts/e2e-auth-seam.sh
 *   mero-react  tests/e2e/client-token.test.ts
 */
import { test, expect } from '@playwright/test';

const NODE_URL = process.env.NODE_URL || 'http://localhost:4081';
const USERNAME = process.env.MERO_E2E_USER || 'dev';
const PASSWORD = process.env.MERO_E2E_PASS || 'dev';

test('admin login flow delivers working tokens to the callback', async ({
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

  // Credential form; first login bootstraps the root key on a fresh node.
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
