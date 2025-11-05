import { 
  setAppEndpointKey, 
  setAuthEndpointURL,
  clearAppEndpoint, 
  clearAccessToken 
} from '@calimero-network/calimero-client';

export const handleUrlParams = () => {
  // Get URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const params: Record<string, string> = {};
  
  console.log('DEBUG handleUrlParams: window.location.search =', window.location.search);
  console.log('DEBUG handleUrlParams: searchParams =', Array.from(searchParams.entries()));
  
  // Clear conflicting flow params to prevent stale localStorage from previous sessions
  if (searchParams.has('package-name')) {
    // Package flow: clear any old application-id params
    console.log('DEBUG: Package flow detected, clearing old application-id params');
    localStorage.removeItem('application-id');
    localStorage.removeItem('application-path');
  } else if (searchParams.has('application-id')) {
    // Application-ID flow: clear any old package params
    console.log('DEBUG: Application-ID flow detected, clearing old package params');
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
      console.log('DEBUG handleUrlParams: session params =', sessionParams);
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
  
  // Set auth-url if not provided (auth frontend should know its own URL)
  if (!searchParams.has('auth-url')) {
    setAuthEndpointURL(window.location.origin);
  }
  
  // Convert URLSearchParams to a plain object and store in localStorage
  // EXCEPT transient params that should always come from URL
  // Note: We need to store package params temporarily to survive OAuth redirects
  // They will be cleared at the end via clearStoredUrlParams()
  const doNotStore: string[] = [];
  
  searchParams.forEach((value, key) => {
    params[key] = value;
    console.log(`DEBUG handleUrlParams: Processing key=${key}, value=${value}`);

    // Use SDK storage functions for SDK-related keys to ensure proper prefixing
    if (key === 'app-url') {
      setAppEndpointKey(value);
    } else if (key === 'auth-url') {
      setAuthEndpointURL(value);
    } else if (doNotStore.includes(key)) {
      // Skip storing registry-url and other transient params
      console.log(`DEBUG handleUrlParams: Skipping localStorage for ${key} (transient param)`);
    } else {
      // For other keys, use regular localStorage (these are auth-frontend specific)
      // Store as plain string (no JSON.stringify - value is already a string from URLSearchParams)
      localStorage.setItem(key, value);
      console.log(`DEBUG handleUrlParams: Stored ${key} = ${value} in localStorage`);
    }
  });
  
  // DON'T clear URL params - keep them throughout the auth flow
  // This ensures handleUrlParams() always has access to the original params
  // even after page reloads or navigations
  
  return params;
};

export const getStoredUrlParam = (key: string): string | null => {
  const value = localStorage.getItem(key);
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
  
  // Clear auth-frontend specific keys (non-SDK keys)
  const keysToRemove = [
    'callback-url',
    'permissions', 
    'application-id',
    'application-path',
    'manifest-url',
    'isWhitelist',
    'package-name',
    'package-version',
    'registry-url'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
}; 