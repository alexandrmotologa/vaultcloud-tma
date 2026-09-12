import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure target folder exists
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(config.databasePath);

  // Enable WAL mode for optimal concurrent reads and writes
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  initSchema(dbInstance);
  return dbInstance;
}

export function initSchema(db: DatabaseSync): void {
  // Vault credentials per user (salt and verification ciphertext)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_vaults (
      user_id TEXT PRIMARY KEY,
      salt_hex TEXT NOT NULL,
      verification_cipher_hex TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Virtual directories
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      parent_id TEXT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id);
  `);

  // Virtual file metadata with thumbnail cipher and encryption flag
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      folder_id TEXT,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      total_size_bytes INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      is_starred INTEGER DEFAULT 0,
      is_trash INTEGER DEFAULT 0,
      thumbnail_cipher_hex TEXT,
      is_encrypted INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_files_user_folder ON files(user_id, folder_id);
    CREATE INDEX IF NOT EXISTS idx_files_trash ON files(user_id, is_trash);
    CREATE INDEX IF NOT EXISTS idx_files_starred ON files(user_id, is_starred);
  `);

  // Run migrations safely for existing tables
  try {
    db.exec('ALTER TABLE files ADD COLUMN thumbnail_cipher_hex TEXT;');
  } catch {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE files ADD COLUMN is_encrypted INTEGER DEFAULT 1;');
  } catch {
    // Column already exists
  }

  // Create index on migrated column
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_files_encrypted ON files(user_id, is_encrypted);');
  } catch {
    // Ignore if already created
  }

  // Ordered encrypted chunk records
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      telegram_file_id TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_file_index ON chunks(file_id, chunk_index);
  `);
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
