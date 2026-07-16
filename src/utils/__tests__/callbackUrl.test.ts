import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveSafeCallbackUrl, redirectTokensToCallback } from '../callbackUrl';

describe('resolveSafeCallbackUrl', () => {
  it('rejects a missing / empty callback', () => {
    expect(resolveSafeCallbackUrl(null)).toBeNull();
    expect(resolveSafeCallbackUrl(undefined)).toBeNull();
    expect(resolveSafeCallbackUrl('')).toBeNull();
  });

  it('rejects a malformed URL', () => {
    expect(resolveSafeCallbackUrl('not a url')).toBeNull();
    expect(resolveSafeCallbackUrl('/relative/path')).toBeNull();
  });

  it('rejects non-http(s) schemes (XSS via callback)', () => {
    expect(resolveSafeCallbackUrl('javascript:alert(1)')).toBeNull();
    expect(
      resolveSafeCallbackUrl('data:text/html,<script>alert(1)</script>'),
    ).toBeNull();
    expect(resolveSafeCallbackUrl('file:///etc/passwd')).toBeNull();
  });

  it('rejects an arbitrary foreign origin (the token-exfil case)', () => {
    expect(resolveSafeCallbackUrl('https://evil.example/#')).toBeNull();
    expect(resolveSafeCallbackUrl('http://attacker.test/cb')).toBeNull();
  });

  it('allows loopback on any port and path', () => {
    for (const u of [
      'http://localhost:5173/',
      'http://localhost:2428/auth/callback',
      'http://127.0.0.1:3000/x',
      'http://sub.localhost:9000/y',
    ]) {
      const r = resolveSafeCallbackUrl(u);
      expect(r, u).not.toBeNull();
      expect(r!.toString()).toBe(new URL(u).toString());
    }
  });

  it('allows the auth-frontend own origin (same-origin)', () => {
    const sameOrigin = `${window.location.origin}/callback`;
    expect(resolveSafeCallbackUrl(sameOrigin)).not.toBeNull();
  });

  it('does not treat a look-alike host as loopback', () => {
    // localhost.evil.example must NOT be accepted as loopback.
    expect(resolveSafeCallbackUrl('https://localhost.evil.example/cb')).toBeNull();
    expect(resolveSafeCallbackUrl('https://notlocalhost/cb')).toBeNull();
  });
});

describe('redirectTokensToCallback', () => {
  const tokens = { access_token: 'AT', refresh_token: 'RT' };
  let href: string;
  let realDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    href = window.location.href;
    realDescriptor = Object.getOwnPropertyDescriptor(window.location, 'href');
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      get: () => href,
      set: (v: string) => {
        href = v;
      },
    });
  });

  afterEach(() => {
    if (realDescriptor) {
      Object.defineProperty(window.location, 'href', realDescriptor);
    }
    vi.restoreAllMocks();
  });

  it('returns "missing" and does not navigate when no callback is given', () => {
    const before = window.location.href;
    expect(redirectTokensToCallback(null, tokens)).toBe('missing');
    expect(window.location.href).toBe(before);
  });

  it('returns "untrusted" and does not navigate for a foreign origin', () => {
    const before = window.location.href;
    expect(redirectTokensToCallback('https://evil.example/cb', tokens)).toBe(
      'untrusted',
    );
    // The token pair must never reach an untrusted origin.
    expect(window.location.href).toBe(before);
  });

  it('redirects the token pair in the fragment for a trusted loopback callback', () => {
    const outcome = redirectTokensToCallback(
      'http://localhost:5173/cb',
      tokens,
      { context_id: 'CTX', context_identity: null },
    );
    expect(outcome).toBe('ok');
    expect(window.location.href.startsWith('http://localhost:5173/cb#')).toBe(
      true,
    );
    const params = new URLSearchParams(window.location.href.split('#')[1]);
    expect(params.get('access_token')).toBe('AT');
    expect(params.get('refresh_token')).toBe('RT');
    expect(params.get('context_id')).toBe('CTX');
    // null / empty extras are skipped, not serialized as "null".
    expect(params.has('context_identity')).toBe(false);
    expect(params.get('node_url')).toBeTruthy();
  });
});
