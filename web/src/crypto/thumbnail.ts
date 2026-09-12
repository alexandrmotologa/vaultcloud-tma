import { encryptChunk, decryptChunk } from './chunkCrypt';

/**
 * Resizes an image file or blob client-side to a compact WebP/JPEG thumbnail.
 */
export async function generateImageThumbnail(
  file: File | Blob,
  maxWidth = 140,
  maxHeight = 140
): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const buffer = await blob.arrayBuffer();
          resolve(buffer);
        },
        'image/webp',
        0.75
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Encrypts a thumbnail ArrayBuffer and formats as hex string.
 */
export async function encryptThumbnail(
  thumbBuffer: ArrayBuffer,
  key: CryptoKey
): Promise<string> {
  const encrypted = await encryptChunk(thumbBuffer, key);
  const bytes = new Uint8Array(encrypted.chunkBufferWithIv);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Resizes an image and encrypts the resulting thumbnail with the master key.
 */
export async function generateEncryptedThumbnail(
  file: File | Blob,
  key: CryptoKey,
  maxWidth = 140,
  maxHeight = 140
): Promise<string | null> {
  const thumbBuffer = await generateImageThumbnail(file, maxWidth, maxHeight);
  if (!thumbBuffer) return null;
  return encryptThumbnail(thumbBuffer, key);
}

/**
 * Decrypts a thumbnail hex string and returns a local object URL.
 */
export async function decryptThumbnail(
  cipherHex: string,
  key: CryptoKey
): Promise<string> {
  if (cipherHex.length % 2 !== 0) {
    throw new Error('Invalid thumbnail hex');
  }

  const bytes = new Uint8Array(cipherHex.length / 2);
  for (let i = 0; i < cipherHex.length; i += 2) {
    bytes[i / 2] = parseInt(cipherHex.slice(i, i + 2), 16);
  }

  const decrypted = await decryptChunk(bytes.buffer, key);
  const blob = new Blob([decrypted], { type: 'image/webp' });
  return URL.createObjectURL(blob);
}
