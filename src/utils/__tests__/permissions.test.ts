import { describe, it, expect } from 'vitest';
import { normalizePermissions, restrictToAppPermissions } from '../permissions';
import { trustedRegistryClient } from '../registryClient';

describe('restrictToAppPermissions', () => {
  it('drops admin in every spelling', () => {
    expect(
      restrictToAppPermissions([
        'context:execute',
        'admin',
        'ADMIN',
        'Admin',
        ' admin ',
        'admin:x',
        'admin:*',
        'admin[x]',
        'admin:x[y]',
      ]),
    ).toEqual(['context:execute']);
  });

  it('drops the keys family in every spelling', () => {
    expect(
      restrictToAppPermissions([
        'context:execute',
        'keys',
        'KEYS',
        'keys:x',
        'keys:create',
        'keys[x]',
        'keys:permissions:update[k1]',
        'keys:clients:delete',
      ]),
    ).toEqual(['context:execute']);
  });

  it('drops broad management scopes', () => {
    expect(
      restrictToAppPermissions([
        'context:execute',
        'context',
        'context[ctx]',
        'context:leave',
        'context:invite',
        'context:capabilities:grant',
        'context:capabilities:revoke',
        'context:application:update',
        'context:execute:x',
        'application',
        'application:install',
        'application:uninstall',
        'package',
        'unknown',
        '',
      ]),
    ).toEqual(['context:execute']);
  });

  it('keeps narrower forms of allowed scopes', () => {
    const narrow = [
      'context:execute[ctx]',
      'context:list-own',
      'blob:get[b1]',
      'blob:add:file',
      'namespace:list',
      'group:manage[g1]',
      'context:alias:lookup',
    ];
    expect(restrictToAppPermissions(narrow)).toEqual(narrow);
  });

  it('keeps everything mero-react asks for in multi-context mode', () => {
    // Verbatim from mero-react getPermissionsForMode(AppMode.MultiContext).
    const multi = [
      'context:create',
      'context:delete',
      'context:list',
      'context:execute',
      'context:subscribe',
      'application:list',
      'namespace',
      'group',
      'blob',
      'context:alias',
    ];
    expect([...restrictToAppPermissions(normalizePermissions('multi-context', multi))].sort()).toEqual([...multi].sort());
  });

  it('keeps everything mero-react asks for in single-context mode', () => {
    const single = [
      'context:execute',
      'context:list',
      'context:subscribe',
      'application:list',
      'blob',
      'context:alias',
    ];
    expect([...restrictToAppPermissions(normalizePermissions('single-context', single))].sort()).toEqual(
      [...single].sort(),
    );
  });

  it('does not touch the admin flow', () => {
    expect(normalizePermissions('admin', ['admin'])).toEqual(['admin']);
  });
});

describe('trustedRegistryClient', () => {
  const DEFAULT = 'https://apps.calimero.network';
  const base = (raw: string | null) => new URL(trustedRegistryClient(raw).getManifestUrl('p')).origin;

  it('falls back to the default registry for a foreign registry-url', () => {
    expect(base('https://evil.example')).toBe(new URL(import.meta.env.VITE_REGISTRY_URL || DEFAULT).origin);
  });

  it('honours a loopback dev registry', () => {
    expect(base('http://localhost:8082')).toBe('http://localhost:8082');
  });

  it('ignores a loopback registry-url when the node is remote', () => {
    const saved = window.location;
    delete (window as any).location;
    (window as any).location = { origin: 'https://node.example.com', href: 'https://node.example.com/auth/' };
    try {
      expect(base('http://localhost:8082')).toBe(new URL(import.meta.env.VITE_REGISTRY_URL || DEFAULT).origin);
    } finally {
      (window as any).location = saved;
    }
  });

  it('falls back on garbage and non-http schemes', () => {
    const fallback = new URL(import.meta.env.VITE_REGISTRY_URL || DEFAULT).origin;
    expect(base('not a url')).toBe(fallback);
    expect(base('javascript:alert(1)')).toBe(fallback);
    expect(base(null)).toBe(fallback);
  });
});
