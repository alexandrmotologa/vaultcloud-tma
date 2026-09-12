import { encryptChunk, decryptChunk } from './chunkCrypt';

export interface ShareParams {
  fileId: string;
  keyHex: string;
  name: string;
  size: number;
  mimeType: string;
}

const getCrypto = (): Crypto => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  return globalThis.crypto;
};

/**
 * Generates an ephemeral 256-bit AES-GCM file encryption key.
 */
export async function generateFileKey(): Promise<CryptoKey> {
  const crypto = getCrypto();
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // Extractable so it can be wrapped and shared
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey to a hexadecimal string.
 */
export async function exportKeyToHex(key: CryptoKey): Promise<string> {
  const crypto = getCrypto();
  const raw = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(raw);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Imports a raw 32-byte hex string as an AES-GCM CryptoKey.
 */
export async function importKeyFromHex(hex: string): Promise<CryptoKey> {
  const crypto = getCrypto();
  if (hex.length !== 64) {
    throw new Error('Invalid key length. Expected 32 bytes (64 hex chars).');
  }

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }

  return crypto.subtle.importKey(
    'raw',
    bytes.buffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a raw file key with the user's master key for safe storage.
 */
export async function wrapFileKey(fileKey: CryptoKey, masterKey: CryptoKey): Promise<string> {
  const rawKeyHex = await exportKeyToHex(fileKey);
  const encoder = new TextEncoder();
  const encrypted = await encryptChunk(encoder.encode(rawKeyHex).buffer, masterKey);
  const bytes = new Uint8Array(encrypted.chunkBufferWithIv);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decrypts a wrapped file key using the user's master key.
 */
export async function unwrapFileKey(wrappedHex: string, masterKey: CryptoKey): Promise<CryptoKey> {
  const bytes = new Uint8Array(wrappedHex.length / 2);
  for (let i = 0; i < wrappedHex.length; i += 2) {
    bytes[i / 2] = parseInt(wrappedHex.slice(i, i + 2), 16);
  }
  const decrypted = await decryptChunk(bytes.buffer, masterKey);
  const rawKeyHex = new TextDecoder().decode(decrypted);
  return importKeyFromHex(rawKeyHex);
}

/**
 * Generates a full zero-knowledge share link with #key fragment.
 */
export function buildShareLink(
  fileId: string,
  keyHex: string,
  name: string,
  size: number,
  mimeType: string
): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8085';
  const params = new URLSearchParams({
    share: fileId,
    key: keyHex,
    name: encodeURIComponent(name),
    size: size.toString(),
    mime: encodeURIComponent(mimeType),
  });

  return `${baseUrl}/#${params.toString()}`;
}

/**
 * Parses the current URL hash for incoming share parameters.
 */
export function parseShareHash(customHash?: string): ShareParams | null {
  const hash = customHash !== undefined ? customHash : (typeof window !== 'undefined' ? window.location.hash : '');
  if (!hash) {
    return null;
  }

  const hashString = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(hashString);
  const fileId = params.get('share');
  const keyHex = params.get('key');
  const rawName = params.get('name');
  const rawSize = params.get('size');
  const rawMime = params.get('mime');

  if (!fileId || !keyHex) {
    return null;
  }

  return {
    fileId,
    keyHex,
    name: rawName ? decodeURIComponent(rawName) : 'shared_file',
    size: rawSize ? parseInt(rawSize, 10) : 0,
    mimeType: rawMime ? decodeURIComponent(rawMime) : 'application/octet-stream',
  };
}
