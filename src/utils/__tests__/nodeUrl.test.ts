import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { isAllowedNodeUrl } from '../nodeUrl';
import { getAppEndpointKey } from '../../lib/mero';

const servedFrom = (origin: string) => {
  (window as any).location = { ...window.location, origin, href: `${origin}/auth/login` };
};

describe('isAllowedNodeUrl', () => {
  const original = window.location;
  afterEach(() => {
    (window as any).location = original;
  });

  describe('served by a remote node', () => {
    beforeEach(() => servedFrom('https://node.example'));

    it.each([
      'https://node.example',
      'https://node.example/',
      'https://node.example/node-prefix',
    ])('accepts the serving origin %s', (url) => {
      expect(isAllowedNodeUrl(url)).toBe(true);
    });

    it.each([
      'https://evil.example',
      'http://node.example',
      'https://node.example:8443',
      'https://node.example.evil.example',
      'https://node.example@evil.example',
      'http://localhost:2528',
      'http://127.0.0.1:2528',
    ])('rejects the foreign origin %s', (url) => {
      expect(isAllowedNodeUrl(url)).toBe(false);
    });
  });

  describe('served from loopback', () => {
    beforeEach(() => servedFrom('http://localhost:5173'));

    it.each([
      'http://localhost:5173',
      'http://localhost:2528',
      'http://127.0.0.1:2528',
      'http://[::1]:2528',
      'http://node1.localhost:2528',
    ])('accepts the loopback node %s', (url) => {
      expect(isAllowedNodeUrl(url)).toBe(true);
    });

    it.each(['https://evil.example', 'http://127.0.0.1.nip.io:2528'])(
      'rejects the non-loopback origin %s',
      (url) => {
        expect(isAllowedNodeUrl(url)).toBe(false);
      },
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    'ftp://localhost',
    'ws://localhost:2528',
    'not a url',
    '//evil.example',
    '',
  ])('rejects the non-http or malformed value %s', (url) => {
    servedFrom('http://localhost:5173');
    expect(isAllowedNodeUrl(url)).toBe(false);
  });
});

describe('getAppEndpointKey', () => {
  const original = window.location;
  beforeEach(() => {
    localStorage.clear();
    servedFrom('https://node.example');
  });
  afterEach(() => {
    (window as any).location = original;
  });

  it('ignores a stored endpoint that is not the serving node', () => {
    localStorage.setItem('calimero_app_endpoint', 'https://evil.example');
    expect(getAppEndpointKey()).toBeNull();
  });

  it('returns a stored endpoint on the serving node', () => {
    localStorage.setItem('calimero_app_endpoint', 'https://node.example/node-prefix');
    expect(getAppEndpointKey()).toBe('https://node.example/node-prefix');
  });
});
