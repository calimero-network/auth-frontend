/**
 * Shared MeroJs instance for auth-frontend
 * 
 * This module provides a singleton MeroJs client configured with localStorage-based
 * token persistence. It also exports compatibility functions for the old calimero-client
 * API to ease migration.
 */

import { MeroJs, TokenData } from '@calimero-network/mero-js';

// Storage keys (matching the old calimero-client convention)
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'calimero_access_token',
  REFRESH_TOKEN: 'calimero_refresh_token',
  APP_ENDPOINT: 'calimero_app_endpoint',
  AUTH_ENDPOINT: 'calimero_auth_endpoint',
} as const;

// Token storage for localStorage persistence
const tokenStorage = {
  async get(): Promise<TokenData | null> {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    
    if (!accessToken || !refreshToken) {
      return null;
    }
    
    // Extract expiry from JWT
    let expiresAt: number;
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      expiresAt = payload.exp * 1000; // JWT exp is in seconds
    } catch {
      expiresAt = Date.now() + 3600000; // Fallback: 1 hour
    }
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    };
  },
  
  async set(token: TokenData): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token.refresh_token);
  },
  
  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  },
};

// Singleton MeroJs instance
let meroInstance: MeroJs | null = null;

/**
 * Get or create the shared MeroJs instance.
 * Uses the current app endpoint as the base URL.
 */
export function getMero(): MeroJs {
  const baseUrl = getAppEndpointKey() || window.location.origin;
  const authUrl = getAuthEndpointURL() || baseUrl;
  
  // Create new instance if none exists or if endpoint changed
  if (!meroInstance) {
    meroInstance = new MeroJs({
      baseUrl,
      authBaseUrl: authUrl,
      tokenStorage,
    });
    // Initialize from storage (sync call, but MeroJs will handle this)
    meroInstance.init().catch(console.error);
  }
  
  return meroInstance;
}

/**
 * Reset the MeroJs instance (useful when endpoint changes)
 */
export function resetMero(): void {
  meroInstance = null;
}

// ============================================================================
// Compatibility Layer - Functions that mimic the old calimero-client API
// ============================================================================

/**
 * Get the stored access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Set the access token
 */
export function setAccessToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  // Update MeroJs instance if it exists
  if (meroInstance) {
    const refreshToken = getRefreshToken() || '';
    // Extract expiry from JWT
    let expiresAt: number;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      expiresAt = payload.exp * 1000;
    } catch {
      expiresAt = Date.now() + 3600000;
    }
    meroInstance.setToken({ access_token: token, refresh_token: refreshToken, expires_at: expiresAt });
  }
}

/**
 * Clear the access token
 */
export function clearAccessToken(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Get the stored refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Set the refresh token
 */
export function setRefreshToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  // Update MeroJs instance if it exists
  if (meroInstance) {
    const accessToken = getAccessToken() || '';
    // Extract expiry from JWT (from access token)
    let expiresAt: number;
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      expiresAt = payload.exp * 1000;
    } catch {
      expiresAt = Date.now() + 3600000;
    }
    meroInstance.setToken({ access_token: accessToken, refresh_token: token, expires_at: expiresAt });
  }
}

/**
 * Clear the refresh token
 */
export function clearRefreshToken(): void {
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Get the app endpoint URL (node API base URL)
 */
export function getAppEndpointKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.APP_ENDPOINT);
}

/**
 * Set the app endpoint URL
 */
export function setAppEndpointKey(url: string): void {
  localStorage.setItem(STORAGE_KEYS.APP_ENDPOINT, url);
  // Reset MeroJs instance so it picks up the new URL
  resetMero();
}

/**
 * Get the auth endpoint URL
 */
export function getAuthEndpointURL(): string | null {
  return localStorage.getItem(STORAGE_KEYS.AUTH_ENDPOINT);
}

/**
 * Set the auth endpoint URL
 */
export function setAuthEndpointURL(url: string): void {
  localStorage.setItem(STORAGE_KEYS.AUTH_ENDPOINT, url);
  // Reset MeroJs instance so it picks up the new URL
  resetMero();
}

/**
 * Clear the app endpoint
 */
export function clearAppEndpoint(): void {
  localStorage.removeItem(STORAGE_KEYS.APP_ENDPOINT);
  resetMero();
}

// ============================================================================
// Type Re-exports for convenience
// ============================================================================

// Note: Types are imported from the subpath exports of mero-js
// Use: import type { AuthProvider } from '@calimero-network/mero-js/api/auth';
// Use: import type { Context } from '@calimero-network/mero-js/api/admin';
