/**
 * Regression pins for single-use refresh tokens (calimero-network/core#3083).
 *
 * Every POST /auth/refresh consumes the refresh token it is given and returns
 * a new one. Re-presenting a consumed token is treated as theft: the node
 * revokes the whole family and answers 401 `x-auth-error: token_reuse`.
 *
 * So the rotated token MUST be persisted where the next page load reads it.
 * Until this PR the MeroJs instance was built with no tokenStore, which makes
 * mero-js's `tokenStore?.setTokens(...)` a no-op: the rotated token lived only
 * in memory while localStorage kept the consumed one, and the next reload
 * replayed it — killing the session.
 *
 * The MSW mock models the rotation and the reuse trap (src/mocks/handlers.ts),
 * so these tests fail against the old lib/mero.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HTTPError } from '@calimero-network/mero-js';
import { server } from '../../../vitest.setup';
import { fixtures } from '../../mocks/fixtures';
import {
  AuthRevokedError,
  clearTokens,
  generateClientKeyDirect,
  getAccessToken,
  getMero,
  getRefreshToken,
  hasLiveSession,
  isAuthRevoked,
  resetMero,
  setAppEndpointKey,
  setTokens,
} from '../mero';

const NODE_URL = 'http://node1.127.0.0.1.nip.io';

const ACCESS_KEY = 'calimero_access_token';
const REFRESH_KEY = 'calimero_refresh_token';

/** Seed a session the way a previous page load would have left it. */
const seedStoredSession = (tokens: { access_token: string; refresh_token: string }) => {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
};

/** A fresh page load: the module-level MeroJs instance is gone, storage isn't. */
const reload = () => resetMero();

/** The access token has aged out; the refresh token has not. */
const expireStoredAccessToken = (label = 'stale_access_token') =>
  localStorage.setItem(ACCESS_KEY, label);

describe('lib/mero token handling (core#3083 single-use refresh)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMero();
    setAppEndpointKey(NODE_URL);
  });

  afterEach(() => {
    server.events.removeAllListeners();
  });

  describe('token store', () => {
    it('seeds MeroJs from the app storage keys on construction', () => {
      seedStoredSession(fixtures.tokens.admin);

      expect(getMero().getTokenData()).toMatchObject({
        access_token: fixtures.tokens.admin.access_token,
        refresh_token: fixtures.tokens.admin.refresh_token,
      });
    });

    it('persists a bundle handed to setTokens under the app storage keys', () => {
      setTokens({ access_token: 'fresh_access', refresh_token: 'fresh_refresh' });

      expect(localStorage.getItem(ACCESS_KEY)).toBe('fresh_access');
      expect(localStorage.getItem(REFRESH_KEY)).toBe('fresh_refresh');
      expect(getMero().getTokenData()).toMatchObject({ refresh_token: 'fresh_refresh' });
    });

    it('clearTokens drops both the in-memory bundle and storage', () => {
      setTokens({ access_token: 'fresh_access', refresh_token: 'fresh_refresh' });

      clearTokens();

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(getMero().isAuthenticated()).toBe(false);
    });
  });

  describe('rotation', () => {
    it('persists the refresh token mero-js rotates to, not the consumed one', async () => {
      seedStoredSession(fixtures.tokens.admin);
      expireStoredAccessToken();

      // mero-js refreshes on the 401 `token_expired` and stores the new bundle.
      await expect(hasLiveSession()).resolves.toBe(true);

      expect(getRefreshToken()).not.toBe(fixtures.tokens.admin.refresh_token);
      expect(getRefreshToken()).toBe('rotated_refresh_token_1');
      expect(getAccessToken()).toBe('rotated_access_token_1');
    });

    it('does not replay a consumed refresh token after a reload', async () => {
      seedStoredSession(fixtures.tokens.admin);
      expireStoredAccessToken();

      await expect(hasLiveSession()).resolves.toBe(true);
      const rotated = getRefreshToken();

      // The page reloads and the access token ages out again. The new MeroJs
      // seeds itself from storage: if storage still held the CONSUMED refresh
      // token, this second refresh would be a replay — 401 token_reuse, family
      // revoked, hard logout.
      reload();
      expireStoredAccessToken('stale_access_token_2');

      await expect(hasLiveSession()).resolves.toBe(true);
      expect(getRefreshToken()).toBe('rotated_refresh_token_2');
      expect(getRefreshToken()).not.toBe(rotated);
    });
  });

  describe('hasLiveSession', () => {
    it('is false with no stored tokens', async () => {
      await expect(hasLiveSession()).resolves.toBe(false);
    });

    it('is true for a live access token, without spending a refresh token', async () => {
      seedStoredSession(fixtures.tokens.admin);

      const refreshCalls: string[] = [];
      server.events.on('request:start', ({ request }) => {
        if (request.url.includes('/auth/refresh')) refreshCalls.push(request.url);
      });

      await expect(hasLiveSession()).resolves.toBe(true);

      // The old probe POSTed /auth/refresh on every mount, burning a
      // single-use refresh token each time.
      expect(refreshCalls).toEqual([]);
      expect(getRefreshToken()).toBe(fixtures.tokens.admin.refresh_token);
    });

    it('refreshes and stays live when only the access token is stale', async () => {
      seedStoredSession(fixtures.tokens.admin);
      expireStoredAccessToken();

      await expect(hasLiveSession()).resolves.toBe(true);
      expect(getAccessToken()).toBe('rotated_access_token_1');
    });

    it('is false once the family is revoked by a replay', async () => {
      seedStoredSession(fixtures.tokens.admin);
      expireStoredAccessToken();
      await expect(hasLiveSession()).resolves.toBe(true);

      // What a client with no persistence does on the next load: present the
      // consumed refresh token again. The node reads it as theft.
      reload();
      seedStoredSession(fixtures.tokens.admin);
      expireStoredAccessToken('stale_access_token_3');

      await expect(hasLiveSession()).resolves.toBe(false);
    });
  });

  describe('isAuthRevoked', () => {
    const httpError = (status: number, authError: string) =>
      new HTTPError(
        status,
        'Unauthorized',
        `${NODE_URL}/auth/refresh`,
        new Headers({ 'x-auth-error': authError }),
      );

    it.each(['token_reuse', 'token_revoked'])(
      'recognises a 401 carrying x-auth-error: %s',
      (code) => {
        expect(isAuthRevoked(httpError(401, code))).toBe(true);
      },
    );

    it('recognises a 403 token_revoked', () => {
      expect(isAuthRevoked(httpError(403, 'token_revoked'))).toBe(true);
    });

    it('recognises its own AuthRevokedError', () => {
      expect(isAuthRevoked(new AuthRevokedError())).toBe(true);
    });

    it('leaves ordinary failures alone', () => {
      expect(isAuthRevoked(httpError(401, 'token_expired'))).toBe(false);
      expect(isAuthRevoked(new Error('Network request failed'))).toBe(false);
    });
  });

  describe('generateClientKeyDirect', () => {
    it('surfaces a revoked family as terminal and drops the session', async () => {
      seedStoredSession(fixtures.tokens.admin);

      server.use(
        http.post('*/admin/client-key', () =>
          HttpResponse.json(
            { error: 'Refresh token reuse detected' },
            { status: 401, headers: { 'x-auth-error': 'token_reuse' } },
          ),
        ),
      );

      await expect(
        generateClientKeyDirect({ context_id: '', context_identity: '', permissions: ['admin'] }),
      ).rejects.toBeInstanceOf(AuthRevokedError);

      // Nothing left for a Retry button to loop on.
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('leaves ordinary failures as plain errors, session intact', async () => {
      seedStoredSession(fixtures.tokens.admin);

      await expect(
        generateClientKeyDirect({ context_id: '', context_identity: '', permissions: [] }),
      ).rejects.not.toBeInstanceOf(AuthRevokedError);

      expect(getAccessToken()).toBe(fixtures.tokens.admin.access_token);
    });
  });
});
