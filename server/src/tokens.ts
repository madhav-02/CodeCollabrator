import { randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Largest multiple of 62 below 256. Bytes at or above this are discarded. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

/**
 * Random string from the system CSPRNG (N5), using rejection sampling so every
 * character is equally likely. A plain `byte % 62` would make the first 8 letters
 * slightly more common, which is exactly the sort of small weakness that makes a
 * token easier to guess than its length suggests.
 */
export function randomToken(length: number): string {
  const out: string[] = [];

  while (out.length < length) {
    for (const byte of randomBytes((length - out.length) * 2)) {
      if (byte >= UNBIASED_LIMIT) continue;
      out.push(ALPHABET[byte % ALPHABET.length]);
      if (out.length === length) break;
    }
  }

  return out.join('');
}

/** Used only for routing, so shorter than a token. */
export const newRoomId = (): string => randomToken(10);
export const newToken = (): string => randomToken(21);

/**
 * Constant-time comparison, so the time taken to reject a wrong token does not
 * reveal how much of it was correct. Unequal lengths return early, which leaks only
 * the length — and token length is fixed and public anyway.
 */
export function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
