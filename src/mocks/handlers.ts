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
 * Reset scenario to default state (dev-friendly defaults)
 */
export const resetScenario = () => {
  currentScenario = {
    applicationInstalled: true,   // Dev default: apps installed
    contextsExist: true,            // Dev default: contexts exist
    networkDelay: 0,
    forceErrors: [],
  };
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

const installApplicationHandler = http.post(`*/admin-api/install-application`, async ({ request }) => {
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
});

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
   * POST /auth/refresh - Refresh access token
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
    
    // Return refreshed tokens
    return HttpResponse.json({ data: fixtures.tokens.user });
  }),
  
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
    
    if (body.auth_method === 'near_wallet') {
      return HttpResponse.json({ data: fixtures.tokens.user });
    }
    
    return HttpResponse.json(
      { error: 'Unsupported auth method' }, 
      { status: 400 }
    );
  }),
  
  /**
   * GET /auth/challenge - Get challenge for NEAR wallet auth
   */
  http.get(`*/auth/challenge`, async () => {
    await delay(currentScenario.networkDelay);
    return HttpResponse.json({ data: fixtures.challenges.near });
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
  http.post(`*/admin-api/applications/install`, async (request) => {
    return installApplicationHandler.resolver(request);
  }),
  
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

