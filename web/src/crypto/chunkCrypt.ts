/**
 * Cryptographic chunking and AES-GCM-256 encryption/decryption engine.
 * Slices large files into 10MB chunks, generates unique 12-byte IVs,
 * prepends IV to ciphertext, and computes SHA-256 hashes.
 */

export const CHUNK_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB chunks
export const IV_LENGTH_BYTES = 12; // 96-bit IV recommended for AES-GCM

const getCrypto = (): Crypto => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  return globalThis.crypto;
};

/**
 * Computes a SHA-256 hash formatted as a lowercase hexadecimal string.
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const crypto = getCrypto();
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface EncryptedChunkResult {
  chunkBufferWithIv: ArrayBuffer;
  ivHex: string;
  cipherHashHex: string;
  plainHashHex: string;
  sizeBytes: number;
}

/**
 * Encrypts a plain chunk of data with AES-GCM-256.
 * Returns a combined ArrayBuffer where the first 12 bytes are the IV followed by ciphertext and auth tag.
 */
export async function encryptChunk(
  plainChunk: ArrayBuffer,
  key: CryptoKey
): Promise<EncryptedChunkResult> {
  const crypto = getCrypto();
  const iv = new Uint8Array(IV_LENGTH_BYTES);
  crypto.getRandomValues(iv);

  const plainHashHex = await computeSha256(plainChunk);

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128, // 128-bit authentication tag
    },
    key,
    plainChunk
  );

  // Combine IV (12 bytes) + Ciphertext (with 16-byte tag appended by WebCrypto)
  const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.byteLength);

  const cipherHashHex = await computeSha256(combined.buffer);
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    chunkBufferWithIv: combined.buffer,
    ivHex,
    cipherHashHex,
    plainHashHex,
    sizeBytes: combined.byteLength,
  };
}

/**
 * Decrypts an encrypted chunk with prefixed 12-byte IV.
 * Verifies the integrity of the decrypted data against expected plain hash if provided.
 */
export async function decryptChunk(
  chunkBufferWithIv: ArrayBuffer,
  key: CryptoKey,
  expectedPlainHash?: string
): Promise<ArrayBuffer> {
  const crypto = getCrypto();
  if (chunkBufferWithIv.byteLength <= IV_LENGTH_BYTES) {
    throw new Error('Corrupted chunk: payload smaller than IV length');
  }

  const iv = new Uint8Array(chunkBufferWithIv.slice(0, IV_LENGTH_BYTES));
  const cipherData = chunkBufferWithIv.slice(IV_LENGTH_BYTES);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
    },
    key,
    cipherData
  );

  if (expectedPlainHash) {
    const computedHash = await computeSha256(decryptedBuffer);
    if (computedHash.toLowerCase() !== expectedPlainHash.toLowerCase()) {
      throw new Error('Integrity verification failed: SHA-256 digest mismatch');
    }
  }

  return decryptedBuffer;
}

/**
 * Slices a File or Blob into chunks of specified size.
 */
export function sliceFileIntoChunks(file: File | Blob, chunkSize: number = CHUNK_SIZE_BYTES): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    chunks.push(file.slice(offset, end));
    offset = end;
  }
  return chunks;
}

/**
 * Reassembles an array of decrypted ArrayBuffers into a single Blob with correct MIME type.
 */
export function reassembleFile(chunks: ArrayBuffer[], mimeType: string = 'application/octet-stream'): Blob {
  return new Blob(chunks, { type: mimeType });
}
