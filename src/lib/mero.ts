/**
 * Shared MeroJs instance for auth-frontend
 *
 * Token ownership: MeroJs owns the live token bundle. It is handed a
 * TokenStore backed by the app's own localStorage keys
 * (calimero_access_token, calimero_refresh_token), so every rotation MeroJs
 * performs lands in the keys the rest of the app reads.
 *
 * This is load-bearing since calimero-network/core#3083: refresh tokens are
 * SINGLE-USE. Every POST /auth/refresh consumes the token it is given and
 * returns a new one; re-presenting a consumed token is treated as theft and
 * the node revokes the whole family. So the rotated refresh token must be
 * persisted, and nothing may ever write a stale one back over it.
 */

import { HTTPError, MeroJs } from '@calimero-network/mero-js';
import type { TokenData, TokenStore } from '@calimero-network/mero-js';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'calimero_access_token',
  REFRESH_TOKEN: 'calimero_refresh_token',
  APP_ENDPOINT: 'calimero_app_endpoint',
  AUTH_ENDPOINT: 'calimero_auth_endpoint',
} as const;

let meroInstance: MeroJs | null = null;

/** Read `exp` (seconds) out of a JWT; fall back to an hour from now. */
function expiresAtFromJwt(token: string): number {
  try {
    let b64 = token.split('.')[1];
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64));
    if (typeof payload.exp === 'number') return payload.exp * 1000;
  } catch {
    /* not a JWT — use the fallback */
  }
  return Date.now() + 3_600_000;
}

/**
 * TokenStore over the app's existing localStorage keys.
 *
 * mero-js ships a LocalStorageTokenStore, but it keeps the bundle as one JSON
 * blob under `mero-tokens`. Adopting it would orphan every session already
 * stored under calimero_access_token/calimero_refresh_token — and those keys
 * are read all over the app (ManifestProcessor, useContextSelection,
 * generateClientKeyDirect below). Keeping the keys means MeroJs's rotations
 * are visible to every one of those readers for free.
 */
const tokenStore: TokenStore = {
  getTokens(): TokenData | null {
    const access_token = getAccessToken();
    const refresh_token = getRefreshToken();
    if (!access_token || !refresh_token) return null;

    return {
      access_token,
      refresh_token,
      expires_at: expiresAtFromJwt(access_token),
    };
  },
  setTokens(data: TokenData): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
  },
  clear(): void {
    clearAccessToken();
    clearRefreshToken();
  },
};

export function getMero(): MeroJs {
  const baseUrl = getAppEndpointKey() || window.location.origin;

  if (!meroInstance) {
    // MeroJs seeds itself from tokenStore.getTokens() in its constructor, and
    // writes every rotation back through tokenStore.setTokens(). Constructing
    // it without a store is what stranded rotated refresh tokens in memory
    // while localStorage kept serving the consumed one to the next reload.
    meroInstance = new MeroJs({ baseUrl, tokenStore });
  }

  return meroInstance;
}

export function resetMero(): void {
  meroInstance = null;
}

// ---- Token helpers ----

/**
 * Hand a freshly minted bundle to MeroJs, which persists it through the token
 * store. Always set both halves at once: writing an access token while leaving
 * a stale refresh token behind is what gets the family revoked.
 */
export function setTokens(tokens: { access_token: string; refresh_token: string }): void {
  getMero().setTokenData({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAtFromJwt(tokens.access_token),
  });
}

/** Drop the session: MeroJs's in-memory bundle and both localStorage keys. */
export function clearTokens(): void {
  meroInstance?.clearToken();
  clearAccessToken();
  clearRefreshToken();
}

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function clearAccessToken(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

// ---- Session ----

/** `x-auth-error` values that mean the token family is gone for good. */
const REVOKED_AUTH_ERRORS = ['token_reuse', 'token_revoked'];

/**
 * The node revoked this token family — a retry can never succeed, only a fresh
 * login.
 *
 * TODO: mero-js#67 adds a terminal `AuthRevokedError` of its own. The app is
 * on mero-js 1.x, which does not carry it yet; once the dependency range picks
 * up a release with it, drop this class and the header sniffing below.
 */
export class AuthRevokedError extends Error {
  constructor(message = 'Your session was revoked. Please sign in again.') {
    super(message);
    this.name = 'AuthRevokedError';
  }
}

/**
 * Has the node revoked this token family?
 *
 * core#3083 answers a replayed (already consumed) refresh token with 401
 * `x-auth-error: token_reuse` and kills the family; anything presented
 * afterwards comes back as `token_revoked`. Neither is retryable, so callers
 * must clear the tokens and go back to the provider screen rather than loop.
 */
export function isAuthRevoked(err: unknown): boolean {
  if (err instanceof AuthRevokedError) return true;

  if (err instanceof HTTPError && (err.status === 401 || err.status === 403)) {
    const authError = err.headers?.get('x-auth-error');
    if (authError && REVOKED_AUTH_ERRORS.includes(authError)) return true;
  }

  // mero-js 1.x rewraps some transport failures into a plain Error that keeps
  // only the message, so sniff that too.
  const message = err instanceof Error ? err.message : '';
  return REVOKED_AUTH_ERRORS.some((code) => message.includes(code));
}

/**
 * Is the stored session still good?
 *
 * Read-only: /auth/validate is a public route on the node that does nothing
 * but verify the bearer token (core pins it as permission-free in
 * `crates/auth/tests/client_token_contract.rs`). It consumes nothing — unlike
 * the POST /auth/refresh this used to probe with, which now burns a
 * single-use refresh token on every mount.
 */
export async function hasLiveSession(): Promise<boolean> {
  const accessToken = getAccessToken();
  if (!accessToken || !getRefreshToken()) return false;

  const mero = getMero();
  const { valid } = await mero.auth.validateToken(accessToken);
  if (valid) return true;

  // A 401 `token_expired` here makes mero-js refresh under the hood (rotating
  // and persisting a fresh bundle), but it then retries with the access token
  // we pinned into the Authorization header — the stale one — and so reports
  // the session dead even though the refresh worked. If the bundle rotated
  // underneath us, re-check with the token we now hold.
  const rotated = getAccessToken();
  if (rotated && rotated !== accessToken) {
    const retry = await mero.auth.validateToken(rotated);
    return retry.valid;
  }

  return false;
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
  // Safe to read straight from storage: the token store above keeps this key in
  // step with the bundle MeroJs holds, rotations included.
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
    // This fetch bypasses the SDK, so nothing else translates the node's
    // revocation headers for us: a dead family must surface as terminal, or
    // the flow offers a Retry button that can never succeed.
    const authError = response.headers.get('x-auth-error');
    if (authError && REVOKED_AUTH_ERRORS.includes(authError)) {
      clearTokens();
      throw new AuthRevokedError();
    }

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
