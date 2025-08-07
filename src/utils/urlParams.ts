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
  
  // Set auth-url if not provided (auth frontend should know its own URL)
  if (!searchParams.has('auth-url')) {
    setAuthEndpointURL(window.location.origin);
  }
  
  // Convert URLSearchParams to a plain object and store in localStorage
  searchParams.forEach((value, key) => {
    params[key] = value;

    // Use SDK storage functions for SDK-related keys to ensure proper prefixing
    if (key === 'app-url') {
      setAppEndpointKey(value);
    } else if (key === 'auth-url') {
      setAuthEndpointURL(value);
    } else {
      // For other keys, use regular localStorage (these are auth-frontend specific)
      localStorage.setItem(key, JSON.stringify(value));
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
  // Clear SDK-related storage using SDK functions
  clearAppEndpoint();
  clearAccessToken(); // This also clears refresh token
  
  // Clear auth-frontend specific keys (non-SDK keys)
  const keysToRemove = [
    'callback-url',
    'permissions', 
    'application-id',
    'application-path',
    'isWhitelist'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
}; 