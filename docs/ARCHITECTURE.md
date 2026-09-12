# Architecture Overview

VaultCloud TMA turns Telegram file storage into an encrypted personal cloud drive. The system has three main parts: a React Mini App running in the browser or Telegram client, a Fastify relay server, and Telegram storage channels.

## System Components

```
+-------------------------------------------------------------+
| Browser / Telegram Mini App Client                          |
|                                                             |
|  [User Files] -> Slicing (10MB) -> AES-GCM-256 Encryption    |
|  [Decrypted Buffer] <- Reassembly <- AES-GCM-256 Decryption  |
|  Passphrase -> PBKDF2 (100,000 rounds, SHA-256) -> Key      |
+-------------------------------------------------------------+
                              |
                     Encrypted Chunks
                              |
                              v
+-------------------------------------------------------------+
| Fastify Relay Server                                        |
|                                                             |
|  REST Endpoints (/api/vfs, /api/chunks)                     |
|  Virtual File System Metadata Store (SQLite)                |
|  Telegram Adapter / In-Memory Mock Adapter                  |
+-------------------------------------------------------------+
                              |
                     Telegram Document API
                              |
                              v
+-------------------------------------------------------------+
| Telegram Cloud Storage                                      |
|                                                             |
|  Encrypted Document Chunks stored in private chat/channel   |
|  Telegram file_id referenced by SQLite manifest             |
+-------------------------------------------------------------+
```

## Data Lifecycle

### 1. Key Derivation

When the user enters their passphrase, the client generates a 32-byte cryptographic key using PBKDF2:

- Hash algorithm: SHA-256
- Iteration count: 100,000
- Salt: 16 random bytes generated on initial vault creation and saved with the user vault record
- Key algorithm: AES-GCM 256-bit

The master key remains in browser memory (`CryptoKey` object) and is never transmitted over HTTP or saved to disk or localStorage.

### 2. File Upload Pipeline

1. The client selects a file from disk.
2. The client calculates the total file size and splits it into sequential 10MB chunks.
3. For each chunk:
   - The client generates a random 12-byte initialization vector (IV).
   - The client computes a SHA-256 hash of the plain chunk for integrity tracking.
   - The WebCrypto API encrypts the chunk using AES-GCM.
   - The 12-byte IV is prefixed to the ciphertext payload.
   - The client computes a SHA-256 hash of the encrypted payload.
4. The client creates a file entry in the Virtual File System via `POST /api/vfs/files`.
5. The client posts each encrypted chunk to `POST /api/chunks/upload`.
6. The relay server streams the chunk payload directly to Telegram using `sendDocument` or stores it in mock memory when running in demo mode.
7. The server records the resulting `telegram_file_id`, chunk index, and size in the SQLite database.

### 3. File Download and Decryption Pipeline

1. The client requests file metadata and chunk manifests via `GET /api/vfs/files/:id`.
2. The client downloads encrypted chunks in sequence from `GET /api/chunks/:fileId/:chunkIndex`.
3. The server fetches the encrypted document bytes from Telegram via `getFile` and streams them back to the client.
4. For each chunk, the browser:
   - Extracts the leading 12-byte IV.
   - Decrypts the remaining payload with AES-GCM using the stored `CryptoKey`.
   - Verifies the integrity of the decrypted data against the expected SHA-256 hash.
5. Once all chunks decrypt, the client creates an in-memory `Blob` and renders a local object URL (`URL.createObjectURL(blob)`).
6. Photos, audio, videos, and PDF documents display directly in the preview modal without temporary unencrypted files on disk.

## Virtual File System (VFS)

Telegram groups files in flat chat logs without directory structures. VaultCloud implements a hierarchical directory tree in SQLite:

- `folders`: tracks folder hierarchy using `parent_id` foreign keys, folder names, and owner user IDs.
- `files`: tracks file entries, associated folder IDs, file sizes, MIME types, encryption salts, and soft-delete status.
- `chunks`: tracks ordered chunk indices, corresponding Telegram file IDs, byte lengths, and SHA-256 digests.
- `user_vaults`: stores per-user account metadata, salt values, and quota settings.
