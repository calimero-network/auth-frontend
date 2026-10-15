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
import { ApplicationFlow } from '../flows/ApplicationFlow';

// The flow steps before token generation (registry fetch, app install,
// permission review UI) are not under test — stub them down to their
// completion callbacks so the test drives PackageFlow's own logic only.
vi.mock('../components/manifest/ManifestProcessor', () => ({
  ManifestProcessor: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>manifest-complete</button>
  ),
}));
vi.mock('../components/applications/ApplicationInstallCheck', () => ({
  ApplicationInstallCheck: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>app-check-complete</button>
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

/** The node answers `GET /admin-api/applications/{id}` with only these installs. */
const nodeHas = (...apps: { id: string; package: string }[]) =>
  server.use(
    http.get('*/admin-api/applications/:id', ({ params }) => {
      const application = apps.find((app) => app.id === params.id) ?? null;
      return HttpResponse.json({ data: { application } });
    }),
  );

/** Captures what the flow sends to `POST /admin/client-key`, if anything. */
const captureMint = () => {
  const sent: { body: Record<string, unknown> | null } = { body: null };
  server.use(
    http.post('*/admin/client-key', async ({ request }) => {
      sent.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } });
    }),
  );
  return sent;
};

describe('client-key permission passthrough (rc.9 contract)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    sessionStorage.setItem('permissions', REQUESTED.join(','));
    sessionStorage.setItem('callback-url', 'http://app.example.com/');
    // Set by the (stubbed) manifest/install step in the real flow.
    localStorage.setItem('installed-application-id', APP_ID);
    nodeHas({ id: APP_ID, package: 'test-app' }, { id: 'copycat-id', package: 'com.example.copycat' });
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

  it('never mints admin, keys or management grants for an app, whatever the URL asks for', async () => {
    sessionStorage.setItem('permissions', [...REQUESTED, 'admin', 'admin:x', 'keys:create', 'context', 'context:capabilities:grant'].join(','));

    let requestBody: { permissions: string[] } | null = null;
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
    expect([...requestBody!.permissions].sort()).toEqual([...REQUESTED].sort());
  });

  describe('binds the key to the application being approved', () => {
    const approvePackage = async (packageName = 'test-app') => {
      render(<PackageFlow mode="multi-context" packageName={packageName} />);
      await userEvent.click(screen.getByText('manifest-complete'));
      await userEvent.click(screen.getByText('approve-permissions'));
      await userEvent.click(await screen.findByText('Generate Token'));
    };

    it('names the installed application in the package flow', async () => {
      const sent = captureMint();
      await approvePackage();
      await vi.waitFor(() => expect(sent.body).not.toBeNull());
      expect(sent.body!.application_id).toBe(APP_ID);
    });

    it('mints nothing when the node does not have the application', async () => {
      nodeHas();
      const sent = captureMint();
      await approvePackage();
      expect(await screen.findByText(/not installed on this node/i)).toBeTruthy();
      expect(sent.body).toBeNull();
    });

    it('mints nothing when the installed application belongs to another package', async () => {
      nodeHas({ id: APP_ID, package: 'com.example.other' });
      const sent = captureMint();
      await approvePackage();
      expect(await screen.findByText(/not installed on this node/i)).toBeTruthy();
      expect(sent.body).toBeNull();
    });

    it('names the installed application in the application flow', async () => {
      const sent = captureMint();
      render(<ApplicationFlow mode="multi-context" applicationId={APP_ID} applicationPath="" />);
      await userEvent.click(screen.getByText('app-check-complete'));
      await userEvent.click(screen.getByText('approve-permissions'));
      await vi.waitFor(() => expect(sent.body).not.toBeNull());
      expect(sent.body!.application_id).toBe(APP_ID);
    });

    it('mints nothing in the application flow when the node does not have the application', async () => {
      const sent = captureMint();
      render(<ApplicationFlow mode="multi-context" applicationId="not-installed" applicationPath="" />);
      await userEvent.click(screen.getByText('app-check-complete'));
      await userEvent.click(screen.getByText('approve-permissions'));
      expect(await screen.findByText(/not installed on this node/i)).toBeTruthy();
      expect(sent.body).toBeNull();
    });
  });

  // Hyperfeed runs the node for you, as the admin dashboard does: from its own
  // frontend it signs in with full access, which the consent screen names.
  // Calimero Desktop grants the same app the same thing (tauri-app TRUSTED_APPS).
  describe('a trusted first-party app', () => {
    const mint = async (mode: 'multi-context' | 'single-context', packageName: string) => {
      nodeHas({ id: APP_ID, package: packageName });
      let requestBody: { context_id: string; permissions: string[] } | null = null;
      server.use(
        http.post('*/admin/client-key', async ({ request }) => {
          requestBody = (await request.json()) as typeof requestBody;
          return HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } });
        }),
      );
      render(<PackageFlow mode={mode} packageName={packageName} />);
      await userEvent.click(screen.getByText('manifest-complete'));
      await userEvent.click(screen.getByText('approve-permissions'));
      await userEvent.click(await screen.findByText('Generate Token'));
      await vi.waitFor(() => expect(requestBody).not.toBeNull());
      return requestBody!;
    };

    it('signs Hyperfeed in with full access from its own frontend, unbound', async () => {
      sessionStorage.setItem('callback-url', 'https://hyperfeed.me/settings');
      const body = await mint('multi-context', 'com.calimero.hyperfeed');
      expect(body.permissions).toEqual(['admin']);
      expect(body.context_id).toBe('');
      expect(body).not.toHaveProperty('application_id');
    });

    it('still signs in Hyperfeed served from its previous vercel.app frontend', async () => {
      sessionStorage.setItem('callback-url', 'https://hyperfeed-two.vercel.app/settings');
      const body = await mint('multi-context', 'com.calimero.hyperfeed');
      expect(body.permissions).toEqual(['admin']);
    });

    it('gives the app set to Hyperfeed calling back anywhere else', async () => {
      sessionStorage.setItem('callback-url', 'https://hyperfeed.evil.example/');
      const body = await mint('multi-context', 'com.calimero.hyperfeed');
      expect([...body.permissions].sort()).toEqual([...REQUESTED].sort());
    });

    it('gives the app set to another package calling back to Hyperfeed\'s frontend', async () => {
      sessionStorage.setItem('callback-url', 'https://hyperfeed-two.vercel.app/');
      const body = await mint('multi-context', 'com.example.copycat');
      expect([...body.permissions].sort()).toEqual([...REQUESTED].sort());
    });
  });
});
