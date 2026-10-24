const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

export const idBytes = (seed: number) =>
  Uint8Array.from({ length: 32 }, (_, i) => (seed + i * 7) % 256);

export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const toBase32 = (bytes: Uint8Array): string => {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  bits = bits.padEnd(Math.ceil(bits.length / 5) * 5, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
};
