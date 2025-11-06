/**
 * MSW Request Handlers for mocking all auth-frontend API calls
 */

import { http, HttpResponse, delay } from 'msw';
import { fixtures } from './fixtures';

// Base URL - matches the auth endpoint
const BASE_URL = 'http://node1.127.0.0.1.nip.io';

// Dynamic scenario state - can be updated by tests
let currentScenario: {
  applicationInstalled: boolean;
  contextsExist: boolean;
  networkDelay: number;
  forceErrors: string[];
} = {
  applicationInstalled: false,
  contextsExist: false,
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
 * Reset scenario to default state
 */
export const resetScenario = () => {
  currentScenario = {
    applicationInstalled: false,
    contextsExist: false,
    networkDelay: 0,
    forceErrors: [],
  };
};

export const handlers = [
  // ========================================
  // Auth API Endpoints
  // ========================================
  
  /**
   * GET /auth/providers - List available authentication providers
   */
  http.get(`${BASE_URL}/auth/providers`, async () => {
    await delay(currentScenario.networkDelay);
    
    if (currentScenario.forceErrors.includes('providers')) {
      return HttpResponse.json(
        { error: 'Failed to load providers' }, 
        { status: 500 }
      );
    }
    
    return HttpResponse.json({ 
      providers: fixtures.providers.all, 
      count: fixtures.providers.all.length 
    });
  }),
  
  /**
   * POST /auth/refresh - Refresh access token
   */
  http.post(`${BASE_URL}/auth/refresh`, async ({ request }) => {
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
    return HttpResponse.json(fixtures.tokens.user);
  }),
  
  /**
   * POST /auth/token - Request new token (username/password or NEAR)
   */
  http.post(`${BASE_URL}/auth/token`, async ({ request }) => {
    await delay(currentScenario.networkDelay);
    
    const body = await request.json() as any;
    
    if (currentScenario.forceErrors.includes('unauthorized')) {
      return HttpResponse.json(
        { error: 'Authentication failed' }, 
        { status: 401 }
      );
    }
    
    if (body.auth_method === 'username_password') {
      // Validate credentials
      const { username, password } = body.provider_data || {};
      if (username === 'admin' && password === 'admin') {
        return HttpResponse.json(fixtures.tokens.admin);
      }
      return HttpResponse.json(
        { error: 'Invalid credentials' }, 
        { status: 401 }
      );
    }
    
    if (body.auth_method === 'near_wallet') {
      return HttpResponse.json(fixtures.tokens.user);
    }
    
    return HttpResponse.json(
      { error: 'Unsupported auth method' }, 
      { status: 400 }
    );
  }),
  
  /**
   * GET /auth/challenge - Get challenge for NEAR wallet auth
   */
  http.get(`${BASE_URL}/auth/challenge`, async () => {
    await delay(currentScenario.networkDelay);
    return HttpResponse.json(fixtures.challenges.near);
  }),
  
  /**
   * POST /auth/generate-client-key - Generate scoped token
   */
  http.post(`${BASE_URL}/auth/generate-client-key`, async ({ request }) => {
    await delay(currentScenario.networkDelay);
    
    const body = await request.json() as any;
    
    if (!body.permissions || body.permissions.length === 0) {
      return HttpResponse.json(
        { error: 'No permissions specified' }, 
        { status: 400 }
      );
    }
    
    // Generate scoped tokens
    return HttpResponse.json({
      access_token: `scoped_access_${Date.now()}_${body.permissions[0]}`,
      refresh_token: `scoped_refresh_${Date.now()}`,
    });
  }),
  
  // ========================================
  // Admin API Endpoints
  // ========================================
  
  /**
   * GET /admin-api/packages/:packageId/latest - Get latest package version
   */
  http.get(`${BASE_URL}/admin-api/packages/:packageId/latest`, async ({ params }) => {
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
        application_id: fixtures.applications.meropass.application_id,
        version: fixtures.applications.meropass.version,
        package: fixtures.applications.meropass.package,
      });
    }
    
    if (packageId === 'network.calimero.newapp') {
      return HttpResponse.json({
        application_id: fixtures.applications.newApp.application_id,
        version: fixtures.applications.newApp.version,
        package: fixtures.applications.newApp.package,
      });
    }
    
    return HttpResponse.json(
      { error: 'Package not found' }, 
      { status: 404 }
    );
  }),
  
  /**
   * POST /admin-api/applications/install - Install application
   */
  http.post(`${BASE_URL}/admin-api/applications/install`, async ({ request }) => {
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
      application_id: appId,
      installed: true,
      package: body.package,
      version: body.version,
    });
  }),
  
  /**
   * GET /admin-api/applications/:appId/contexts - Get contexts for application
   */
  http.get(`${BASE_URL}/admin-api/applications/:appId/contexts`, async ({ params }) => {
    await delay(currentScenario.networkDelay);
    
    const appId = params.appId as string;
    
    if (appId === fixtures.applications.meropass.application_id && currentScenario.contextsExist) {
      return HttpResponse.json({
        contexts: fixtures.contexts.meropassContexts,
      });
    }
    
    return HttpResponse.json({ contexts: [] });
  }),
  
  /**
   * GET /admin-api/applications/:appId - Get installed application details
   */
  http.get(`${BASE_URL}/admin-api/applications/:appId`, async ({ params }) => {
    await delay(currentScenario.networkDelay);
    
    const appId = params.appId as string;
    
    if (currentScenario.applicationInstalled) {
      if (appId === fixtures.applications.meropass.application_id) {
        return HttpResponse.json(fixtures.applications.meropass);
      }
      
      if (appId === fixtures.applications.legacyApp.application_id) {
        return HttpResponse.json(fixtures.applications.legacyApp);
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
  http.get(`${BASE_URL}/admin-api/contexts`, async () => {
    await delay(currentScenario.networkDelay);
    
    if (currentScenario.contextsExist) {
      return HttpResponse.json(fixtures.contexts.meropassContexts);
    }
    
    return HttpResponse.json([]);
  }),
  
  /**
   * GET /admin-api/contexts/:contextId/identities - Get identities for context
   */
  http.get(`${BASE_URL}/admin-api/contexts/:contextId/identities`, async ({ params }) => {
    await delay(currentScenario.networkDelay);
    
    const contextId = params.contextId as string;
    
    const identities = fixtures.identities[contextId as keyof typeof fixtures.identities];
    if (identities) {
      return HttpResponse.json(identities);
    }
    
    return HttpResponse.json([]);
  }),
  
  /**
   * POST /admin-api/contexts - Create new context
   */
  http.post(`${BASE_URL}/admin-api/contexts`, async ({ request }) => {
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
      contextId: `context_new_${Date.now()}`,
      memberPublicKey: `ed25519:NewContext_${Date.now()}`,
      protocol: body.protocol || 'near',
      applicationId: body.application_id,
    });
  }),
];

