import { describe, it, expect } from 'vitest';
import { resolveSafeCallbackUrl } from '../callbackUrl';

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
