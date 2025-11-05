import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the SDK functions that cause import issues
vi.mock('@calimero-network/calimero-client', () => ({
  setAppEndpointKey: vi.fn(),
  setAuthEndpointURL: vi.fn(),
  clearAppEndpoint: vi.fn(),
  clearAccessToken: vi.fn(),
}));

import { getStoredUrlParam, handleUrlParams } from '../urlParams';

describe('urlParams', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Mock window.location
    delete (window as any).location;
    (window as any).location = {
      search: '',
      pathname: '/auth/login',
      hash: '',
      href: 'http://localhost/auth/login'
    };
    window.history.replaceState = vi.fn();
  });

  describe('getStoredUrlParam', () => {
    it('should return null for non-existent key', () => {
      expect(getStoredUrlParam('non-existent')).toBeNull();
    });

    it('should handle plain string values (new format)', () => {
      sessionStorage.setItem('package-name', 'network.calimero.meropass');
      expect(getStoredUrlParam('package-name')).toBe('network.calimero.meropass');
    });

    it('should handle JSON-encoded string values (old format from localStorage)', () => {
      localStorage.setItem('package-name', '"network.calimero.meropass"');
      expect(getStoredUrlParam('package-name')).toBe('network.calimero.meropass');
    });

    it('should handle double-encoded JSON (legacy bug)', () => {
      localStorage.setItem('package-name', '"\\"network.calimero.meropass\\""');
      const result = getStoredUrlParam('package-name');
      // After first parse: "network.calimero.meropass"
      expect(result).toBe('"network.calimero.meropass"');
    });

    it('should handle mode values', () => {
      // New format (sessionStorage)
      sessionStorage.setItem('mode', 'single-context');
      expect(getStoredUrlParam('mode')).toBe('single-context');
      
      // Old format (localStorage fallback)
      sessionStorage.clear();
      localStorage.setItem('mode', '"multi-context"');
      expect(getStoredUrlParam('mode')).toBe('multi-context');
    });

    it('should handle registry URLs', () => {
      sessionStorage.setItem('registry-url', 'http://localhost:8082');
      expect(getStoredUrlParam('registry-url')).toBe('http://localhost:8082');
      
      sessionStorage.clear();
      localStorage.setItem('registry-url', '"http://localhost:8082"');
      expect(getStoredUrlParam('registry-url')).toBe('http://localhost:8082');
    });

    it('should handle permissions', () => {
      sessionStorage.setItem('permissions', 'context:create,context:list,context:execute');
      expect(getStoredUrlParam('permissions')).toBe('context:create,context:list,context:execute');
      
      sessionStorage.clear();
      localStorage.setItem('permissions', '"context:create,context:list,context:execute"');
      expect(getStoredUrlParam('permissions')).toBe('context:create,context:list,context:execute');
    });

    it('should not crash on malformed JSON', () => {
      localStorage.setItem('bad-key', '"{invalid json}');
      // Should return the raw value if JSON.parse fails
      expect(getStoredUrlParam('bad-key')).toBe('"{invalid json}');
    });
  });

  describe('handleUrlParams', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should store URL params in sessionStorage as plain strings', () => {
      (window as any).location.search = '?package-name=network.calimero.meropass&mode=single-context&callback-url=http://localhost:5173/';
      
      handleUrlParams();
      
      expect(sessionStorage.getItem('package-name')).toBe('network.calimero.meropass');
      expect(sessionStorage.getItem('mode')).toBe('single-context');
      expect(sessionStorage.getItem('callback-url')).toBe('http://localhost:5173/');
    });

    it('should handle all package flow parameters', () => {
      (window as any).location.search = '?package-name=network.calimero.meropass&package-version=1.0.0&registry-url=http://localhost:8082&mode=multi-context&permissions=context:create,context:list,context:execute&callback-url=http://localhost:5173/';
      
      handleUrlParams();
      
      expect(sessionStorage.getItem('package-name')).toBe('network.calimero.meropass');
      expect(sessionStorage.getItem('package-version')).toBe('1.0.0');
      expect(sessionStorage.getItem('registry-url')).toBe('http://localhost:8082');
      expect(sessionStorage.getItem('mode')).toBe('multi-context');
      expect(sessionStorage.getItem('permissions')).toBe('context:create,context:list,context:execute');
      expect(sessionStorage.getItem('callback-url')).toBe('http://localhost:5173/');
    });

    it('should handle application-id flow parameters', () => {
      (window as any).location.search = '?application-id=abc123&application-path=/app&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/';
      
      handleUrlParams();
      
      expect(sessionStorage.getItem('application-id')).toBe('abc123');
      expect(sessionStorage.getItem('application-path')).toBe('/app');
      expect(sessionStorage.getItem('mode')).toBe('single-context');
    });

    it('should handle URL-encoded values', () => {
      (window as any).location.search = '?callback-url=http%3A%2F%2Flocalhost%3A5173%2F&permissions=context%3Acreate%2Ccontext%3Alist';
      
      handleUrlParams();
      
      expect(sessionStorage.getItem('callback-url')).toBe('http://localhost:5173/');
      expect(sessionStorage.getItem('permissions')).toBe('context:create,context:list');
    });

    it('should not store values with JSON.stringify', () => {
      (window as any).location.search = '?package-name=network.calimero.meropass';
      
      handleUrlParams();
      
      const stored = sessionStorage.getItem('package-name');
      expect(stored).toBe('network.calimero.meropass');
      expect(stored).not.toBe('"network.calimero.meropass"');
      expect(stored?.startsWith('"')).toBe(false);
    });

    it('should merge sessionStorage params when URL is empty', () => {
      sessionStorage.setItem(
        'calimero-auth-params',
        JSON.stringify({
          'package-name': 'network.calimero.session',
          mode: 'multi-context',
          permissions: 'context:create',
          'callback-url': 'http://localhost:5173/',
        }),
      );

      (window as any).location.search = '';

      handleUrlParams();

      expect(sessionStorage.getItem('package-name')).toBe('network.calimero.session');
      expect(sessionStorage.getItem('mode')).toBe('multi-context');
      expect(sessionStorage.getItem('permissions')).toBe('context:create');
      expect(sessionStorage.getItem('callback-url')).toBe('http://localhost:5173/');
    });
  });

  describe('flow conflict handling', () => {
    it('package-name params should not be JSON-encoded', () => {
      (window as any).location.search = '?package-name=network.calimero.test&mode=single-context';
      
      handleUrlParams();
      
      const packageName = getStoredUrlParam('package-name');
      expect(packageName).toBe('network.calimero.test');
      expect(packageName).not.toContain('"');
    });

    it('mode should be stored without quotes', () => {
      (window as any).location.search = '?mode=multi-context';
      
      handleUrlParams();
      
      const mode = getStoredUrlParam('mode');
      expect(mode).toBe('multi-context');
      expect(mode).not.toBe('"multi-context"');
    });

    it('should handle transition from old to new format', () => {
      // Simulate old format in localStorage
      localStorage.setItem('package-name', '"network.calimero.old"');
      localStorage.setItem('mode', '"single-context"');
      
      // Verify old format is read correctly
      expect(getStoredUrlParam('package-name')).toBe('network.calimero.old');
      expect(getStoredUrlParam('mode')).toBe('single-context');
      
      // Now store new values in new format (sessionStorage)
      (window as any).location.search = '?package-name=network.calimero.new&mode=multi-context';
      handleUrlParams();
      
      // Verify new format is stored in sessionStorage and read correctly
      expect(sessionStorage.getItem('package-name')).toBe('network.calimero.new');
      expect(getStoredUrlParam('package-name')).toBe('network.calimero.new');
      expect(getStoredUrlParam('mode')).toBe('multi-context');
    });
  });
});

