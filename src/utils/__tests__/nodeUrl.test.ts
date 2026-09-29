/**
 * `app-url` decides where the login password and the admin token pair go.
 * These pin that an attacker-chosen value can never become the endpoint.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../lib/mero', () => ({
  setAppEndpointKey: vi.fn(),
  setAuthEndpointURL: vi.fn(),
  clearAppEndpoint: vi.fn(),
  clearAccessToken: vi.fn(),
}));

import { setAppEndpointKey, setAuthEndpointURL } from '../../lib/mero';
import { handleUrlParams } from '../urlParams';
import { resolveTrustedNodeUrl } from '../nodeUrl';

const ORIGIN = 'https://node.example.com';

const setLocation = (search: string) => {
  delete (window as any).location;
  (window as any).location = {
    search,
    pathname: '/auth/',
    hash: '',
    href: `${ORIGIN}/auth/${search}`,
    origin: ORIGIN,
  };
};

describe('resolveTrustedNodeUrl', () => {
  beforeEach(() => setLocation(''));
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the page origin', () => {
    expect(resolveTrustedNodeUrl(ORIGIN)).toBe(ORIGIN);
  });

  it('accepts loopback nodes (desktop, local dev)', () => {
    expect(resolveTrustedNodeUrl('http://localhost:2528')).toBe('http://localhost:2528');
    expect(resolveTrustedNodeUrl('http://127.0.0.1:4081')).toBe('http://127.0.0.1:4081');
    expect(resolveTrustedNodeUrl('http://node1.localhost')).toBe('http://node1.localhost');
  });

  it('rejects a foreign origin', () => {
    expect(resolveTrustedNodeUrl('https://evil.example')).toBeNull();
  });

  it('rejects look-alike hosts', () => {
    expect(resolveTrustedNodeUrl('https://node.example.com.evil.example')).toBeNull();
    expect(resolveTrustedNodeUrl('https://localhost.evil.example')).toBeNull();
    expect(resolveTrustedNodeUrl('https://node.example.com@evil.example')).toBeNull();
  });

  it('rejects non-http schemes and garbage', () => {
    expect(resolveTrustedNodeUrl('javascript:alert(1)')).toBeNull();
    expect(resolveTrustedNodeUrl('file:///etc/passwd')).toBeNull();
    expect(resolveTrustedNodeUrl('not a url')).toBeNull();
    expect(resolveTrustedNodeUrl('')).toBeNull();
    expect(resolveTrustedNodeUrl(null)).toBeNull();
  });

  it('accepts origins allowlisted via VITE_ALLOWED_NODE_ORIGINS', () => {
    vi.stubEnv('VITE_ALLOWED_NODE_ORIGINS', 'https://a.example, https://b.example');
    expect(resolveTrustedNodeUrl('https://b.example/some/path')).toBe('https://b.example/some/path');
    expect(resolveTrustedNodeUrl('https://c.example')).toBeNull();
  });
});

describe('handleUrlParams endpoint gating', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(setAppEndpointKey).mockClear();
    vi.mocked(setAuthEndpointURL).mockClear();
  });

  it('never points the endpoint at an untrusted app-url', () => {
    setLocation('?permissions=admin&callback-url=http%3A%2F%2Flocalhost%3A5173&app-url=https%3A%2F%2Fevil.example');
    handleUrlParams();

    const calls = vi.mocked(setAppEndpointKey).mock.calls.map(([url]) => url);
    expect(calls).not.toContain('https://evil.example');
    expect(calls.at(-1)).toBe(ORIGIN);
  });

  it('never points the endpoint at an untrusted auth-url', () => {
    setLocation('?auth-url=https%3A%2F%2Fevil.example');
    handleUrlParams();

    const calls = vi.mocked(setAuthEndpointURL).mock.calls.map(([url]) => url);
    expect(calls).not.toContain('https://evil.example');
    expect(calls.at(-1)).toBe(ORIGIN);
  });

  it('ignores an untrusted app-url smuggled in via calimero-auth-params', () => {
    setLocation('');
    sessionStorage.setItem('calimero-auth-params', JSON.stringify({ 'app-url': 'https://evil.example' }));
    handleUrlParams();

    const calls = vi.mocked(setAppEndpointKey).mock.calls.map(([url]) => url);
    expect(calls).not.toContain('https://evil.example');
  });

  it('keeps a trusted loopback app-url', () => {
    setLocation('?app-url=http%3A%2F%2Flocalhost%3A2528');
    handleUrlParams();

    expect(vi.mocked(setAppEndpointKey).mock.calls.at(-1)?.[0]).toBe('http://localhost:2528');
  });
});
