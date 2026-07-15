/**
 * MSW Request Handlers for mocking all auth-frontend API calls
 */

import { http, HttpResponse, delay } from 'msw';
import { fixtures } from './fixtures';

// Base URL - matches the auth endpoint
// In dev mode, use relative paths; in production it would be the node URL
const BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:5176'  // Dev mode: local vite server
  : 'http://node1.127.0.0.1.nip.io';  // Production: node endpoint

// Dynamic scenario state - can be updated by tests
let currentScenario: {
  applicationInstalled: boolean;
  contextsExist: boolean;
  networkDelay: number;
  forceErrors: string[];
} = {
  applicationInstalled: true,   // Default: apps are installed (for dev testing)
  contextsExist: true,            // Default: contexts exist (for dev testing)
  networkDelay: 0,
  forceErrors: [],
};

/**
 * Update the mock scenario state
 */
export const updateScenario = (updates: Partial<typeof currentScenario>) => {
  currentScenario = { ...currentScenario, ...updates };
};

/**
 * Refresh-token state machine (calimero-network/core#3083).
 *
 * Refresh tokens are SINGLE-USE: POST /auth/refresh consumes the token it is
 * given and mints a new one. Re-presenting a consumed token is treated as
 * theft — the node revokes the whole family and answers 401 with
 * `x-auth-error: token_reuse`.
 *
 * The mock models this, so a client that persists the rotated token survives
 * and one that replays a consumed token dies here exactly as it would against
 * a real node. A static token pair (what this returned before) is precisely
 * why CI stayed green while the app replayed consumed refresh tokens.
 *
 * One mock session = one token family, so a reuse revokes everything.
 */
let rotations = 0;
let liveAccessTokens = new Set<string>();
let liveRefreshTokens = new Set<string>();
let consumedRefreshTokens = new Set<string>();
let revokedAccessTokens = new Set<string>();

const resetTokenState = () => {
  rotations = 0;
  // The fixture pairs stand in for an existing (logged-in) session.
  liveAccessTokens = new Set([
    fixtures.tokens.admin.access_token,
    fixtures.tokens.user.access_token,
  ]);
  liveRefreshTokens = new Set([
    fixtures.tokens.admin.refresh_token,
    fixtures.tokens.user.refresh_token,
  ]);
  consumedRefreshTokens = new Set();
  revokedAccessTokens = new Set();
};

resetTokenState();

/** Mint a rotated pair and retire the refresh token that bought it. */
const rotateTokens = (presentedRefreshToken: string, presentedAccessToken: string) => {
  rotations += 1;
  const tokens = {
    access_token: `rotated_access_token_${rotations}`,
    refresh_token: `rotated_refresh_token_${rotations}`,
  };

  consumedRefreshTokens.add(presentedRefreshToken);
  liveRefreshTokens.delete(presentedRefreshToken);
  // The access token that was traded in is superseded by the new one.
  liveAccessTokens.delete(presentedAccessToken);

  liveAccessTokens.add(tokens.access_token);
  liveRefreshTokens.add(tokens.refresh_token);

  return tokens;
};

/** Theft detected: the family dies, and everything it minted with it. */
const revokeFamily = () => {
  for (const token of liveAccessTokens) revokedAccessTokens.add(token);
  liveAccessTokens.clear();
  liveRefreshTokens.clear();
};

const bearerToken = (request: Request): string | null =>
  request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? null;

/**
 * Reset scenario to default state (dev-friendly defaults)
 */
export const resetScenario = () => {
  currentScenario = {
    applicationInstalled: true,   // Dev default: apps installed
    contextsExist: true,            // Dev default: contexts exist
    networkDelay: 0,
    forceErrors: [],
  };
  resetTokenState();
};

const generateScopedToken = async (request: Request, statusOnMissingPermissions = 400) => {
  const body = await request.json() as any;
  
  if (!body.permissions || body.permissions.length === 0) {
    return HttpResponse.json(
      { error: 'No permissions specified' }, 
      { status: statusOnMissingPermissions }
    );
  }
  
  return HttpResponse.json({
    data: {
      access_token: `scoped_access_${Date.now()}_${body.permissions[0]}`,
      refresh_token: `scoped_refresh_${Date.now()}`,
    }
  });
};

const installApplicationResolver: Parameters<typeof http.post>[1] = async ({ request }) => {
  await delay(currentScenario.networkDelay + 500); // Simulate installation time
  
  const body = await request.json() as any;
  
  if (currentScenario.forceErrors.includes('install')) {
    return HttpResponse.json(
      { error: 'Installation failed' }, 
      { status: 500 }
    );
  }
  
  // Return installed application ID
  const appId = body.package 
    ? `app_${body.package.split('.').pop()}_${Date.now()}`
    : `app_legacy_${Date.now()}`;
  
  return HttpResponse.json({
    data: {
      applicationId: appId,  // camelCase (httpClient unwraps one level of 'data')
    }
  });
};

const installApplicationHandler = http.post(
  `*/admin-api/install-application`,
  installApplicationResolver,
);

const validateResolver: Parameters<typeof http.get>[1] = async ({ request }) => {
  await delay(currentScenario.networkDelay);

  const token = bearerToken(request);

  if (!token) {
    return new HttpResponse(null, {
      status: 401,
      headers: { 'x-auth-error': 'missing_token' },
    });
  }

  if (revokedAccessTokens.has(token)) {
    return new HttpResponse(null, {
      status: 401,
      headers: { 'x-auth-error': 'token_revoked' },
    });
  }

  if (!liveAccessTokens.has(token)) {
    // Stale access token — the client is expected to refresh and retry.
    return new HttpResponse(null, {
      status: 401,
      headers: { 'x-auth-error': 'token_expired' },
    });
  }

  return new HttpResponse(null, { status: 200 });
};

export const handlers = [
  // ========================================
  // Auth API Endpoints
  // ========================================
  
  /**
   * GET /auth/providers - List available authentication providers
   * Matches both /auth/providers and /providers
   */
  http.get('*/auth/providers', async () => {
    await delay(currentScenario.networkDelay);
    
    if (currentScenario.forceErrors.includes('providers')) {
      return HttpResponse.json(
        { error: 'Failed to load providers' }, 
        { status: 500 }
      );
    }
    
    return HttpResponse.json({ 
      data: {
        providers: fixtures.providers.all, 
        count: fixtures.providers.all.length 
      }
    });
  }),
  
  /**
   * POST /auth/refresh - Rotate the token pair (single-use refresh tokens)
   */
  http.post('*/auth/refresh', async ({ request }) => {
    await delay(currentScenario.networkDelay);

    const body = await request.json() as any;

    if (currentScenario.forceErrors.includes('unauthorized')) {
      return HttpResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    if (!body.access_token || !body.refresh_token) {
      return HttpResponse.json(
        { error: 'Missing tokens' },
        { status: 400 }
      );
    }

    // Replay of an already-consumed refresh token: the node reads this as
    // theft and burns the family down (core#3083).
    if (consumedRefreshTokens.has(body.refresh_token)) {
      revokeFamily();
      return HttpResponse.json(
        { error: 'Refresh token reuse detected' },
        { status: 401, headers: { 'x-auth-error': 'token_reuse' } },
      );
    }

    return HttpResponse.json({
      data: rotateTokens(body.refresh_token, body.access_token),
    });
  }),

  /**
   * HEAD|GET /auth/validate - Read-only session gate.
   *
   * Public route on the node (core pins it as permission-free in
   * `crates/auth/tests/client_token_contract.rs`): it verifies the bearer
   * token and consumes nothing.
   */
  http.head(`*/auth/validate`, validateResolver),
  http.get(`*/auth/validate`, validateResolver),

  /**
   * POST /auth/token - Request new token (username/password or NEAR)
   */
  http.post('*/auth/token', async ({ request }) => {
    await delay(currentScenario.networkDelay);
    
    const body = await request.json() as any;
    
    if (currentScenario.forceErrors.includes('unauthorized')) {
      return HttpResponse.json(
        { error: 'Authentication failed' }, 
        { status: 401 }
      );
    }
    
    if (body.auth_method === 'user_password') {
      // Validate credentials
      const { username, password } = body.provider_data || {};
      if (username === 'admin' && password === 'admin') {
        return HttpResponse.json({ data: fixtures.tokens.admin });
      }
      return HttpResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // No wallet path: it needed GET /auth/challenge, which core#3229 removes.
    return HttpResponse.json(
      { error: 'Unsupported auth method' },
      { status: 400 }
    );
  }),

  /**
   * POST /admin/client-key - Generate scoped token
   */
  http.post(`*/admin/client-key`, async ({ request }) => {
    await delay(currentScenario.networkDelay);
    return generateScopedToken(request);
  }),

  /**
   * POST /auth/generate-client-key - Generate scoped token (new endpoint)
   */
  http.post(`*/auth/generate-client-key`, async ({ request }) => {
    await delay(currentScenario.networkDelay);
    return generateScopedToken(request);
  }),
  
  // ========================================
  // Admin API Endpoints
  // ========================================
  
  /**
   * GET /admin-api/packages/:packageId/latest - Get latest package version
   */
  http.get(`*/admin-api/packages/:packageId/latest`, async ({ params }) => {
    await delay(currentScenario.networkDelay);
    
    const packageId = params.packageId as string;
    
    if (currentScenario.forceErrors.includes('package-not-found')) {
      return HttpResponse.json(
        { error: 'Package not found' }, 
        { status: 404 }
      );
    }
    
    if (packageId === 'network.calimero.meropass') {
      return HttpResponse.json({
        data: {
          application_id: fixtures.applications.meropass.application_id,
          version: fixtures.applications.meropass.version,
          package: fixtures.applications.meropass.package,
        }
      });
    }
    
    if (packageId === 'network.calimero.newapp') {
      return HttpResponse.json({
        data: {
          application_id: fixtures.applications.newApp.application_id,
          version: fixtures.applications.newApp.version,
          package: fixtures.applications.newApp.package,
        }
      });
    }
    
    return HttpResponse.json(
      { error: 'Package not found' }, 
      { status: 404 }
    );
  }),
  
  /**
   * POST /admin-api/install-application - Install application
   */
  installApplicationHandler,

  /**
   * POST /admin-api/applications/install - Legacy install endpoint
   */
  http.post(
    `*/admin-api/applications/install`,
    installApplicationResolver,
  ),
  
  /**
   * GET /admin-api/contexts/for-application/:appId - Get contexts for application
   */
  http.get(`*/admin-api/contexts/for-application/:appId`, async ({ params }) => {
    await delay(currentScenario.networkDelay);
    
    const appId = params.appId as string;
    
    if (appId === fixtures.applications.meropass.application_id && currentScenario.contextsExist) {
      return HttpResponse.json({
        data: {
          contexts: fixtures.contexts.meropassContexts,
        }
      });
    }
    
    return HttpResponse.json({ data: { contexts: [] } });
  }),
  
  /**
   * GET /admin-api/applications/:appId - Get installed application details
   */
  http.get(`*/admin-api/applications/:appId`, async ({ params }) => {
    await delay(currentScenario.networkDelay);
    
    const appId = params.appId as string;
    
    if (currentScenario.applicationInstalled) {
      if (appId === fixtures.applications.meropass.application_id) {
        return HttpResponse.json({ data: fixtures.applications.meropass });
      }
      
      if (appId === fixtures.applications.legacyApp.application_id) {
        return HttpResponse.json({ data: fixtures.applications.legacyApp });
      }
    }
    
    return HttpResponse.json(
      { error: 'Application not found' }, 
      { status: 404 }
    );
  }),
  
  /**
   * GET /admin-api/contexts - List all contexts
   */
  http.get(`*/admin-api/contexts`, async () => {
    await delay(currentScenario.networkDelay);
    
    if (currentScenario.contextsExist) {
      return HttpResponse.json({ 
        data: { 
          contexts: fixtures.contexts.meropassContexts 
        } 
      });
    }
    
    return HttpResponse.json({ data: { contexts: [] } });
  }),
  
  /**
   * GET /admin-api/contexts/:contextId/identities-owned - Get identities for context
   */
  http.get(`*/admin-api/contexts/:contextId/identities-owned`, async ({ params }) => {
    await delay(currentScenario.networkDelay);
    
    const contextId = params.contextId as string;
    
    const identities = fixtures.identities[contextId as keyof typeof fixtures.identities];
    if (identities) {
      return HttpResponse.json({ 
        data: { 
          identities: identities.map(id => id.publicKey) 
        } 
      });
    }
    
    return HttpResponse.json({ data: { identities: [] } });
  }),
  
  /**
   * POST /admin-api/contexts - Create new context
   */
  http.post(`*/admin-api/contexts`, async ({ request }) => {
    await delay(currentScenario.networkDelay + 300);
    
    const body = await request.json() as any;
    
    if (currentScenario.forceErrors.includes('context-creation')) {
      return HttpResponse.json(
        { error: 'Failed to create context' }, 
        { status: 500 }
      );
    }
    
    // Return created context
    return HttpResponse.json({
      data: {
        contextId: `context_new_${Date.now()}`,
        memberPublicKey: `ed25519:NewContext_${Date.now()}`,
        protocol: body.protocol || 'near',
        applicationId: body.application_id,
      }
    });
  }),
];

