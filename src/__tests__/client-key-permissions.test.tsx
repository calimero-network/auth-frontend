/**
 * Contract pin: the permissions the app requests MUST reach
 * POST /admin/client-key untouched.
 *
 * Core's permission model treats bracket params on context permissions as
 * context ids, and the SDK routes (GET/POST /admin-api/contexts,
 * POST /jsonrpc) require Global scope. Since core 0.11.0-rc.9 enforces
 * token scopes, any rewrite of the requested permissions (e.g. scoping them
 * to the application id, as this flow did until PR #33) mints tokens the
 * node rejects with 403 on every route — locking apps in an endless
 * login loop.
 *
 * Core-side twin: `core/crates/auth/tests/client_token_contract.rs` asserts
 * these exact strings satisfy the validator. If you change what this flow
 * sends, update that contract test in the same breath.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../vitest.setup';
import { PackageFlow } from '../flows/PackageFlow';

// The flow steps before token generation (registry fetch, app install,
// permission review UI) are not under test — stub them down to their
// completion callbacks so the test drives PackageFlow's own logic only.
vi.mock('../components/manifest/ManifestProcessor', () => ({
  ManifestProcessor: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>manifest-complete</button>
  ),
}));
vi.mock('../components/permissions/PermissionsView', () => ({
  PermissionsView: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>approve-permissions</button>
  ),
}));

const APP_ID = '9e4gX24aMx3KWWViZeYu8E4e8UrntWDEsuDTFJTXdKsu';

/** What mero-react's getPermissionsForMode(AppMode.MultiContext) sends. */
const REQUESTED = ['context:create', 'context:list', 'context:execute'];

describe('client-key permission passthrough (rc.9 contract)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    sessionStorage.setItem('permissions', REQUESTED.join(','));
    sessionStorage.setItem('callback-url', 'http://app.example.com/');
    // Set by the (stubbed) manifest/install step in the real flow.
    localStorage.setItem('installed-application-id', APP_ID);
  });

  it('sends the requested permissions unscoped, with no context binding', async () => {
    let requestBody: {
      context_id: string;
      context_identity: string;
      permissions: string[];
    } | null = null;

    server.use(
      http.post('*/admin/client-key', async ({ request }) => {
        requestBody = (await request.json()) as typeof requestBody;
        return HttpResponse.json({
          data: { access_token: 'access', refresh_token: 'refresh' },
        });
      }),
    );

    render(<PackageFlow mode="multi-context" packageName="test-app" />);

    await userEvent.click(screen.getByText('manifest-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await userEvent.click(await screen.findByText('Generate Token'));

    await vi.waitFor(() => expect(requestBody).not.toBeNull());

    // The exact strings the app demanded — no [<application-id>] rewrite.
    // (normalizePermissions may reorder; order is irrelevant to core.)
    expect([...requestBody!.permissions].sort()).toEqual([...REQUESTED].sort());
    for (const perm of requestBody!.permissions) {
      expect(perm).not.toContain('[');
    }

    // Multi-context mints an unbound token: core skips the context[...]
    // binding when both fields are empty.
    expect(requestBody!.context_id).toBe('');
    expect(requestBody!.context_identity).toBe('');
  });
});
