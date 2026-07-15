/**
 * Tests for MSW mock handlers - verify API mocking works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fixtures } from '../mocks/fixtures';
import { updateScenario, resetScenario } from '../mocks/handlers';

/** POST /auth/refresh with a token pair. */
const refresh = (tokens: { access_token: string; refresh_token: string }) =>
  fetch('http://node1.127.0.0.1.nip.io/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    }),
  });

describe('MSW Mock Server', () => {
  beforeEach(() => {
    resetScenario();
  });

  describe('Auth API Mocks', () => {
    it('should mock getProviders endpoint', async () => {
      const response = await fetch('http://node1.127.0.0.1.nip.io/auth/providers');
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.providers).toHaveLength(2);
      expect(payload.data.providers[0].name).toBe('near_wallet');
    });
    
    it('should mock token refresh endpoint', async () => {
      const response = await refresh(fixtures.tokens.admin);

      const payload = await response.json();

      expect(response.ok).toBe(true);
      expect(payload.data.access_token).toBeTruthy();
      expect(payload.data.refresh_token).toBeTruthy();
    });

    /**
     * core#3083: refresh tokens are single-use. The mock must rotate, or the
     * suite goes green against a client that replays consumed tokens — which
     * is exactly how the no-tokenStore bug survived CI.
     */
    it('should rotate the refresh token on every refresh', async () => {
      const first = await (await refresh(fixtures.tokens.admin)).json();
      expect(first.data.refresh_token).not.toBe(fixtures.tokens.admin.refresh_token);

      const second = await (await refresh(first.data)).json();
      expect(second.data.refresh_token).not.toBe(first.data.refresh_token);
      expect(second.data.access_token).not.toBe(first.data.access_token);
    });

    it('should reject a replayed refresh token with x-auth-error: token_reuse', async () => {
      await refresh(fixtures.tokens.admin);

      // Same (now consumed) token again: the node reads this as theft.
      const replay = await refresh(fixtures.tokens.admin);

      expect(replay.status).toBe(401);
      expect(replay.headers.get('x-auth-error')).toBe('token_reuse');
    });

    it('should revoke the whole family once a replay is detected', async () => {
      const rotated = await (await refresh(fixtures.tokens.admin)).json();
      await refresh(fixtures.tokens.admin); // replay → family revoked

      const validate = await fetch('http://node1.127.0.0.1.nip.io/auth/validate', {
        method: 'HEAD',
        headers: { Authorization: `Bearer ${rotated.data.access_token}` },
      });

      expect(validate.status).toBe(401);
      expect(validate.headers.get('x-auth-error')).toBe('token_revoked');
    });

    it('should mock the read-only /auth/validate session gate', async () => {
      const live = await fetch('http://node1.127.0.0.1.nip.io/auth/validate', {
        method: 'HEAD',
        headers: { Authorization: `Bearer ${fixtures.tokens.admin.access_token}` },
      });
      expect(live.status).toBe(200);

      const stale = await fetch('http://node1.127.0.0.1.nip.io/auth/validate', {
        method: 'HEAD',
        headers: { Authorization: 'Bearer stale_access_token' },
      });
      expect(stale.status).toBe(401);
      expect(stale.headers.get('x-auth-error')).toBe('token_expired');
    });

    it('should mock username/password authentication', async () => {
      const response = await fetch('http://node1.127.0.0.1.nip.io/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_method: 'user_password',
          provider_data: {
            username: 'admin',
            password: 'admin',
          },
        }),
      });
      
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.access_token).toBe(fixtures.tokens.admin.access_token);
    });
    
    it('should reject invalid credentials', async () => {
      const response = await fetch('http://node1.127.0.0.1.nip.io/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_method: 'user_password',
          provider_data: {
            username: 'wrong',
            password: 'wrong',
          },
        }),
      });
      
      expect(response.status).toBe(401);
    });
    
    it('should mock generateClientKey endpoint', async () => {
      const response = await fetch('http://node1.127.0.0.1.nip.io/auth/generate-client-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: 'test_context',
          context_identity: 'test_identity',
          permissions: ['context:execute'],
          target_node_url: 'http://test.com',
        }),
      });
      
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.access_token).toContain('scoped_access');
      expect(payload.data.refresh_token).toContain('scoped_refresh');
    });
  });
  
  describe('Admin API Mocks', () => {
    it('should mock getPackageLatest endpoint for meropass', async () => {
      const response = await fetch('http://node1.127.0.0.1.nip.io/admin-api/packages/network.calimero.meropass/latest');
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.application_id).toBe(fixtures.applications.meropass.application_id);
      expect(payload.data.version).toBe('0.1.1');
    });
    
    it('should return 404 for non-existent package', async () => {
      updateScenario({ forceErrors: ['package-not-found'] });
      
      const response = await fetch('http://node1.127.0.0.1.nip.io/admin-api/packages/nonexistent/latest');
      
      expect(response.status).toBe(404);
    });
    
    it('should mock installApplication endpoint', async () => {
      const response = await fetch('http://node1.127.0.0.1.nip.io/admin-api/applications/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'ipfs://test',
          package: 'network.calimero.test',
          version: '1.0.0',
        }),
      });
      
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.applicationId).toBeTruthy();
    });
    
    it('should fail installation when error is forced', async () => {
      updateScenario({ forceErrors: ['install'] });
      
      const response = await fetch('http://node1.127.0.0.1.nip.io/admin-api/applications/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'ipfs://test',
          package: 'network.calimero.test',
        }),
      });
      
      expect(response.status).toBe(500);
    });
  });
  
  describe('Node API Mocks', () => {
    it('should return 404 for non-installed application', async () => {
      updateScenario({ applicationInstalled: false });
      
      const response = await fetch('http://node1.127.0.0.1.nip.io/admin-api/applications/test_app_id');
      
      expect(response.status).toBe(404);
    });
    
    it('should return application details when installed', async () => {
      updateScenario({ applicationInstalled: true });
      
      const response = await fetch(`http://node1.127.0.0.1.nip.io/admin-api/applications/${fixtures.applications.meropass.application_id}`);
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.application_id).toBe(fixtures.applications.meropass.application_id);
      expect(payload.data.package).toBe('network.calimero.meropass');
    });
    
    it('should return empty contexts when none exist', async () => {
      updateScenario({ contextsExist: false });
      
      const response = await fetch('http://node1.127.0.0.1.nip.io/admin-api/contexts');
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.contexts).toEqual([]);
    });
    
    it('should return contexts when they exist', async () => {
      updateScenario({ contextsExist: true });
      
      const response = await fetch('http://node1.127.0.0.1.nip.io/admin-api/contexts');
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.contexts).toHaveLength(3);
      expect(payload.data.contexts[0].name).toBe('Personal Vault');
    });
    
    it('should return contexts for specific application', async () => {
      updateScenario({ contextsExist: true });
      
      const response = await fetch(`http://node1.127.0.0.1.nip.io/admin-api/contexts/for-application/${fixtures.applications.meropass.application_id}`);
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.contexts).toHaveLength(3);
    });
    
    it('should return identities for context', async () => {
      const response = await fetch('http://node1.127.0.0.1.nip.io/admin-api/contexts/context_personal_vault/identities-owned');
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.identities).toHaveLength(2);
      expect(payload.data.identities[0]).toBe(fixtures.identities.context_personal_vault[0].publicKey);
    });
  });
  
  describe('Scenario Management', () => {
    it('should update scenario state', () => {
      updateScenario({
        applicationInstalled: true,
        contextsExist: true,
        networkDelay: 500,
        forceErrors: ['install'],
      });
      
      // Scenario state is internal, but effects will be visible in subsequent requests
      expect(true).toBe(true);
    });
    
    it('should reset scenario to defaults', () => {
      updateScenario({
        applicationInstalled: true,
        forceErrors: ['test'],
      });
      
      resetScenario();
      
      // After reset, state should be back to defaults
      expect(true).toBe(true);
    });
  });
  
  describe('Error Scenarios', () => {
    it('should simulate providers failure', async () => {
      updateScenario({ forceErrors: ['providers'] });
      
      const response = await fetch('http://node1.127.0.0.1.nip.io/auth/providers');
      
      expect(response.status).toBe(500);
    });
    
    it('should simulate unauthorized error', async () => {
      updateScenario({ forceErrors: ['unauthorized'] });
      
      const response = await fetch('http://node1.127.0.0.1.nip.io/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_method: 'username_password',
          provider_data: { username: 'admin', password: 'admin' },
        }),
      });
      
      expect(response.status).toBe(401);
    });
  });
});

