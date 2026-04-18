/**
 * Crypto-strong base32-readable password generator.
 *
 * Alphabet: 32 chars from A-Z 2-9 with confusable chars excluded
 *   - 0/O dropped (visually identical)
 *   - 1/I/L dropped (visually identical)
 *
 * Uses crypto.getRandomValues + rejection sampling — no Math.random,
 * no modulo bias.
 */

// 31 chars total (23 letters + 8 digits) after dropping I/L/O/0/1
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generatePassword(length = 6): string {
  if (length < 1) throw new Error('length must be ≥ 1')
  const N = ALPHABET.length // 31
  const maxValid = 256 - (256 % N) // 248 — reject bytes ≥ 248 to eliminate modulo bias
  const out: string[] = []
  const buf = new Uint8Array(length * 4) // oversample to limit re-fills
  while (out.length < length) {
    crypto.getRandomValues(buf)
    for (let i = 0; i < buf.length && out.length < length; i++) {
      if (buf[i] < maxValid) out.push(ALPHABET[buf[i] % N])
    }
  }
  return out.join('')
}
