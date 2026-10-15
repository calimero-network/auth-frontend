import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../vitest.setup';
import { permissionsForPackage } from '../permissions';
import {
  resolveSafeCallbackUrl,
  resolveTrustedCallbackUrl,
  redirectTokensToCallback,
  parseOriginList,
  resetNodeTrustedOrigins,
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

  it('allows loopback on any port and path when the node is on loopback', () => {
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

/**
 * Installed-bundle frontend trust: a node running an older bundle of a package
 * opens it at the frontend THAT bundle names (Calimero Desktop loads exactly
 * the installed `links.frontend`), while the registry already declares the
 * newer one. mero-chat moving from mero-chat-pwa.vercel.app to
 * chat.hyperfeed.me refused every desktop login with "Login callback
 * destination is not allowed" until the node's own install counted.
 */
describe('resolveTrustedCallbackUrl (frontends installed on this node)', () => {
  const REGISTRY = 'https://apps.calimero.network';
  const OLD = 'https://mero-chat-pwa.vercel.app';
  const NEW = 'https://chat.hyperfeed.me';

  const bytes = (value: unknown) => Array.from(new TextEncoder().encode(JSON.stringify(value)));

  function serveInstalled(apps: unknown[], status = 200) {
    server.use(
      http.get('*/admin-api/applications', ({ request }) => {
        if (request.headers.get('Authorization') !== 'Bearer session-token') {
          return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
        return HttpResponse.json({ data: { apps } }, { status });
      }),
    );
  }

  function serveRegistryFrontend(pkg: string, frontend: string) {
    server.use(
      http.get(`${REGISTRY}/api/v2/bundles`, () =>
        HttpResponse.json([
          { version: '1.0', package: pkg, appVersion: '2.0.0', wasm: { hash: 'sha256:abc' }, links: { frontend } },
        ]),
      ),
    );
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('package-name', 'com.calimero.chat');
    localStorage.setItem('calimero_access_token', 'session-token');
    localStorage.setItem('calimero_refresh_token', 'session-refresh');
  });

  it('trusts the frontend the installed bundle names when the registry has moved on', async () => {
    serveInstalled([
      { id: 'app-1', package: 'com.calimero.chat', metadata: bytes({ links: { frontend: `${OLD}/` } }) },
    ]);
    serveRegistryFrontend('com.calimero.chat', NEW);

    const url = await resolveTrustedCallbackUrl(`${OLD}/?_cb=1`);
    expect(url?.origin).toBe(OLD);
  });

  it('trusts Hyperfeed at the frontend its installed bundle names, and still grants it full access', async () => {
    // Hyperfeed moved from hyperfeed-two.vercel.app to hyperfeed.me the same way.
    sessionStorage.setItem('package-name', 'com.calimero.hyperfeed');
    const callback = 'https://hyperfeed-two.vercel.app/?_cb=1';
    serveInstalled([
      {
        id: 'hyperfeed',
        package: 'com.calimero.hyperfeed',
        metadata: bytes({ links: { frontend: 'https://hyperfeed-two.vercel.app' } }),
      },
    ]);
    serveRegistryFrontend('com.calimero.hyperfeed', 'https://hyperfeed.me');

    expect((await resolveTrustedCallbackUrl(callback))?.origin).toBe('https://hyperfeed-two.vercel.app');
    expect(permissionsForPackage('multi-context', [], 'com.calimero.hyperfeed', callback)).toEqual(['admin']);
  });

  it('does not trust a frontend installed under a different package', async () => {
    serveInstalled([
      { id: 'app-2', package: 'com.evil.app', metadata: bytes({ links: { frontend: 'https://evil-installed.example' } }) },
    ]);
    serveRegistryFrontend('com.calimero.chat', NEW);

    expect(await resolveTrustedCallbackUrl('https://evil-installed.example/cb')).toBeNull();
  });

  it('does not look at the node without a session', async () => {
    localStorage.clear();
    serveInstalled([
      { id: 'app-3', package: 'com.calimero.chat', metadata: bytes({ links: { frontend: 'https://no-session.example' } }) },
    ]);
    serveRegistryFrontend('com.calimero.chat', NEW);

    expect(await resolveTrustedCallbackUrl('https://no-session.example/cb')).toBeNull();
  });

  it('fails closed when the node refuses the list', async () => {
    serveInstalled([], 403);
    serveRegistryFrontend('com.calimero.chat', NEW);

    expect(await resolveTrustedCallbackUrl('https://refused.example/cb')).toBeNull();
  });
});

/**
 * `frontendAliases`: the other URLs a bundle says its frontend is served at.
 * An app that moved domain lists its old one, so a login from wherever it is
 * still opened there keeps working, from the registry's latest bundle and
 * from the one a node has installed alike. Never anything not listed.
 */
describe('resolveTrustedCallbackUrl (frontend aliases)', () => {
  const REGISTRY = 'https://apps.calimero.network';
  const bytes = (value: unknown) => Array.from(new TextEncoder().encode(JSON.stringify(value)));

  function serveRegistry(pkg: string, frontend: string, frontendAliases?: unknown) {
    server.use(
      http.get(`${REGISTRY}/api/v2/bundles`, () =>
        HttpResponse.json([
          {
            version: '1.0',
            package: pkg,
            appVersion: '2.0.0',
            wasm: { hash: 'sha256:abc' },
            links: { frontend },
            ...(frontendAliases === undefined ? {} : { frontendAliases }),
          },
        ]),
      ),
    );
  }

  function serveInstalled(apps: unknown[]) {
    server.use(http.get('*/admin-api/applications', () => HttpResponse.json({ data: { apps } })));
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('trusts an alias the registry declares for the flow package', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.alias-a');
    serveRegistry('com.calimero.alias-a', 'https://new-a.example', ['https://old-a.example/']);

    expect((await resolveTrustedCallbackUrl('https://old-a.example/?_cb=1'))?.origin).toBe(
      'https://old-a.example',
    );
  });

  it('refuses an origin the registry lists neither as frontend nor alias', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.alias-b');
    serveRegistry('com.calimero.alias-b', 'https://new-b.example', ['https://old-b.example']);

    expect(await resolveTrustedCallbackUrl('https://evil-b-alias.example/cb')).toBeNull();
  });

  it('ignores aliases that are not a list of http(s) URLs', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.alias-c');
    serveRegistry('com.calimero.alias-c', 'https://new-c.example', 'https://old-c.example');

    expect(await resolveTrustedCallbackUrl('https://old-c.example/cb')).toBeNull();
  });

  it('trusts an alias the installed bundle declares, with the registry saying nothing', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.alias-d');
    localStorage.setItem('calimero_access_token', 'session-token');
    localStorage.setItem('calimero_refresh_token', 'session-refresh');
    serveInstalled([
      {
        id: 'app-d',
        package: 'com.calimero.alias-d',
        metadata: bytes({
          links: { frontend: 'https://new-d.example' },
          frontendAliases: ['https://old-d.example'],
        }),
      },
    ]);
    server.use(http.get(`${REGISTRY}/api/v2/bundles`, () => HttpResponse.json([], { status: 404 })));

    expect((await resolveTrustedCallbackUrl('https://old-d.example/cb'))?.origin).toBe(
      'https://old-d.example',
    );
  });
});

describe('loopback callbacks on a remote node', () => {
  const REGISTRY = 'https://apps.calimero.network';
  let savedLocation: Location;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    savedLocation = window.location;
    delete (window as any).location;
    (window as any).location = {
      search: '',
      pathname: '/auth/',
      hash: '',
      href: 'https://node.example.com/auth/',
      origin: 'https://node.example.com',
    };
  });

  afterEach(() => {
    (window as any).location = savedLocation;
    sessionStorage.clear();
  });

  it('refuses a loopback callback for an admin login', () => {
    sessionStorage.setItem('permissions', 'admin');
    expect(resolveSafeCallbackUrl('http://localhost:8080/')).toBeNull();
  });

  it('refuses a loopback callback for mode=admin', () => {
    sessionStorage.setItem('mode', 'admin');
    expect(resolveSafeCallbackUrl('http://127.0.0.1:3000/')).toBeNull();
  });

  it('refuses a loopback callback when no flow is named (defaults to admin)', () => {
    expect(resolveSafeCallbackUrl('http://evil.localhost/')).toBeNull();
  });

  it('refuses a loopback callback for a package flow', () => {
    sessionStorage.setItem('package-name', 'com.calimero.kvstore');
    sessionStorage.setItem('permissions', 'context:execute');
    expect(resolveSafeCallbackUrl('http://localhost:5173/')).toBeNull();
  });

  it('refuses a loopback callback for an application-id flow', () => {
    sessionStorage.setItem('application-id', 'app-1');
    sessionStorage.setItem('permissions', 'context:execute');
    expect(resolveSafeCallbackUrl('http://localhost:5173/')).toBeNull();
  });

  it('still allows the node origin itself for an admin login', () => {
    sessionStorage.setItem('permissions', 'admin');
    expect(resolveSafeCallbackUrl('https://node.example.com/admin-dashboard/')).not.toBeNull();
  });

  // A bundle names its frontend for every node; seen from a remote node, a
  // loopback origin is whatever listens on the user's own machine.
  const LOOPBACK_FORMS = [
    'http://localhost:5199',
    'http://127.0.0.2:5199',
    'http://127.1:5199',
    'http://0.0.0.0:5199',
    'http://[::ffff:127.0.0.1]:5199',
    'http://localhost.:5199',
  ];

  it.each(LOOPBACK_FORMS)('refuses %s even when the registry declares it', async (frontend) => {
    resetNodeTrustedOrigins();
    sessionStorage.setItem('package-name', 'com.calimero.remote-dev');
    server.use(
      http.get('https://node.example.com/auth/providers', () => HttpResponse.json({ data: {} })),
      http.get(`${REGISTRY}/api/v2/bundles`, () =>
        HttpResponse.json([
          {
            version: '1.0',
            package: 'com.calimero.remote-dev',
            appVersion: '1.0.0',
            wasm: { hash: 'sha256:abc' },
            links: { frontend: `${frontend}/` },
          },
        ]),
      ),
    );

    expect(await resolveTrustedCallbackUrl(`${frontend}/app`)).toBeNull();
  });

  it('refuses a loopback frontend the installed bundle declares', async () => {
    resetNodeTrustedOrigins();
    sessionStorage.setItem('package-name', 'com.calimero.remote-installed');
    localStorage.setItem('calimero_access_token', 'session-token');
    localStorage.setItem('calimero_refresh_token', 'session-refresh');
    const metadata = Array.from(
      new TextEncoder().encode(JSON.stringify({ links: { frontend: 'http://localhost:5198/' } })),
    );
    server.use(
      http.get('https://node.example.com/auth/providers', () => HttpResponse.json({ data: {} })),
      http.get('*/admin-api/applications', () =>
        HttpResponse.json({ data: { apps: [{ package: 'com.calimero.remote-installed', metadata }] } }),
      ),
      http.get(`${REGISTRY}/api/v2/bundles`, () => HttpResponse.json([], { status: 404 })),
    );

    expect(await resolveTrustedCallbackUrl('http://localhost:5198/app')).toBeNull();
  });

  it('still trusts a loopback origin the node operator lists', async () => {
    resetNodeTrustedOrigins();
    server.use(
      http.get('https://node.example.com/auth/providers', () =>
        HttpResponse.json({ data: { trusted_callback_origins: ['http://localhost:5197'] } }),
      ),
    );

    expect((await resolveTrustedCallbackUrl('http://localhost:5197/app'))?.origin).toBe(
      'http://localhost:5197',
    );
  });

  it('ignores a loopback registry-url and consults the default registry', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.remote-reg');
    sessionStorage.setItem('registry-url', 'http://localhost:8082');
    server.use(
      http.get('http://localhost:8082/api/v2/bundles', () =>
        HttpResponse.json([
          {
            version: '1.0',
            package: 'com.calimero.remote-reg',
            appVersion: '1.0.0',
            wasm: { hash: 'sha256:abc' },
            links: { frontend: 'https://other-f.example' },
          },
        ]),
      ),
      http.get(`${REGISTRY}/api/v2/bundles`, () =>
        HttpResponse.json([
          {
            version: '1.0',
            package: 'com.calimero.remote-reg',
            appVersion: '1.0.0',
            wasm: { hash: 'sha256:abc' },
            links: { frontend: 'https://real-f.example' },
          },
        ]),
      ),
    );

    expect(await resolveTrustedCallbackUrl('https://other-f.example/cb')).toBeNull();
    expect((await resolveTrustedCallbackUrl('https://real-f.example/cb'))?.origin).toBe(
      'https://real-f.example',
    );
  });
});

describe('origins the node itself trusts (trusted_callback_origins)', () => {
  const PREVIEW = 'https://mero-crm-git-feature-calimero-network.vercel.app';

  function serveNodeOrigins(origins: unknown, status = 200) {
    server.use(
      http.get(`${window.location.origin}/auth/providers`, () =>
        HttpResponse.json(
          { data: { providers: [], count: 0, trusted_callback_origins: origins } },
          { status },
        ),
      ),
    );
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    resetNodeTrustedOrigins();
  });

  // The reported bug: a Vercel preview of an app is not the registry-declared
  // frontend, so its login was refused with no way for the node's owner to
  // allow it.
  it('trusts a preview origin the node lists', async () => {
    serveNodeOrigins([PREVIEW]);
    const url = await resolveTrustedCallbackUrl(`${PREVIEW}/login`);
    expect(url?.origin).toBe(PREVIEW);
  });

  it('still refuses an origin the node does not list', async () => {
    serveNodeOrigins([PREVIEW]);
    expect(await resolveTrustedCallbackUrl('https://evil.example/cb')).toBeNull();
  });

  it('trusts nothing extra when the node has no list (an older node)', async () => {
    server.use(
      http.get(`${window.location.origin}/auth/providers`, () =>
        HttpResponse.json({ data: { providers: [], count: 0 } }),
      ),
    );
    expect(await resolveTrustedCallbackUrl(`${PREVIEW}/login`)).toBeNull();
  });

  it('fails closed when the node read fails', async () => {
    serveNodeOrigins([PREVIEW], 500);
    expect(await resolveTrustedCallbackUrl(`${PREVIEW}/login`)).toBeNull();
  });

  it('reads the list from this page\'s own origin, not from a URL parameter', async () => {
    // A link cannot point the check at a node that "lists" the attacker.
    sessionStorage.setItem('app-url', 'https://evil-node.example');
    server.use(
      http.get('https://evil-node.example/auth/providers', () =>
        HttpResponse.json({ data: { trusted_callback_origins: ['https://evil.example'] } }),
      ),
    );
    serveNodeOrigins([]);
    expect(await resolveTrustedCallbackUrl('https://evil.example/cb')).toBeNull();
  });

  it('the redirect hands the tokens to a node-listed origin', async () => {
    serveNodeOrigins([PREVIEW]);
    let href = window.location.href;
    const real = Object.getOwnPropertyDescriptor(window.location, 'href');
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      get: () => href,
      set: (v: string) => { href = v; },
    });
    try {
      const result = await redirectTokensToCallback(`${PREVIEW}/login`, {
        access_token: 'AT',
        refresh_token: 'RT',
      });
      expect(result).toBe('ok');
      expect(href.startsWith(`${PREVIEW}/login#`)).toBe(true);
    } finally {
      if (real) Object.defineProperty(window.location, 'href', real);
    }
  });
});

describe('parseOriginList', () => {
  it('keeps exact http(s) origins and drops everything else', () => {
    expect([
      ...parseOriginList([
        'https://a.example',
        'https://b.example/',
        ' http://localhost:5173 ',
        'https://c.example/path',
        'javascript:alert(1)',
        '*.vercel.app',
        'https://*.vercel.app',
        42,
        null,
      ]),
    ]).toEqual(['https://a.example', 'https://b.example', 'http://localhost:5173']);
  });

  it('is empty for anything that is not a list', () => {
    expect(parseOriginList(undefined).size).toBe(0);
    expect(parseOriginList('https://a.example').size).toBe(0);
  });
});
