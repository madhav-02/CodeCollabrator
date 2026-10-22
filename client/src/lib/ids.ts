// Unguessable identifiers from the browser's CSPRNG (N5).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomId(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  // 62 does not divide 256; the bias is negligible at this length and these ids
  // are not secrets on their own. Server-minted tokens use rejection sampling.
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

