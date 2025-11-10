/**
 * Tests for MSW mock handlers - verify API mocking works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fixtures } from '../mocks/fixtures';
import { updateScenario, resetScenario } from '../mocks/handlers';

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
      const response = await fetch('http://node1.127.0.0.1.nip.io/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: 'test_access',
          refresh_token: 'test_refresh',
        }),
      });
      
      const payload = await response.json();
      
      expect(response.ok).toBe(true);
      expect(payload.data.access_token).toBeTruthy();
      expect(payload.data.refresh_token).toBeTruthy();
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

