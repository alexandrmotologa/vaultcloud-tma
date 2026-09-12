/**
 * Emergency keyfile generator and recovery token verification.
 * Creates a portable JSON backup with salt and authentication verification token.
 */

import { encryptChunk, decryptChunk } from './chunkCrypt';

export interface VaultKeyBackup {
  version: number;
  appName: 'VaultCloud TMA';
  saltHex: string;
  verificationCipherHex: string;
  createdAt: string;
}

const VERIFICATION_PHRASE = 'VAULTCLOUD_ZERO_KNOWLEDGE_VERIFIED_KEY';

/**
 * Creates an encrypted verification token to validate whether a passphrase is correct.
 */
export async function createVerificationCipher(key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(VERIFICATION_PHRASE);
  const encrypted = await encryptChunk(plainBytes.buffer, key);
  const bytes = new Uint8Array(encrypted.chunkBufferWithIv);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Tests if the given key successfully decrypts the verification cipher.
 */
export async function verifyPassphraseKey(verificationCipherHex: string, key: CryptoKey): Promise<boolean> {
  try {
    const bytes = new Uint8Array(verificationCipherHex.length / 2);
    for (let i = 0; i < verificationCipherHex.length; i += 2) {
      bytes[i / 2] = parseInt(verificationCipherHex.slice(i, i + 2), 16);
    }
    const decrypted = await decryptChunk(bytes.buffer, key);
    const decoder = new TextDecoder();
    const text = decoder.decode(decrypted);
    return text === VERIFICATION_PHRASE;
  } catch {
    return false;
  }
}

/**
 * Generates and triggers download of a .vaultkey backup file.
 */
export function exportVaultKeyfile(saltHex: string, verificationCipherHex: string): void {
  const backupData: VaultKeyBackup = {
    version: 1,
    appName: 'VaultCloud TMA',
    saltHex,
    verificationCipherHex,
    createdAt: new Date().toISOString(),
  };

  const json = JSON.stringify(backupData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vaultcloud-backup-${new Date().toISOString().slice(0, 10)}.vaultkey`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
