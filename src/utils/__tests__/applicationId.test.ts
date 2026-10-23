import { describe, it, expect } from 'vitest';
import { applicationIdHex } from '../applicationId';
import { idBytes, toBase58 } from './appIds';

describe('applicationIdHex', () => {
  const id = toBase58(idBytes(1));

  it('decodes a canonical id', () => {
    expect(applicationIdHex(id)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts a canonical id whose first byte is zero (leading 1)', () => {
    const bytes = idBytes(1);
    bytes[0] = 0;
    expect(applicationIdHex('1' + toBase58(bytes))).toMatch(/^00[0-9a-f]{62}$/);
  });

  it('refuses a non-canonical encoding with extra leading 1s', () => {
    expect(applicationIdHex('1' + id)).toBeNull();
  });

  it('refuses a missing or non-base58 value', () => {
    expect(applicationIdHex(null)).toBeNull();
    expect(applicationIdHex('0OIl')).toBeNull();
  });
});
