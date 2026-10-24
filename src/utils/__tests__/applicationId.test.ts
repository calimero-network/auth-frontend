import { describe, it, expect } from 'vitest';
import { applicationIdHex } from '../applicationId';
import { idBytes, toHex } from './appIds';

describe('applicationIdHex', () => {
  const id = toHex(idBytes(1));

  it('returns a canonical 64-char lowercase hex id unchanged', () => {
    expect(applicationIdHex(id)).toBe(id);
  });

  it('accepts an id whose leading bytes are zero', () => {
    const bytes = idBytes(1);
    bytes[0] = 0;
    expect(applicationIdHex(toHex(bytes))).toMatch(/^00[0-9a-f]{62}$/);
  });

  it('refuses uppercase, wrong-length and non-hex values', () => {
    expect(applicationIdHex(id.toUpperCase())).toBeNull();
    expect(applicationIdHex(id.slice(1))).toBeNull();
    expect(applicationIdHex(id + '0')).toBeNull();
    expect(applicationIdHex('g' + id.slice(1))).toBeNull();
    expect(applicationIdHex(`0x${id}`)).toBeNull();
  });

  it('refuses a base58 id, which no node renders any more', () => {
    expect(applicationIdHex('7NZUz6J9FnGhRcFzqMaUsMv1Qwv3mWqj7jJ1kP4yX2aB')).toBeNull();
  });

  it('refuses a missing value', () => {
    expect(applicationIdHex(null)).toBeNull();
    expect(applicationIdHex(undefined)).toBeNull();
    expect(applicationIdHex('')).toBeNull();
  });
});
