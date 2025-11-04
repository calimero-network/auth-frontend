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
  
  // Set auth-url if not provided (auth frontend should know its own URL)
  if (!searchParams.has('auth-url')) {
    setAuthEndpointURL(window.location.origin);
  }
  
  // Convert URLSearchParams to a plain object and store in localStorage
  // EXCEPT transient params that should always come from URL
  const doNotStore = ['registry-url', 'package-version', 'package-name']; // Never persist these in localStorage
  
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
      localStorage.setItem(key, JSON.stringify(value));
      console.log(`DEBUG handleUrlParams: Stored ${key} = ${JSON.stringify(value)} in localStorage`);
    }
  });
  
  // Preserve transient params in URL (don't clear them)
  // Only clear non-transient params that are now stored in localStorage
  const transientParams = ['registry-url', 'package-version', 'package-name'];
  const preservedParams = new URLSearchParams();
  transientParams.forEach(param => {
    const value = searchParams.get(param);
    if (value) {
      preservedParams.set(param, value);
    }
  });
  
  // Update URL to keep transient params but clear others
  if (searchParams.toString()) {
    const newUrl = window.location.pathname + 
                   (preservedParams.toString() ? '?' + preservedParams.toString() : '') + 
                   window.location.hash;
    window.history.replaceState({}, '', newUrl);
  }
  
  return params;
};

export const getStoredUrlParam = (key: string): string | null => {
  // For transient params, always read from current URL params only (never from localStorage)
  const transientParams = ['registry-url', 'package-version', 'package-name'];
  if (transientParams.includes(key)) {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(key);
  }
  
  const value = localStorage.getItem(key);
  if (value) {
    return JSON.parse(value);
  }
  return null;
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