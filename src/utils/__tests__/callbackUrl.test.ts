import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';
import {
  resolveSafeCallbackUrl,
  resolveTrustedCallbackUrl,
  redirectTokensToCallback,
} from '../callbackUrl';

describe('resolveSafeCallbackUrl', () => {
  it('rejects a missing / empty callback', () => {
    expect(resolveSafeCallbackUrl(null)).toBeNull();
    expect(resolveSafeCallbackUrl(undefined)).toBeNull();
    expect(resolveSafeCallbackUrl('')).toBeNull();
  });

  it('rejects a malformed URL', () => {
    expect(resolveSafeCallbackUrl('not a url')).toBeNull();
    expect(resolveSafeCallbackUrl('/relative/path')).toBeNull();
  });

  it('rejects non-http(s) schemes (XSS via callback)', () => {
    expect(resolveSafeCallbackUrl('javascript:alert(1)')).toBeNull();
    expect(
      resolveSafeCallbackUrl('data:text/html,<script>alert(1)</script>'),
    ).toBeNull();
    expect(resolveSafeCallbackUrl('file:///etc/passwd')).toBeNull();
  });

  it('rejects an arbitrary foreign origin (the token-exfil case)', () => {
    expect(resolveSafeCallbackUrl('https://evil.example/#')).toBeNull();
    expect(resolveSafeCallbackUrl('http://attacker.test/cb')).toBeNull();
  });

  it('allows loopback on any port and path', () => {
    for (const u of [
      'http://localhost:5173/',
      'http://localhost:2428/auth/callback',
      'http://127.0.0.1:3000/x',
      'http://sub.localhost:9000/y',
    ]) {
      const r = resolveSafeCallbackUrl(u);
      expect(r, u).not.toBeNull();
      expect(r!.toString()).toBe(new URL(u).toString());
    }
  });

  it('allows the auth-frontend own origin (same-origin)', () => {
    const sameOrigin = `${window.location.origin}/callback`;
    expect(resolveSafeCallbackUrl(sameOrigin)).not.toBeNull();
  });

  it('does not treat a look-alike host as loopback', () => {
    // localhost.evil.example must NOT be accepted as loopback.
    expect(resolveSafeCallbackUrl('https://localhost.evil.example/cb')).toBeNull();
    expect(resolveSafeCallbackUrl('https://notlocalhost/cb')).toBeNull();
  });
});

describe('redirectTokensToCallback', () => {
  const tokens = { access_token: 'AT', refresh_token: 'RT' };
  let href: string;
  let realDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    href = window.location.href;
    realDescriptor = Object.getOwnPropertyDescriptor(window.location, 'href');
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      get: () => href,
      set: (v: string) => {
        href = v;
      },
    });
  });

  afterEach(() => {
    if (realDescriptor) {
      Object.defineProperty(window.location, 'href', realDescriptor);
    }
    vi.restoreAllMocks();
  });

  it('returns "missing" and does not navigate when no callback is given', async () => {
    const before = window.location.href;
    expect(await redirectTokensToCallback(null, tokens)).toBe('missing');
    expect(window.location.href).toBe(before);
  });

  it('returns "untrusted" and does not navigate for a foreign origin', async () => {
    const before = window.location.href;
    expect(await redirectTokensToCallback('https://evil.example/cb', tokens)).toBe(
      'untrusted',
    );
    // The token pair must never reach an untrusted origin.
    expect(window.location.href).toBe(before);
  });

  it('redirects the token pair in the fragment for a trusted loopback callback', async () => {
    const outcome = await redirectTokensToCallback(
      'http://localhost:5173/cb',
      tokens,
      { context_id: 'CTX', context_identity: null },
    );
    expect(outcome).toBe('ok');
    expect(window.location.href.startsWith('http://localhost:5173/cb#')).toBe(
      true,
    );
    const params = new URLSearchParams(window.location.href.split('#')[1]);
    expect(params.get('access_token')).toBe('AT');
    expect(params.get('refresh_token')).toBe('RT');
    expect(params.get('context_id')).toBe('CTX');
    // null / empty extras are skipped, not serialized as "null".
    expect(params.has('context_identity')).toBe(false);
    expect(params.get('node_url')).toBeTruthy();
  });
});

/**
 * Registry-declared frontend trust: the standard browser flow is a HOSTED app
 * (e.g. https://mero-chat.vercel.app) logging into a local node. The static
 * policy alone rejected it — and the frontend is baked into merod at build
 * time, so a build-time env allowlist can't be extended in the field. The app
 * registry's bundle manifest declares each package's frontend URL
 * (links.frontend); a callback matching that origin is trusted, OAuth
 * registered-redirect-URI style. Verdicts are memoized per origin per page
 * load, so each test uses a distinct origin.
 */
describe('resolveTrustedCallbackUrl (registry-declared frontends)', () => {
  const REGISTRY = 'https://apps.calimero.network';

  function serveManifest(registryOrigin: string, pkg: string, frontend?: string) {
    server.use(
      http.get(`${registryOrigin}/api/v2/bundles`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('package') !== pkg) {
          return HttpResponse.json([], { status: 404 });
        }
        return HttpResponse.json([
          {
            version: '1.0',
            package: pkg,
            appVersion: '1.2.3',
            wasm: { hash: 'sha256:abc' },
            links: frontend ? { frontend } : {},
          },
        ]);
      }),
    );
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('trusts a callback whose origin the registry declares for the flow package', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.curb');
    serveManifest(REGISTRY, 'com.calimero.curb', 'https://mero-chat-a.vercel.app/login');

    const url = await resolveTrustedCallbackUrl('https://mero-chat-a.vercel.app/login');
    expect(url?.origin).toBe('https://mero-chat-a.vercel.app');
  });

  it('rejects a callback origin the registry does not declare', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.curb');
    serveManifest(REGISTRY, 'com.calimero.curb', 'https://mero-chat-b.vercel.app/login');

    expect(await resolveTrustedCallbackUrl('https://evil-b.example/cb')).toBeNull();
  });

  it('rejects when the flow has no package-name', async () => {
    expect(
      await resolveTrustedCallbackUrl('https://mero-chat-c.vercel.app/cb'),
    ).toBeNull();
  });

  it('ignores an attacker-supplied registry-url and consults the default registry', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.curb');
    // An attacker registry happily "declares" their exfiltration origin…
    sessionStorage.setItem('registry-url', 'https://evil-registry.example');
    serveManifest('https://evil-registry.example', 'com.calimero.curb', 'https://evil-d.example');
    // …but the trusted default registry declares the real frontend.
    serveManifest(REGISTRY, 'com.calimero.curb', 'https://mero-chat-d.vercel.app');

    expect(await resolveTrustedCallbackUrl('https://evil-d.example/cb')).toBeNull();
  });

  it('fails closed when the registry lookup errors', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.broken');
    server.use(http.get(`${REGISTRY}/api/v2/bundles`, () => HttpResponse.error()));

    expect(
      await resolveTrustedCallbackUrl('https://mero-chat-e.vercel.app/cb'),
    ).toBeNull();
  });
});
