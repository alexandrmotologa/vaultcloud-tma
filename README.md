# VaultCloud TMA

Zero-knowledge encrypted personal cloud drive Telegram Mini App backed by Telegram's free, unlimited 2GB file storage.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)

---

## Overview

Telegram provides unlimited cloud file storage with single file uploads up to 2GB, but files are stored in unorganized chat histories and readable by Telegram servers.

VaultCloud TMA turns Telegram into an encrypted personal drive with a folder hierarchy, search, and client-side encryption. Files are split into 10MB chunks and encrypted with AES-GCM-256 inside the browser before leaving the device. The server and Telegram see only encrypted binary chunks.

## Core Features

- Client-side AES-GCM-256 encryption via the WebCrypto API
- Master key derivation with PBKDF2 (100,000 rounds, SHA-256, and random salt)
- Virtual file system with nested folders, search, breadcrumbs, favorites, and trash bin
- Automatic 10MB chunking to handle multi-gigabyte uploads over Telegram Bot API
- In-memory media preview for photos, audio, videos, and PDFs without saving decrypted files to disk
- Standalone execution with Long Polling and a built-in demo mode requiring zero external domains
- Telegram Mini App integration with automatic theme matching and haptic feedback
- Docker support with multi-stage builds and compose files

## Advanced Features

- Zero-Knowledge Link Sharing: Share individual encrypted files using URL hash fragments (`#share=...&key=...`). Browsers never transmit hash fragments over HTTP, ensuring relays and servers cannot read shared keys.
- Client-Side Encrypted Photo Thumbnails: Images generate 140x140 WebP thumbnails resized and encrypted in the browser for high-speed grid browsing without downloading full multi-megabyte image assets.
- Telegram Chat Inbox Drop: Users can forward documents or photos straight to the Telegram bot chat. The files are stored in an Inbox queue and can be vaulted with full client-side encryption in one tap.
- Multi-File Batch Actions & In-Memory ZIP: Multi-select files to star, move, trash, or package into an in-memory decrypted ZIP archive using JSZip.
- In-Vault Encrypted Markdown Notes: Create and edit secure text or Markdown notes in place without external editor dependencies.
- Quick PIN Lock & Auto-Lock Timer: Set an optional 4-digit PIN for quick unlocks and configure inactivity timeouts that purge cryptographic keys from memory when idle.
- Full Vault Export: Download a disaster recovery ZIP package containing all decrypted files and a structured JSON metadata manifest.

## Architecture

```
[Browser / Mini App]
    | 1. Slices file into 10MB chunks
    | 2. Encrypts with AES-GCM-256 using PBKDF2 derived key
    v
[Fastify Server]
    | 3. Stores folder structure and chunk manifests in SQLite
    | 4. Streams encrypted chunks to storage adapter
    v
[Telegram API / Mock Storage]
    | 5. Saves chunks as encrypted document blobs
```

For more details, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Quick Start

### 1. Requirements
- Node.js 20 or higher
- npm 10 or higher

### 2. Installation
```bash
git clone https://github.com/alexandrmotologa/vaultcloud-tma.git
cd vaultcloud-tma
npm install
```

### 3. Run in Demo Mode
Copy the example environment file:
```bash
cp .env.example .env
```

Build the web frontend and start the relay server:
```bash
npm run build
npm start
```

Open `http://localhost:8080` in your browser. Use the demo passphrase `DemoPassword123!` to unlock the sample vault.

## Project Structure

```
vaultcloud-tma/
├── docs/                     # Architecture, security, API, and deployment documentation
├── server/                   # Fastify backend, SQLite VFS, and grammY Telegram bot
│   ├── src/
│   │   ├── bot/              # Telegram bot commands and long polling
│   │   ├── db/               # SQLite database and virtual file system
│   │   ├── routes/           # REST endpoints for VFS and chunk streams
│   │   ├── security/         # Telegram WebApp initData validator
│   │   └── storage/          # Telegram Bot API relay and mock storage adapter
│   └── package.json
├── web/                      # React 19 Telegram Mini App frontend
│   ├── src/
│   │   ├── components/       # Explorer, preview modals, upload queue, headers
│   │   ├── crypto/           # WebCrypto PBKDF2 and AES-GCM chunking pipelines
│   │   ├── hooks/            # Telegram SDK and drive state management
│   │   └── styles/           # Tailwind CSS styles and theme variables
│   └── package.json
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## Security Guarantees

- Zero-Knowledge: Plaintext files and master passphrases never leave the client browser.
- Authenticated Encryption: Every chunk includes a unique 12-byte IV and an authentication tag that prevents unauthorized tampering.
- Memory-Only Decryption: Media and document previews are rendered using temporary in-memory object URLs that are revoked when closed.
- Open Source: Complete transparency with standard cryptographic algorithms.

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Security Model](docs/SECURITY.md)
- [REST API Reference](docs/API.md)
- [Deployment and Setup Guide](docs/DEPLOYMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## License

Released under the [MIT License](LICENSE).
