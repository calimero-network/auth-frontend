import { describe, it, expect } from 'vitest';
import { normalizePermissions, restrictToAppPermissions } from '../permissions';
import { trustedRegistryClient } from '../registryClient';

describe('restrictToAppPermissions', () => {
  it('drops admin and the keys family', () => {
    expect(
      restrictToAppPermissions([
        'context:execute',
        'admin',
        'ADMIN',
        'keys',
        'keys:create',
        'keys:permissions:update[k1]',
        'blob',
      ]),
    ).toEqual(['context:execute', 'blob']);
  });

  it('keeps everything mero-react asks for in multi-context mode', () => {
    const multi = [
      'context:create',
      'context:list',
      'context:execute',
      'context:subscribe',
      'application:list',
      'namespace',
      'group',
      'blob',
      'context:alias',
    ];
    // normalizePermissions moves the mode's required grants first; order is irrelevant to core.
    expect([...restrictToAppPermissions(normalizePermissions('multi-context', multi))].sort()).toEqual([...multi].sort());
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

  it('falls back on garbage and non-http schemes', () => {
    const fallback = new URL(import.meta.env.VITE_REGISTRY_URL || DEFAULT).origin;
    expect(base('not a url')).toBe(fallback);
    expect(base('javascript:alert(1)')).toBe(fallback);
    expect(base(null)).toBe(fallback);
  });
});
