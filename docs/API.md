# REST API Documentation

The Fastify server exposes endpoints for managing virtual folders, file records, and encrypted chunks.

## Authentication

Requests from the Telegram Mini App include the Telegram WebApp initData string in the `Authorization` header:

```http
Authorization: tma <initDataRawString>
```

When running with `DEMO_MODE=true`, the server accepts demo sessions automatically and uses user ID `10001`.

## Endpoints

### 1. Vault Management

#### GET /api/vault/status
Checks whether a vault exists for the current user and returns configuration details.

Response:
```json
{
  "hasVault": true,
  "saltHex": "a4f89d3c...",
  "demoMode": true,
  "totalFiles": 12,
  "totalSizeBytes": 45875200
}
```

#### POST /api/vault/init
Initializes a new vault for the user with an initial salt.

Request:
```json
{
  "saltHex": "a4f89d3c..."
}
```

---

### 2. Virtual File System (VFS)

#### GET /api/vfs/folders
Retrieves the folder hierarchy.

Query parameters:
- `parentId` (optional): Filter folders by parent folder ID (omitted for root folders).

Response:
```json
[
  {
    "id": "folder_abc123",
    "parentId": null,
    "name": "Work Documents",
    "createdAt": 1741824000000
  }
]
```

#### POST /api/vfs/folders
Creates a new virtual folder.

Request:
```json
{
  "parentId": "folder_abc123",
  "name": "Projects"
}
```

#### DELETE /api/vfs/folders/:id
Deletes a folder and all its contents recursively.

#### GET /api/vfs/files
Lists files in a given folder.

Query parameters:
- `folderId` (optional): Folder ID to list (null or omitted for root).
- `starred` (optional): Filter by starred status (`true` / `false`).
- `trash` (optional): Set to `true` to list items currently in the Recycle Bin.
- `search` (optional): Search query matching filename.

Response:
```json
[
  {
    "id": "file_xyz789",
    "folderId": "folder_abc123",
    "name": "financial_report.pdf",
    "mimeType": "application/pdf",
    "totalSizeBytes": 2457600,
    "chunkCount": 1,
    "isStarred": false,
    "isTrash": false,
    "createdAt": 1741824000000
  }
]
```

#### POST /api/vfs/files
Registers a new file before chunk upload begins.

Request:
```json
{
  "id": "file_xyz789",
  "folderId": "folder_abc123",
  "name": "financial_report.pdf",
  "mimeType": "application/pdf",
  "totalSizeBytes": 2457600,
  "chunkCount": 1
}
```

#### PATCH /api/vfs/files/:id
Updates file properties (rename, move folder, star, soft-delete, restore).

Request:
```json
{
  "name": "new_report.pdf",
  "folderId": "folder_target456",
  "isStarred": true,
  "isTrash": false
}
```

#### DELETE /api/vfs/files/:id
Permanently deletes a file record and its associated storage chunks.

---

### 3. Chunk Storage Operations

#### POST /api/chunks/upload
Uploads a single encrypted chunk.

Content-Type: `multipart/form-data`

Fields:
- `fileId`: string
- `chunkIndex`: integer (0-based)
- `sha256Hash`: hex string of encrypted chunk
- `chunk`: binary buffer (contains 12-byte IV + AES-GCM ciphertext)

Response:
```json
{
  "success": true,
  "chunkIndex": 0,
  "sizeBytes": 2457616
}
```

#### GET /api/chunks/:fileId/:chunkIndex
Streams raw encrypted chunk bytes back to the client for local decryption.

---

### 4. Batch Operations

#### POST /api/vfs/batch
Performs batch operations on multiple files at once.

Request:
```json
{
  "action": "trash",
  "fileIds": ["file_1", "file_2"],
  "targetFolderId": null
}
```

Actions supported:
- `trash`: soft deletes files
- `restore`: restores files from trash
- `move`: moves files to `targetFolderId` (or root if null)
- `star`: marks files as starred
- `unstar`: removes star status
- `purge`: permanently deletes files and their chunk records

---

### 5. Public Sharing

#### GET /api/vfs/public/:id
Retrieves public file metadata for zero-knowledge link sharing. Does not require user authentication headers. The decryption key is never sent to the server and remains in the URL hash fragment (`#key=...`).

---

### 6. Telegram Inbox Dropper

#### GET /api/vfs/inbox
Retrieves unencrypted files forwarded or sent directly to the Telegram bot chat.

#### POST /api/vfs/inbox/vault
Finalizes client-side encryption of an inbox file after the client uploads the encrypted chunks.

Request:
```json
{
  "fileId": "file_inbox_123",
  "totalSizeBytes": 45028,
  "chunkCount": 1,
  "thumbnailCipherHex": "aabb..."
}
```
