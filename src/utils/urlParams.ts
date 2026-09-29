import { 
  setAppEndpointKey, 
  setAuthEndpointURL,
  clearAppEndpoint, 
  clearAccessToken 
} from '../lib/mero';
import { isAllowedNodeUrl } from './nodeUrl';

const NODE_URL_PARAMS = ['app-url', 'auth-url']; // kept by the SDK endpoint setters, not as flow params

/** The first node URL in the page's query string that this page may not talk to. */
export const findRejectedNodeUrl = (): string | null => {
  const searchParams = new URLSearchParams(window.location.search);
  for (const key of NODE_URL_PARAMS) {
    const value = searchParams.get(key);
    if (value !== null && !isAllowedNodeUrl(value)) return value;
  }
  return null;
};

export const handleUrlParams = () => {
  // Get URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const params: Record<string, string> = {};
  
  // Clear flow params from localStorage (old sessions) to prevent pollution
  // SessionStorage already handles per-tab isolation
  const modeFromUrl = searchParams.get('mode');
  if (modeFromUrl === 'admin' || searchParams.get('permissions') === 'admin') {
    localStorage.removeItem('package-name');
    localStorage.removeItem('package-version');
    localStorage.removeItem('registry-url');
    localStorage.removeItem('application-id');
    localStorage.removeItem('application-path');
    localStorage.removeItem('installed-application-id');
  } else if (searchParams.has('package-name')) {
    localStorage.removeItem('application-id');
    localStorage.removeItem('application-path');
    localStorage.removeItem('installed-application-id');
  } else if (searchParams.has('application-id')) {
    localStorage.removeItem('package-name');
    localStorage.removeItem('package-version');
    localStorage.removeItem('registry-url');
  }
  
  // Read sessionStorage params from CalimeroProvider (client-side SDK)
  let sessionParams: Record<string, string> = {};
  try {
    const rawSessionParams = sessionStorage.getItem('calimero-auth-params');
    if (rawSessionParams) {
      const parsed = JSON.parse(rawSessionParams) as Record<string, string | null | number | undefined>;
      Object.entries(parsed).forEach(([key, value]) => {
        if (value === null || typeof value === 'undefined') return;
        sessionParams[key] = String(value);
      });
      // Clear after reading to avoid reuse
      sessionStorage.removeItem('calimero-auth-params');
    }
  } catch (err) {
    console.warn('Failed to parse session auth params', err);
  }
  
  // Merge URL params with session params (URL takes precedence)
  Object.entries(sessionParams).forEach(([key, value]) => {
    if (!searchParams.has(key)) {
      searchParams.set(key, value);
    }
  });
  
  // A rejected node URL falls back to this page's own node, never to the value.
  const nodeUrl = (key: string) => {
    const value = searchParams.get(key);
    return value && isAllowedNodeUrl(value) ? value : window.location.origin;
  };
  setAuthEndpointURL(nodeUrl('auth-url'));
  setAppEndpointKey(nodeUrl('app-url'));
  
  // Convert URLSearchParams to a plain object and store in localStorage
  // EXCEPT transient params that should always come from URL
  // Note: We need to store package params temporarily to survive OAuth redirects
  // They will be cleared at the end via clearStoredUrlParams()
  searchParams.forEach((value, key) => {
    params[key] = value;

    if (!NODE_URL_PARAMS.includes(key)) {
      // For other keys, use sessionStorage (these are auth-frontend flow params)
      // Store as plain string (no JSON.stringify - value is already a string from URLSearchParams)
      // SessionStorage clears when tab closes, preventing cross-session pollution
      sessionStorage.setItem(key, value);
    }
  });
  
  // DON'T clear URL params - keep them throughout the auth flow
  // This ensures handleUrlParams() always has access to the original params
  // even after page reloads or navigations
  
  return params;
};

export const getStoredUrlParam = (key: string): string | null => {
  // Read from sessionStorage first (new behavior), fall back to localStorage (old sessions)
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = localStorage.getItem(key);
  }
  if (!value) return null;
  
  // Handle both old JSON-encoded format and new plain string format
  // If value starts with a quote, it's likely JSON-encoded
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  
  return value;
};

export const clearStoredUrlParams = () => {
  
  // Clear auth-frontend specific keys (non-SDK keys) from both storages
  const keysToRemove = [
    'callback-url',
    'permissions', 
    'application-id',
    'application-path',
    'manifest-url',
    'isWhitelist',
    'package-name',
    'package-version',
    'registry-url',
    'mode',
    // Legacy first-login setup code: older desktop apps (tauri ≤0.0.68)
    // still pass it in the URL. It is never read anymore (core rc.17+
    // ignores it), but it is credential-shaped — never leave it behind.
    'setup-code'
  ];
  
  keysToRemove.forEach(key => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key); // Clean up old localStorage entries too
  });
}; 