import { describe, it, expect } from 'vitest';
import { deriveKey, generateSalt, saltToHex, hexToSalt, evaluatePassphraseStrength } from '../crypto/keyDerivation';
import { encryptChunk, decryptChunk, sliceFileIntoChunks } from '../crypto/chunkCrypt';
import { createVerificationCipher, verifyPassphraseKey } from '../crypto/keyBackup';

describe('VaultCloud Cryptographic Engine', () => {
  it('derives identical keys from identical passphrase and salt', async () => {
    const passphrase = 'MySecretPassphrase123!';
    const salt = generateSalt();

    const key1 = await deriveKey(passphrase, salt);
    const key2 = await deriveKey(passphrase, salt);

    expect(key1).toBeDefined();
    expect(key2).toBeDefined();

    // Verify both keys can decrypt ciphertext created by the other
    const message = new TextEncoder().encode('Confidential telegram payload');
    const encrypted = await encryptChunk(message.buffer, key1);
    const decrypted = await decryptChunk(encrypted.chunkBufferWithIv, key2);

    expect(new TextDecoder().decode(decrypted)).toBe('Confidential telegram payload');
  });

  it('fails decryption with wrong passphrase/key', async () => {
    const salt = generateSalt();
    const keyCorrect = await deriveKey('CorrectPassword123!', salt);
    const keyWrong = await deriveKey('WrongPassword456!', salt);

    const message = new TextEncoder().encode('Secret Document');
    const encrypted = await encryptChunk(message.buffer, keyCorrect);

    await expect(decryptChunk(encrypted.chunkBufferWithIv, keyWrong)).rejects.toThrow();
  });

  it('correctly converts salt to hex and back', () => {
    const originalSalt = generateSalt();
    const hex = saltToHex(originalSalt);
    const parsedSalt = hexToSalt(hex);

    expect(parsedSalt).toEqual(originalSalt);
  });

  it('verifies SHA-256 integrity check and catches corrupted chunks', async () => {
    const salt = generateSalt();
    const key = await deriveKey('Pass12345!', salt);
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const encrypted = await encryptChunk(payload.buffer, key);
    expect(encrypted.cipherHashHex).toHaveLength(64);
    expect(encrypted.plainHashHex).toHaveLength(64);

    // Normal decryption with integrity check passes
    const decrypted = await decryptChunk(encrypted.chunkBufferWithIv, key, encrypted.plainHashHex);
    expect(new Uint8Array(decrypted)).toEqual(payload);

    // Mismatched expected hash fails
    const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
    await expect(decryptChunk(encrypted.chunkBufferWithIv, key, fakeHash)).rejects.toThrow(/Integrity verification failed/);
  });

  it('slices multi-megabyte payloads into configured chunk sizes', () => {
    // Simulated 25MB buffer
    const mockData = new Uint8Array(25 * 1024); // 25KB for fast test
    const blob = new Blob([mockData]);
    const chunkSize = 10 * 1024; // 10KB chunks

    const chunks = sliceFileIntoChunks(blob, chunkSize);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].size).toBe(10 * 1024);
    expect(chunks[1].size).toBe(10 * 1024);
    expect(chunks[2].size).toBe(5 * 1024);
  });

  it('correctly validates passphrase verification cipher in key backup', async () => {
    const salt = generateSalt();
    const key = await deriveKey('PassphraseTest999#', salt);
    const wrongKey = await deriveKey('IncorrectPassphrase', salt);

    const cipherHex = await createVerificationCipher(key);
    expect(typeof cipherHex).toBe('string');

    const isValid = await verifyPassphraseKey(cipherHex, key);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassphraseKey(cipherHex, wrongKey);
    expect(isInvalid).toBe(false);
  });

  it('evaluates passphrase strength properly', () => {
    expect(evaluatePassphraseStrength('').score).toBe(0);
    expect(evaluatePassphraseStrength('abc').score).toBe(0);
    expect(evaluatePassphraseStrength('abcdefgh').score).toBe(1);
    expect(evaluatePassphraseStrength('abcdefgh123').score).toBe(1);
    expect(evaluatePassphraseStrength('Abcdefgh123').score).toBe(2);
    expect(evaluatePassphraseStrength('Abcdefgh123!').score).toBe(3);
    expect(evaluatePassphraseStrength('LongPasswordWithSymbols123!@#').score).toBe(4);
  });
});
