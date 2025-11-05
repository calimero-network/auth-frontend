import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFlowDetection } from '../useFlowDetection';

// Mock the urlParams module
vi.mock('../../utils/urlParams', () => ({
  getStoredUrlParam: vi.fn((key: string) => {
    // Match real behavior: check sessionStorage first, then localStorage
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  })
}));

describe('useFlowDetection', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).location;
    (window as any).location = {
      search: '',
      pathname: '/auth/login',
      hash: ''
    };
    vi.clearAllMocks();
    // Suppress console.log in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Package Flow Detection', () => {
    it('should detect package flow from URL params', () => {
      (window as any).location.search = '?package-name=network.calimero.meropass&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('package');
      expect(result.current.mode).toBe('multi-context');
      expect(result.current.packageName).toBe('network.calimero.meropass');
    });

    it('should detect single-context package flow', () => {
      (window as any).location.search = '?package-name=network.calimero.app&mode=single-context';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('package');
      expect(result.current.mode).toBe('single-context');
    });

    it('should read package params from sessionStorage if not in URL', () => {
      sessionStorage.setItem('package-name', 'network.calimero.stored');
      sessionStorage.setItem('mode', 'multi-context');
      sessionStorage.setItem('permissions', 'context:create');
      sessionStorage.setItem('callback-url', 'http://localhost:5173/');
      
      (window as any).location.search = '';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('package');
      expect(result.current.packageName).toBe('network.calimero.stored');
      expect(result.current.mode).toBe('multi-context');
    });

    it('should handle package flow with registry URL', () => {
      (window as any).location.search = '?package-name=network.calimero.test&registry-url=http://localhost:8082&mode=single-context';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('package');
      expect(result.current.registryUrl).toBe('http://localhost:8082');
    });
  });

  describe('Application-ID Flow Detection', () => {
    it('should detect application-id flow from sessionStorage', () => {
      sessionStorage.setItem('application-id', 'abc123');
      sessionStorage.setItem('application-path', '/app');
      sessionStorage.setItem('mode', 'single-context');
      sessionStorage.setItem('permissions', 'context:execute');
      sessionStorage.setItem('callback-url', 'http://localhost:5173/');
      
      (window as any).location.search = '';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('application-id');
      expect(result.current.applicationId).toBe('abc123');
      expect(result.current.applicationPath).toBe('/app');
      expect(result.current.mode).toBe('single-context');
    });

    it('should prefer package flow over application-id if package-name exists', () => {
      (window as any).location.search = '?package-name=network.calimero.app';
      sessionStorage.setItem('application-id', 'old123');
      sessionStorage.setItem('mode', 'multi-context');
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('package');
      expect(result.current.packageName).toBe('network.calimero.app');
    });
  });

  describe('Admin Flow Detection', () => {
    it('should detect admin flow from permissions', () => {
      sessionStorage.setItem('permissions', 'admin');
      sessionStorage.setItem('callback-url', 'http://localhost:5173/');
      
      (window as any).location.search = '';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('admin');
      expect(result.current.mode).toBe('admin');
    });

    it('should detect admin flow from mode param', () => {
      sessionStorage.setItem('mode', 'admin');
      sessionStorage.setItem('callback-url', 'http://localhost:5173/');
      
      (window as any).location.search = '';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('admin');
      expect(result.current.mode).toBe('admin');
    });

    it('should prefer admin flow if permissions include admin', () => {
      (window as any).location.search = '?permissions=admin&callback-url=http://localhost:5173/';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('admin');
      expect(result.current.mode).toBe('admin');
    });
  });

  describe('Flow Priority', () => {
    it('should prioritize package-name over everything', () => {
      (window as any).location.search = '?package-name=network.calimero.app&mode=single-context';
      sessionStorage.setItem('application-id', 'old-app');
      sessionStorage.setItem('permissions', 'admin');
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('package');
    });

    it('should prioritize admin over application-id', () => {
      sessionStorage.setItem('permissions', 'admin');
      sessionStorage.setItem('application-id', 'app123');
      sessionStorage.setItem('callback-url', 'http://localhost:5173/');
      
      (window as any).location.search = '';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('admin');
    });

    it('should fallback to admin if no clear indicators', () => {
      sessionStorage.setItem('callback-url', 'http://localhost:5173/');
      
      (window as any).location.search = '';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('admin');
      expect(result.current.mode).toBe('admin');
    });
  });

  describe('Mode Detection', () => {
    it('should use explicit mode param for package flow', () => {
      (window as any).location.search = '?package-name=network.calimero.app&mode=multi-context';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.mode).toBe('multi-context');
    });

    it('should infer single-context from non-application permissions', () => {
      (window as any).location.search = '?package-name=network.calimero.app&permissions=context:execute';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.mode).toBe('single-context');
    });

    it('should always set admin mode for admin flow', () => {
      sessionStorage.setItem('permissions', 'admin');
      sessionStorage.setItem('mode', 'multi-context'); // This should be ignored
      sessionStorage.setItem('callback-url', 'http://localhost:5173/');
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.source).toBe('admin');
      expect(result.current.mode).toBe('admin');
    });
  });

  describe('Conflict Resolution', () => {
    it('should clear application-id params when package-name is in URL', () => {
      sessionStorage.setItem('application-id', 'old-app');
      sessionStorage.setItem('application-path', '/old-path');
      (window as any).location.search = '?package-name=network.calimero.new';
      
      renderHook(() => useFlowDetection());
      
      expect(localStorage.getItem('application-id')).toBeNull();
      expect(localStorage.getItem('application-path')).toBeNull();
    });

    it('should clear package params when application-id is in URL', () => {
      sessionStorage.setItem('package-name', 'network.calimero.old');
      sessionStorage.setItem('registry-url', 'http://old-registry');
      (window as any).location.search = '?application-id=new-app';
      
      renderHook(() => useFlowDetection());
      
      expect(localStorage.getItem('package-name')).toBeNull();
      expect(localStorage.getItem('registry-url')).toBeNull();
    });
  });

  describe('URL and localStorage interaction', () => {
    it('should prefer URL params over localStorage', () => {
      sessionStorage.setItem('package-name', 'network.calimero.old');
      (window as any).location.search = '?package-name=network.calimero.new';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.packageName).toBe('network.calimero.new');
    });

    it('should use localStorage as fallback when URL param is missing', () => {
      sessionStorage.setItem('mode', 'multi-context');
      sessionStorage.setItem('package-name', 'network.calimero.app');
      (window as any).location.search = '?package-name=network.calimero.app';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.mode).toBe('multi-context');
    });
  });

  describe('Extracted Parameters', () => {
    it('should extract all URL parameters correctly', () => {
      (window as any).location.search = '?package-name=network.calimero.app&package-version=1.0.0&registry-url=http://localhost:8082&mode=single-context&permissions=context:create,context:list&callback-url=http://localhost:5173/';
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current).toMatchObject({
        source: 'package',
        mode: 'single-context',
        packageName: 'network.calimero.app',
        packageVersion: '1.0.0',
        registryUrl: 'http://localhost:8082',
        permissions: ['context:create', 'context:list'],
        callbackUrl: 'http://localhost:5173/'
      });
    });

    it('should handle missing optional parameters', () => {
      (window as any).location.search = '?package-name=network.calimero.app&mode=multi-context';
      sessionStorage.setItem('callback-url', 'http://localhost:5173/');
      
      const { result } = renderHook(() => useFlowDetection());
      
      expect(result.current.packageVersion).toBeUndefined();
      expect(result.current.registryUrl).toBeUndefined();
      expect(result.current.applicationId).toBeUndefined();
    });
  });
});

