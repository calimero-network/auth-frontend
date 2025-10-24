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
  searchParams.forEach((value, key) => {
    params[key] = value;
    console.log(`DEBUG handleUrlParams: Processing key=${key}, value=${value}`);

    // Use SDK storage functions for SDK-related keys to ensure proper prefixing
    if (key === 'app-url') {
      setAppEndpointKey(value);
    } else if (key === 'auth-url') {
      setAuthEndpointURL(value);
    } else {
      // For other keys, use regular localStorage (these are auth-frontend specific)
      localStorage.setItem(key, JSON.stringify(value));
      console.log(`DEBUG handleUrlParams: Stored ${key} = ${JSON.stringify(value)} in localStorage`);
    }
  });
  
  // Clear URL parameters without reloading the page
  if (searchParams.toString()) {
    const newUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', newUrl);
  }
  
  return params;
};

export const getStoredUrlParam = (key: string): string | null => {
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
    'registry-url',
    'isWhitelist'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
}; 