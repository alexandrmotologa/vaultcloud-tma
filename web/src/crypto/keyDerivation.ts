/**
 * Cryptographic key derivation via PBKDF2 with SHA-256 and 100,000 rounds.
 * Client-side only. Master passphrase never leaves browser memory.
 */

export const PBKDF2_ITERATIONS = 100000;
export const SALT_BYTE_LENGTH = 16;

const getCrypto = (): Crypto => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  return globalThis.crypto;
};

/**
 * Derives a non-extractable 256-bit AES-GCM CryptoKey from a user passphrase and salt.
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Import raw passphrase as PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // Non-extractable for memory safety
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a cryptographically secure random 16-byte salt.
 */
export function generateSalt(): Uint8Array {
  const crypto = getCrypto();
  const salt = new Uint8Array(SALT_BYTE_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Converts a Uint8Array salt to a hexadecimal string.
 */
export function saltToHex(salt: Uint8Array): string {
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hexadecimal string back to a Uint8Array salt.
 */
export function hexToSalt(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal salt string length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Evaluates passphrase strength for the vault unlock/creation screen.
 */
export function evaluatePassphraseStrength(passphrase: string): {
  score: number; // 0 to 4
  label: string;
  color: string;
} {
  if (!passphrase) {
    return { score: 0, label: 'Empty', color: 'bg-slate-700' };
  }

  let score = 0;
  if (passphrase.length >= 8) score++;
  if (passphrase.length >= 14) score++;
  if (/[A-Z]/.test(passphrase) && /[a-z]/.test(passphrase)) score++;
  if (/[0-9]/.test(passphrase) && /[^A-Za-z0-9]/.test(passphrase)) score++;

  switch (score) {
    case 1:
      return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    case 2:
      return { score: 2, label: 'Moderate', color: 'bg-amber-500' };
    case 3:
      return { score: 3, label: 'Strong', color: 'bg-blue-500' };
    case 4:
      return { score: 4, label: 'Very Strong', color: 'bg-emerald-500' };
    default:
      return { score: 0, label: 'Too Short', color: 'bg-rose-600' };
  }
}
