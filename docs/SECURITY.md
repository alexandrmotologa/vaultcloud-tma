# Security Model and Cryptographic Guarantees

VaultCloud TMA enforces a zero-knowledge design. Encryption and decryption occur inside the client runtime, so unencrypted user data never reaches the relay server or Telegram servers.

## Cryptographic Primitives

The application uses standard browser APIs (`window.crypto.subtle`):

| Function | Primitive | Parameters | Purpose |
| :--- | :--- | :--- | :--- |
| Key Derivation | PBKDF2 | SHA-256, 100,000 iterations, 16-byte random salt | Derives 256-bit symmetric key from passphrase |
| Chunk Encryption | AES-GCM | 256-bit key length, 12-byte random IV per chunk | Authenticated payload encryption |
| Integrity Check | SHA-256 | 32-byte digest | Detects chunk corruption and bitrot |
| Auth Validation | HMAC-SHA256 | Telegram Bot Token secret key | Validates Telegram Mini App initData |

## Key Lifecycle

1. Passphrase Entry: The user supplies a passphrase in the unlock modal.
2. Derivation: The browser derives a `CryptoKey` marked with `extractable = false`. The raw key bytes cannot be extracted by JavaScript inspect utilities or exported to external scripts.
3. Memory Scope: The key exists only in active memory during the browsing session.
4. Auto-lock: When the user navigates away, closes the Mini App, or remains idle beyond the configured timeout, the client clears the key reference from memory.
5. Recovery: VaultCloud supports generating a recovery file containing the random salt and cryptographic verification token. Because VaultCloud does not hold master passphrases, a forgotten passphrase cannot be recovered on the server.

## Threat Model

### Untrusted Relay Server
The relay server routes encrypted binary chunks and tracks virtual folder structures. If an attacker gains full read access to the server filesystem or database:
- The attacker sees only ciphertext blobs prefixed with random IVs.
- The attacker cannot decrypt files without the client passphrase.
- File chunks are tagged with unique identifiers that reveal no file content.

### Compromised Telegram Channel
If a third party accesses the Telegram storage chat:
- All stored documents are AES-GCM encrypted chunks.
- Chunks lack file extensions and meaningful names.
- Rebuilding a file requires the VFS chunk ordering manifest and the master key.

### Transport Security
- Client to relay traffic uses TLS (HTTPS or localhost during testing).
- Relay to Telegram API traffic uses HTTPS TLS 1.3 enforced by Telegram servers.

## Recommendations for Users

- Choose a master passphrase with at least 14 characters.
- Download the recovery keyfile during setup and store it in an offline password manager.
- Lock the vault before sharing a device.
