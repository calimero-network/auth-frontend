const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const APP_ID_BYTES = 32;
const HEX_ID = /^[0-9a-f]{64}$/;

/** Length of an app origin's first label: base32 of 32 bytes, unpadded. */
export const APP_LABEL_LENGTH = 52;

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** The application id when it is canonical hex (64 lowercase chars, as core renders every id), else null. */
export const applicationIdHex = (id: string | null | undefined): string | null =>
  id && HEX_ID.test(id) ? id : null;

/** The 32 bytes (as hex) behind an app-origin label (canonical lowercase base32), or null. */
export const labelHex = (label: string): string | null => {
  if (label.length !== APP_LABEL_LENGTH) return null;
  let bits = '';
  for (const c of label) {
    const v = BASE32.indexOf(c);
    if (v < 0) return null;
    bits += v.toString(2).padStart(5, '0');
  }
  const padding = bits.slice(APP_ID_BYTES * 8);
  if (/1/.test(padding)) return null;
  const bytes = Uint8Array.from({ length: APP_ID_BYTES }, (_, i) =>
    parseInt(bits.slice(i * 8, i * 8 + 8), 2),
  );
  return bytesToHex(bytes);
};
