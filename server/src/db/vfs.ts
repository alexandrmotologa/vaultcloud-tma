import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from './database.js';

export interface UserVaultRecord {
  user_id: string;
  salt_hex: string;
  verification_cipher_hex: string | null;
  created_at: number;
}

export interface FolderRecord {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  created_at: number;
}

export interface FileRecord {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  mime_type: string;
  total_size_bytes: number;
  chunk_count: number;
  is_starred: number;
  is_trash: number;
  created_at: number;
  updated_at: number;
}

export interface ChunkRecord {
  id: string;
  file_id: string;
  chunk_index: number;
  telegram_file_id: string;
  size_bytes: number;
  sha256_hash: string;
  created_at: number;
}

export class VirtualFileSystem {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDatabase();
  }

  // --- User Vault Management ---

  getUserVault(userId: string): UserVaultRecord | null {
    const stmt = this.db.prepare('SELECT * FROM user_vaults WHERE user_id = ?');
    const result = stmt.get(userId) as unknown as UserVaultRecord | undefined;
    return result || null;
  }

  saveUserVault(userId: string, saltHex: string, verificationCipherHex?: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO user_vaults (user_id, salt_hex, verification_cipher_hex, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        salt_hex = excluded.salt_hex,
        verification_cipher_hex = excluded.verification_cipher_hex
    `);
    stmt.run(userId, saltHex, verificationCipherHex || null, now);
  }

  getVaultStats(userId: string): { totalFiles: number; totalSizeBytes: number; folderCount: number } {
    const fileStatsStmt = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_size_bytes), 0) as totalBytes
      FROM files WHERE user_id = ? AND is_trash = 0
    `);
    const fileStats = fileStatsStmt.get(userId) as unknown as { count: number; totalBytes: number };

    const folderStatsStmt = this.db.prepare('SELECT COUNT(*) as count FROM folders WHERE user_id = ?');
    const folderStats = folderStatsStmt.get(userId) as unknown as { count: number };

    return {
      totalFiles: fileStats?.count || 0,
      totalSizeBytes: fileStats?.totalBytes || 0,
      folderCount: folderStats?.count || 0,
    };
  }

  // --- Folder Management ---

  createFolder(userId: string, name: string, parentId?: string | null): FolderRecord {
    const id = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();
    const cleanParentId = parentId && parentId !== 'root' ? parentId : null;

    const stmt = this.db.prepare(`
      INSERT INTO folders (id, user_id, parent_id, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, cleanParentId, name, now);

    return {
      id,
      user_id: userId,
      parent_id: cleanParentId,
      name,
      created_at: now,
    };
  }

  listFolders(userId: string, parentId?: string | null): FolderRecord[] {
    const cleanParentId = parentId && parentId !== 'root' ? parentId : null;
    if (cleanParentId === null) {
      const stmt = this.db.prepare('SELECT * FROM folders WHERE user_id = ? AND parent_id IS NULL ORDER BY name ASC');
      return (stmt.all(userId) as unknown as FolderRecord[]) || [];
    } else {
      const stmt = this.db.prepare('SELECT * FROM folders WHERE user_id = ? AND parent_id = ? ORDER BY name ASC');
      return (stmt.all(userId, cleanParentId) as unknown as FolderRecord[]) || [];
    }
  }

  getFolder(userId: string, folderId: string): FolderRecord | null {
    const stmt = this.db.prepare('SELECT * FROM folders WHERE user_id = ? AND id = ?');
    const result = stmt.get(userId, folderId) as unknown as FolderRecord | undefined;
    return result || null;
  }

  getBreadcrumbs(userId: string, folderId?: string | null): Array<{ id: string | null; name: string }> {
    const crumbs: Array<{ id: string | null; name: string }> = [{ id: null, name: 'My Drive' }];
    if (!folderId || folderId === 'root') {
      return crumbs;
    }

    const pathItems: FolderRecord[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder = this.getFolder(userId, currentId);
      if (!folder) break;
      pathItems.unshift(folder);
      currentId = folder.parent_id;
    }

    for (const item of pathItems) {
      crumbs.push({ id: item.id, name: item.name });
    }

    return crumbs;
  }

  deleteFolder(userId: string, folderId: string): void {
    // Delete files inside folder
    const filesInFolder = this.db.prepare('SELECT id FROM files WHERE user_id = ? AND folder_id = ?').all(userId, folderId) as unknown as Array<{ id: string }>;
    for (const f of filesInFolder) {
      this.deleteFile(userId, f.id);
    }

    // Recursively delete subfolders
    const subfolders = this.db.prepare('SELECT id FROM folders WHERE user_id = ? AND parent_id = ?').all(userId, folderId) as unknown as Array<{ id: string }>;
    for (const sub of subfolders) {
      this.deleteFolder(userId, sub.id);
    }

    // Delete folder itself
    this.db.prepare('DELETE FROM folders WHERE user_id = ? AND id = ?').run(userId, folderId);
  }

  // --- File Management ---

  createFile(
    userId: string,
    data: {
      id?: string;
      folderId?: string | null;
      name: string;
      mimeType: string;
      totalSizeBytes: number;
      chunkCount: number;
    }
  ): FileRecord {
    const id = data.id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();
    const cleanFolderId = data.folderId && data.folderId !== 'root' ? data.folderId : null;

    const stmt = this.db.prepare(`
      INSERT INTO files (id, user_id, folder_id, name, mime_type, total_size_bytes, chunk_count, is_starred, is_trash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `);
    stmt.run(id, userId, cleanFolderId, data.name, data.mimeType, data.totalSizeBytes, data.chunkCount, now, now);

    return {
      id,
      user_id: userId,
      folder_id: cleanFolderId,
      name: data.name,
      mime_type: data.mimeType,
      total_size_bytes: data.totalSizeBytes,
      chunk_count: data.chunkCount,
      is_starred: 0,
      is_trash: 0,
      created_at: now,
      updated_at: now,
    };
  }

  listFiles(
    userId: string,
    options: {
      folderId?: string | null;
      starred?: boolean;
      trash?: boolean;
      search?: string;
    } = {}
  ): FileRecord[] {
    const isTrash = options.trash ? 1 : 0;

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      const stmt = this.db.prepare(`
        SELECT * FROM files
        WHERE user_id = ? AND is_trash = ? AND name LIKE ?
        ORDER BY updated_at DESC
      `);
      return (stmt.all(userId, isTrash, term) as unknown as FileRecord[]) || [];
    }

    if (options.starred) {
      const stmt = this.db.prepare(`
        SELECT * FROM files
        WHERE user_id = ? AND is_trash = ? AND is_starred = 1
        ORDER BY updated_at DESC
      `);
      return (stmt.all(userId, isTrash) as unknown as FileRecord[]) || [];
    }

    if (options.trash) {
      const stmt = this.db.prepare(`
        SELECT * FROM files
        WHERE user_id = ? AND is_trash = 1
        ORDER BY updated_at DESC
      `);
      return (stmt.all(userId) as unknown as FileRecord[]) || [];
    }

    const cleanFolderId = options.folderId && options.folderId !== 'root' ? options.folderId : null;
    if (cleanFolderId === null) {
      const stmt = this.db.prepare(`
        SELECT * FROM files
        WHERE user_id = ? AND is_trash = 0 AND folder_id IS NULL
        ORDER BY updated_at DESC
      `);
      return (stmt.all(userId) as unknown as FileRecord[]) || [];
    } else {
      const stmt = this.db.prepare(`
        SELECT * FROM files
        WHERE user_id = ? AND is_trash = 0 AND folder_id = ?
        ORDER BY updated_at DESC
      `);
      return (stmt.all(userId, cleanFolderId) as unknown as FileRecord[]) || [];
    }
  }

  getFile(userId: string, fileId: string): (FileRecord & { chunks: ChunkRecord[] }) | null {
    const fileStmt = this.db.prepare('SELECT * FROM files WHERE user_id = ? AND id = ?');
    const file = fileStmt.get(userId, fileId) as unknown as FileRecord | undefined;
    if (!file) return null;

    const chunks = this.getChunks(fileId);
    return { ...file, chunks };
  }

  updateFile(
    userId: string,
    fileId: string,
    updates: {
      name?: string;
      folderId?: string | null;
      isStarred?: boolean;
      isTrash?: boolean;
    }
  ): FileRecord | null {
    const existing = this.db.prepare('SELECT * FROM files WHERE user_id = ? AND id = ?').get(userId, fileId) as unknown as FileRecord | undefined;
    if (!existing) return null;

    const newName = updates.name !== undefined ? updates.name : existing.name;
    const newFolderId = updates.folderId !== undefined ? (updates.folderId === 'root' ? null : updates.folderId) : existing.folder_id;
    const newStarred = updates.isStarred !== undefined ? (updates.isStarred ? 1 : 0) : existing.is_starred;
    const newTrash = updates.isTrash !== undefined ? (updates.isTrash ? 1 : 0) : existing.is_trash;
    const now = Date.now();

    const stmt = this.db.prepare(`
      UPDATE files
      SET name = ?, folder_id = ?, is_starred = ?, is_trash = ?, updated_at = ?
      WHERE user_id = ? AND id = ?
    `);
    stmt.run(newName, newFolderId, newStarred, newTrash, now, userId, fileId);

    return {
      ...existing,
      name: newName,
      folder_id: newFolderId,
      is_starred: newStarred,
      is_trash: newTrash,
      updated_at: now,
    };
  }

  deleteFile(userId: string, fileId: string): void {
    this.db.prepare('DELETE FROM chunks WHERE file_id = ?').run(fileId);
    this.db.prepare('DELETE FROM files WHERE user_id = ? AND id = ?').run(userId, fileId);
  }

  // --- Chunk Management ---

  addChunk(data: {
    id?: string;
    fileId: string;
    chunkIndex: number;
    telegramFileId: string;
    sizeBytes: number;
    sha256Hash: string;
  }): ChunkRecord {
    const id = data.id || `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO chunks (id, file_id, chunk_index, telegram_file_id, size_bytes, sha256_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.fileId, data.chunkIndex, data.telegramFileId, data.sizeBytes, data.sha256Hash, now);

    return {
      id,
      file_id: data.fileId,
      chunk_index: data.chunkIndex,
      telegram_file_id: data.telegramFileId,
      size_bytes: data.sizeBytes,
      sha256_hash: data.sha256Hash,
      created_at: now,
    };
  }

  getChunks(fileId: string): ChunkRecord[] {
    const stmt = this.db.prepare('SELECT * FROM chunks WHERE file_id = ? ORDER BY chunk_index ASC');
    return (stmt.all(fileId) as unknown as ChunkRecord[]) || [];
  }

  // --- Demo Seeder ---

  seedDemoData(userId: string): void {
    const existing = this.getUserVault(userId);
    if (existing) {
      return; // Already initialized
    }

    // Default demo salt: 16 zero-padded bytes
    const demoSaltHex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    this.saveUserVault(userId, demoSaltHex);

    // Create folders
    const workDocs = this.createFolder(userId, 'Work Documents', null);
    const photos = this.createFolder(userId, 'Photos', null);
    const backups = this.createFolder(userId, 'Vault Backups', null);
    this.createFolder(userId, 'Q4 Financials', workDocs.id);

    // Seed sample files
    this.createFile(userId, {
      id: 'file_demo_1',
      folderId: workDocs.id,
      name: 'Q3_Project_Report.pdf',
      mimeType: 'application/pdf',
      totalSizeBytes: 3450000,
      chunkCount: 1,
    });

    this.createFile(userId, {
      id: 'file_demo_2',
      folderId: photos.id,
      name: 'mountain_sunset.jpg',
      mimeType: 'image/jpeg',
      totalSizeBytes: 4200000,
      chunkCount: 1,
    });

    this.createFile(userId, {
      id: 'file_demo_3',
      folderId: backups.id,
      name: 'system_keys_backup.json',
      mimeType: 'application/json',
      totalSizeBytes: 12500,
      chunkCount: 1,
    });

    this.createFile(userId, {
      id: 'file_demo_4',
      folderId: null, // Root file
      name: 'welcome_to_vaultcloud.md',
      mimeType: 'text/markdown',
      totalSizeBytes: 4500,
      chunkCount: 1,
    });
  }
}
