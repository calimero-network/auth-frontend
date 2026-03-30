/**
 * Shared MeroJs instance for auth-frontend
 *
 * Token management: the auth-frontend manages tokens in its own localStorage
 * keys (calimero_access_token, calimero_refresh_token). The MeroJs instance
 * reads tokens on-demand via getAuthToken — no tokenStore, no double-storage.
 */

import { MeroJs } from '@calimero-network/mero-js';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'calimero_access_token',
  REFRESH_TOKEN: 'calimero_refresh_token',
  APP_ENDPOINT: 'calimero_app_endpoint',
  AUTH_ENDPOINT: 'calimero_auth_endpoint',
} as const;

let meroInstance: MeroJs | null = null;

export function getMero(): MeroJs {
  const baseUrl = getAppEndpointKey() || window.location.origin;

  if (!meroInstance) {
    meroInstance = new MeroJs({ baseUrl });

    // Seed with existing tokens if available
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    if (accessToken && refreshToken) {
      let expiresAt = Date.now() + 3_600_000;
      try {
        let b64 = accessToken.split('.')[1];
        b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const payload = JSON.parse(atob(b64));
        if (payload.exp) expiresAt = payload.exp * 1000;
      } catch { /* use default */ }
      meroInstance.setTokenData({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      });
    }
  }

  return meroInstance;
}

export function resetMero(): void {
  meroInstance = null;
}

// ---- Token helpers ----

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  if (meroInstance) {
    let expiresAt = Date.now() + 3_600_000;
    try {
      let b64 = token.split('.')[1];
      b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const payload = JSON.parse(atob(b64));
      if (payload.exp) expiresAt = payload.exp * 1000;
    } catch { /* use default */ }
    meroInstance.setTokenData({
      access_token: token,
      refresh_token: getRefreshToken() || '',
      expires_at: expiresAt,
    });
  }
}

export function clearAccessToken(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

// ---- Endpoint helpers ----

export function getAppEndpointKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.APP_ENDPOINT);
}

export function setAppEndpointKey(url: string): void {
  const current = localStorage.getItem(STORAGE_KEYS.APP_ENDPOINT);
  localStorage.setItem(STORAGE_KEYS.APP_ENDPOINT, url);
  if (current !== url) resetMero();
}

export function getAuthEndpointURL(): string | null {
  return localStorage.getItem(STORAGE_KEYS.AUTH_ENDPOINT);
}

export function setAuthEndpointURL(url: string): void {
  localStorage.setItem(STORAGE_KEYS.AUTH_ENDPOINT, url);
  resetMero();
}

export function clearAppEndpoint(): void {
  localStorage.removeItem(STORAGE_KEYS.APP_ENDPOINT);
  resetMero();
}

// ---- Client key (direct fetch, bypasses SDK) ----

export interface GenerateClientKeyRequest {
  context_id: string;
  context_identity: string;
  permissions: string[];
}

export interface GenerateClientKeyResponse {
  access_token: string;
  refresh_token: string;
  [key: string]: unknown;
}

export async function generateClientKeyDirect(
  request: GenerateClientKeyRequest,
): Promise<GenerateClientKeyResponse> {
  const baseUrl = (getAppEndpointKey() || window.location.origin).replace(/\/$/, '');
  const token = getAccessToken();

  const response = await fetch(`${baseUrl}/admin/client-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message = json?.error?.message ?? json?.error ?? json?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return json?.data ?? json;
}

export function extractTokens(response: any): { access_token: string; refresh_token: string } | null {
  const data = response?.data ?? response;
  if (data?.access_token && data?.refresh_token) {
    return { access_token: data.access_token, refresh_token: data.refresh_token };
  }
  return null;
}
