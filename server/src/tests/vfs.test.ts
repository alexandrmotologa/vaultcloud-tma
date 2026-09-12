import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { initSchema } from '../db/database.js';
import { VirtualFileSystem } from '../db/vfs.js';

describe('Server Virtual File System (VFS)', () => {
  let db: DatabaseSync;
  let vfs: VirtualFileSystem;
  const testUser = 'user_test_42';

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    initSchema(db);
    vfs = new VirtualFileSystem(db);
  });

  afterEach(() => {
    db.close();
  });

  it('manages user vault records and statistics', () => {
    expect(vfs.getUserVault(testUser)).toBeNull();

    const salt = '0123456789abcdef0123456789abcdef';
    vfs.saveUserVault(testUser, salt, 'verification_token_hex');

    const vault = vfs.getUserVault(testUser);
    expect(vault).not.toBeNull();
    expect(vault?.salt_hex).toBe(salt);
    expect(vault?.verification_cipher_hex).toBe('verification_token_hex');

    const stats = vfs.getVaultStats(testUser);
    expect(stats.totalFiles).toBe(0);
    expect(stats.folderCount).toBe(0);
  });

  it('handles folder hierarchy and breadcrumbs correctly', () => {
    const rootFolder = vfs.createFolder(testUser, 'Documents', null);
    expect(rootFolder.id).toBeDefined();
    expect(rootFolder.name).toBe('Documents');
    expect(rootFolder.parent_id).toBeNull();

    const subFolder = vfs.createFolder(testUser, 'Tax 2026', rootFolder.id);
    expect(subFolder.parent_id).toBe(rootFolder.id);

    // List root folders
    const rootList = vfs.listFolders(testUser, null);
    expect(rootList).toHaveLength(1);
    expect(rootList[0].name).toBe('Documents');

    // List subfolders
    const subList = vfs.listFolders(testUser, rootFolder.id);
    expect(subList).toHaveLength(1);
    expect(subList[0].name).toBe('Tax 2026');

    // Breadcrumbs
    const crumbs = vfs.getBreadcrumbs(testUser, subFolder.id);
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0].name).toBe('My Drive');
    expect(crumbs[1].name).toBe('Documents');
    expect(crumbs[2].name).toBe('Tax 2026');
  });

  it('creates, lists, stars, searches, and soft-deletes files', () => {
    const file = vfs.createFile(testUser, {
      name: 'invoice_march.pdf',
      mimeType: 'application/pdf',
      totalSizeBytes: 1048576,
      chunkCount: 1,
    });

    expect(file.id).toBeDefined();
    expect(file.is_starred).toBe(0);
    expect(file.is_trash).toBe(0);

    // List root files
    const rootFiles = vfs.listFiles(testUser, { folderId: null });
    expect(rootFiles).toHaveLength(1);
    expect(rootFiles[0].name).toBe('invoice_march.pdf');

    // Search files
    const searchMatch = vfs.listFiles(testUser, { search: 'invoice' });
    expect(searchMatch).toHaveLength(1);

    const searchMiss = vfs.listFiles(testUser, { search: 'unknown' });
    expect(searchMiss).toHaveLength(0);

    // Star file
    const starred = vfs.updateFile(testUser, file.id, { isStarred: true });
    expect(starred?.is_starred).toBe(1);

    const starList = vfs.listFiles(testUser, { starred: true });
    expect(starList).toHaveLength(1);

    // Soft delete (move to trash)
    vfs.updateFile(testUser, file.id, { isTrash: true });
    expect(vfs.listFiles(testUser, { folderId: null })).toHaveLength(0);

    const trashList = vfs.listFiles(testUser, { trash: true });
    expect(trashList).toHaveLength(1);
    expect(trashList[0].name).toBe('invoice_march.pdf');

    // Restore from trash
    vfs.updateFile(testUser, file.id, { isTrash: false });
    expect(vfs.listFiles(testUser, { folderId: null })).toHaveLength(1);
  });

  it('manages chunk manifests accurately', () => {
    const file = vfs.createFile(testUser, {
      name: 'large_archive.zip',
      mimeType: 'application/zip',
      totalSizeBytes: 20971520,
      chunkCount: 2,
    });

    vfs.addChunk({
      fileId: file.id,
      chunkIndex: 0,
      telegramFileId: 'tg_chk_0_abc',
      sizeBytes: 10485760,
      sha256Hash: 'hash0',
    });

    vfs.addChunk({
      fileId: file.id,
      chunkIndex: 1,
      telegramFileId: 'tg_chk_1_def',
      sizeBytes: 10485760,
      sha256Hash: 'hash1',
    });

    const fileWithChunks = vfs.getFile(testUser, file.id);
    expect(fileWithChunks).not.toBeNull();
    expect(fileWithChunks?.chunks).toHaveLength(2);
    expect(fileWithChunks?.chunks[0].chunk_index).toBe(0);
    expect(fileWithChunks?.chunks[1].chunk_index).toBe(1);
    expect(fileWithChunks?.chunks[0].telegram_file_id).toBe('tg_chk_0_abc');
  });

  it('cascades deletion properly when a folder is deleted', () => {
    const folder = vfs.createFolder(testUser, 'Project Beta');
    const file = vfs.createFile(testUser, {
      folderId: folder.id,
      name: 'notes.txt',
      mimeType: 'text/plain',
      totalSizeBytes: 500,
      chunkCount: 1,
    });

    vfs.deleteFolder(testUser, folder.id);

    expect(vfs.getFolder(testUser, folder.id)).toBeNull();
    expect(vfs.getFile(testUser, file.id)).toBeNull();
  });
});
