// A session's id is a 5-character code such as 7KQ2M, short enough to read
// out and type. The alphabet is Crockford's base32: digits and uppercase
// letters without I, L, O and U.
export const SESSION_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const SESSION_CODE_LENGTH = 5
const SESSION_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{5}$/

// A random code for a new session. Each byte picks one of the 32 characters
// (256 is a multiple of 32, so none is likelier than another).
export function randomSessionCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SESSION_CODE_LENGTH))

  return Array.from(
    bytes,
    byte => SESSION_CODE_ALPHABET[byte % SESSION_CODE_ALPHABET.length],
  ).join('')
}

// A code as someone typed it, read the way the backend reads it: any case,
// with O as 0 and I and L as 1. Null if it isn't a code.
export function normalizeSessionCode(input: string): string | null {
  const code = input
    .trim()
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')

  return SESSION_CODE_PATTERN.test(code) ? code : null
}
