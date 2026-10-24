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
import { AdminFlow } from '../flows/AdminFlow';
import { resetNodeTrustedOrigins } from '../utils/callbackUrl';
import { idBytes, toBase32, toHex } from '../utils/__tests__/appIds';

// The flow steps before token generation (registry fetch, app install,
// permission review UI) are not under test — stub them down to their
// completion callbacks so the test drives PackageFlow's own logic only.
const stub = vi.hoisted(() => ({ installed: '', resolved: '', race: null as (() => void) | null }));
vi.mock('../components/manifest/ManifestProcessor', () => ({
  ManifestProcessor: ({ onComplete }: { onComplete: (applicationId: string) => void }) => (
    <button
      onClick={() => {
        // The real step records the id in storage, then hands it over.
        localStorage.setItem('installed-application-id', stub.installed);
        stub.race?.();
        onComplete(stub.installed);
      }}
    >
      manifest-complete
    </button>
  ),
}));
vi.mock('../components/applications/ApplicationInstallCheck', () => ({
  ApplicationInstallCheck: ({ onComplete }: { onComplete: (applicationId: string) => void }) => (
    <button onClick={() => onComplete(stub.resolved)}>app-check-complete</button>
  ),
}));
vi.mock('../components/permissions/PermissionsView', () => ({
  PermissionsView: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>approve-permissions</button>
  ),
}));

const APP_ID = '9e4gX24aMx3KWWViZeYu8E4e8UrntWDEsuDTFJTXdKsu';

/**
 * What mero-react's getPermissionsForMode(AppMode.MultiContext) sends, verbatim.
 * This used to be only the first three, so the allowlist could drop the rest
 * (context:delete did) and this test still passed.
 */
const REQUESTED = [
  'context:create',
  'context:delete',
  'context:list',
  'context:execute',
  'context:subscribe',
  'application:list',
  'namespace',
  'group',
  'blob',
  'context:alias',
];

beforeEach(() => {
  stub.race = null;
});

describe('client-key permission passthrough (rc.9 contract)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetNodeTrustedOrigins();

    sessionStorage.setItem('permissions', REQUESTED.join(','));
    sessionStorage.setItem('callback-url', 'http://localhost:3000/');
    // Handed over by the (stubbed) manifest/install step in the real flow.
    stub.installed = APP_ID;
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

  // Hyperfeed runs the node for you, as the admin dashboard does: from its own
  // frontend it signs in with full access, which the consent screen names.
  // Calimero Desktop grants the same app the same thing (tauri-app TRUSTED_APPS).
  describe('a trusted first-party app', () => {
    const mint = async (mode: 'multi-context' | 'single-context', packageName: string) => {
      let requestBody: { context_id: string; permissions: string[]; application_id?: string } | null = null;
      resetNodeTrustedOrigins();
      // The node trusts the callback, so the permissions it gets are what is under test.
      const trusted = new URL(sessionStorage.getItem('callback-url')!).origin;
      server.use(
        http.get('*/auth/providers', () => HttpResponse.json({ trusted_callback_origins: [trusted] })),
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
      // Core refuses admin on a bound key unless the app is in its trusted set.
      expect('application_id' in body).toBe(false);
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

describe('application binding at mint', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('permissions', 'context:list');
    sessionStorage.setItem('callback-url', 'http://localhost:3000/');
    stub.installed = APP_ID;
    stub.resolved = APP_ID;
  });

  const captureMint = () => {
    const box: { body: Record<string, unknown> | null } = { body: null };
    server.use(
      http.post('*/admin/client-key', async ({ request }) => {
        box.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } });
      }),
    );
    return box;
  };

  it('sends the installed application id for a package login', async () => {
    const box = captureMint();
    render(<PackageFlow mode="multi-context" packageName="test-app" />);
    await userEvent.click(screen.getByText('manifest-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await userEvent.click(await screen.findByText('Generate Token'));
    await vi.waitFor(() => expect(box.body).not.toBeNull());
    expect(box.body!.application_id).toBe(APP_ID);
  });

  it('sends the application-id param for an application login', async () => {
    const box = captureMint();
    render(<ApplicationFlow mode="multi-context" applicationId={APP_ID} applicationPath="" />);
    await userEvent.click(screen.getByText('app-check-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await vi.waitFor(() => expect(box.body).not.toBeNull());
    expect(box.body!.application_id).toBe(APP_ID);
  });

  it('sends no application id for an admin login', async () => {
    const box = captureMint();
    sessionStorage.setItem('permissions', 'admin');
    render(<AdminFlow />);
    await userEvent.click(screen.getByText('approve-permissions'));
    await vi.waitFor(() => expect(box.body).not.toBeNull());
    expect('application_id' in box.body!).toBe(false);
  });
});

describe('app-origin callbacks follow the id the login minted for', () => {
  const ID_A = toHex(idBytes(1));
  const ID_B = toHex(idBytes(2));
  const LABEL_A = toBase32(idBytes(1));
  const LABEL_B = toBase32(idBytes(2));
  const originalHref = window.location.href;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('permissions', 'context:list');
    stub.installed = '';
    stub.resolved = ID_A;
    window.location.href = originalHref;
    server.use(
      http.post('*/admin/client-key', () =>
        HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } }),
      ),
    );
  });

  const appCallback = (label: string) => `http://${label}.localhost:5173/`;
  const delivered = () => window.location.href.includes('access_token=');

  it('admin login refuses an app-origin callback even when application-id names that app', async () => {
    sessionStorage.setItem('permissions', 'admin');
    sessionStorage.setItem('application-id', ID_A);
    sessionStorage.setItem('callback-url', appCallback(LABEL_A));
    render(<AdminFlow />);
    await userEvent.click(screen.getByText('approve-permissions'));
    await screen.findByText(/not allowed/i);
    expect(delivered()).toBe(false);
  });

  it('admin login refuses an app-origin callback left over from a stale installed app id', async () => {
    sessionStorage.setItem('permissions', 'admin');
    localStorage.setItem('installed-application-id', ID_B);
    sessionStorage.setItem('callback-url', appCallback(LABEL_B));
    render(<AdminFlow />);
    await userEvent.click(screen.getByText('approve-permissions'));
    await screen.findByText(/not allowed/i);
    expect(delivered()).toBe(false);
  });

  it('package login refuses the label of an application-id param that is not the minted app', async () => {
    sessionStorage.setItem('application-id', ID_A);
    sessionStorage.setItem('callback-url', appCallback(LABEL_A));
    stub.installed = ID_B;
    render(<PackageFlow mode="multi-context" packageName="test-app" />);
    await userEvent.click(screen.getByText('manifest-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await userEvent.click(await screen.findByText('Generate Token'));
    await screen.findByText(/not allowed/i);
    expect(delivered()).toBe(false);
  });

  it('package login accepts the label of the app it minted for', async () => {
    sessionStorage.setItem('callback-url', appCallback(LABEL_B));
    stub.installed = ID_B;
    render(<PackageFlow mode="multi-context" packageName="test-app" />);
    await userEvent.click(screen.getByText('manifest-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await userEvent.click(await screen.findByText('Generate Token'));
    await vi.waitFor(() => expect(delivered()).toBe(true));
  });

  it('application login refuses the label of a stored id that is not the minted prop', async () => {
    sessionStorage.setItem('application-id', ID_A);
    sessionStorage.setItem('callback-url', appCallback(LABEL_A));
    stub.resolved = ID_B;
    render(<ApplicationFlow mode="multi-context" applicationId={ID_B} applicationPath="" />);
    await userEvent.click(screen.getByText('app-check-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await screen.findByText(/not allowed/i);
    expect(delivered()).toBe(false);
  });

  it('application login accepts the label of the minted prop', async () => {
    sessionStorage.setItem('callback-url', appCallback(LABEL_A));
    render(<ApplicationFlow mode="multi-context" applicationId={ID_A} applicationPath="" />);
    await userEvent.click(screen.getByText('app-check-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await vi.waitFor(() => expect(delivered()).toBe(true));
  });
  it('mints and checks the callback with the installed id a package-id login resolved to', async () => {
    const box: { body: Record<string, unknown> | null } = { body: null };
    server.use(
      http.post('*/admin/client-key', async ({ request }) => {
        box.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } });
      }),
    );
    const packageId = toHex(idBytes(9));
    sessionStorage.setItem('callback-url', appCallback(LABEL_A));
    render(<ApplicationFlow mode="multi-context" applicationId={packageId} applicationPath="" />);
    await userEvent.click(screen.getByText('app-check-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await vi.waitFor(() => expect(delivered()).toBe(true));
    expect(box.body!.application_id).toBe(ID_A);
  });

  it('mints the id the install step handed over, whatever storage says by then', async () => {
    const box: { body: Record<string, unknown> | null } = { body: null };
    server.use(
      http.post('*/admin/client-key', async ({ request }) => {
        box.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } });
      }),
    );
    stub.installed = ID_A;
    stub.race = () => localStorage.setItem('installed-application-id', ID_B);
    sessionStorage.setItem('callback-url', appCallback(LABEL_A));
    render(<PackageFlow mode="multi-context" packageName="test-app" />);
    await userEvent.click(screen.getByText('manifest-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await userEvent.click(await screen.findByText('Generate Token'));
    await vi.waitFor(() => expect(delivered()).toBe(true));
    expect(box.body!.application_id).toBe(ID_A);
  });

  it('trusted-app login mints unbound but keeps the installed app id in the callback fragment', async () => {
    const box: { body: Record<string, unknown> | null } = { body: null };
    server.use(
      http.post('*/admin/client-key', async ({ request }) => {
        box.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } });
      }),
    );
    sessionStorage.setItem('callback-url', 'https://hyperfeed.me/');
    resetNodeTrustedOrigins();
    server.use(
      http.get('*/auth/providers', () =>
        HttpResponse.json({ data: { trusted_callback_origins: ['https://hyperfeed.me'] } }),
      ),
    );
    stub.installed = ID_A;
    render(<PackageFlow mode="multi-context" packageName="com.calimero.hyperfeed" />);
    await userEvent.click(screen.getByText('manifest-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await userEvent.click(await screen.findByText('Generate Token'));
    await vi.waitFor(() => expect(delivered()).toBe(true));
    expect('application_id' in box.body!).toBe(false);
    const fragment = new URLSearchParams(window.location.href.split('#')[1]);
    expect(fragment.get('application_id')).toBe(ID_A);
  });

  it('sends no mint request for a callback that would be refused', async () => {
    let mints = 0;
    server.use(
      http.post('*/admin/client-key', () => {
        mints += 1;
        return HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } });
      }),
    );
    stub.installed = ID_A;
    sessionStorage.setItem('callback-url', appCallback(LABEL_B));
    render(<PackageFlow mode="multi-context" packageName="test-app" />);
    await userEvent.click(screen.getByText('manifest-complete'));
    await userEvent.click(screen.getByText('approve-permissions'));
    await userEvent.click(await screen.findByText('Generate Token'));
    await screen.findByText(/not allowed/i);
    expect(mints).toBe(0);
  });

  it('sends no mint request for an admin login to an untrusted callback', async () => {
    let mints = 0;
    server.use(
      http.post('*/admin/client-key', () => {
        mints += 1;
        return HttpResponse.json({ data: { access_token: 'access', refresh_token: 'refresh' } });
      }),
    );
    sessionStorage.setItem('permissions', 'admin');
    sessionStorage.setItem('callback-url', 'https://evil.example/');
    render(<AdminFlow />);
    await userEvent.click(screen.getByText('approve-permissions'));
    await screen.findByText(/not allowed/i);
    expect(mints).toBe(0);
  });
});
