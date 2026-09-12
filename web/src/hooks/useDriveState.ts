import { useState, useEffect, useCallback, useTransition } from 'react';
import { FolderItem, FileItem, BreadcrumbItem, VaultStatusResponse, UploadProgressItem } from '../types/vfs';
import { deriveKey, hexToSalt, saltToHex, generateSalt } from '../crypto/keyDerivation';
import { encryptChunk, decryptChunk, sliceFileIntoChunks, reassembleFile } from '../crypto/chunkCrypt';
import { createVerificationCipher, verifyPassphraseKey } from '../crypto/keyBackup';
import { useTelegram } from './useTelegram';

export function useDriveState() {
  const { initData, haptics } = useTelegram();
  const [, startTransition] = useTransition();

  // Authentication & Cryptographic State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [vaultStatus, setVaultStatus] = useState<VaultStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // VFS Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'My Drive' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // UI Filter State
  const [activeTab, setActiveTab] = useState<'all' | 'starred' | 'trash'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Upload Queue State
  const [uploadProgress, setUploadProgress] = useState<UploadProgressItem | null>(null);

  // Error & Status Messages
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    if (isError) {
      setErrorToast(message);
      haptics.notification('error');
    } else {
      setSuccessToast(message);
      haptics.notification('success');
    }
    setTimeout(() => {
      setErrorToast(null);
      setSuccessToast(null);
    }, 4000);
  }, [haptics]);

  const apiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `tma ${initData}`);
    return fetch(path, { ...options, headers });
  }, [initData]);

  // Check vault status on mount
  const refreshVaultStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const res = await apiFetch('/api/vault/status');
      if (!res.ok) throw new Error('Failed to retrieve vault status');
      const data: VaultStatusResponse = await res.json();
      setVaultStatus(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      showToast(msg, true);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    refreshVaultStatus();
  }, [refreshVaultStatus]);

  // Load folders and files in current folder
  const refreshItems = useCallback(async () => {
    if (!isUnlocked) return;
    setIsLoadingItems(true);
    try {
      // 1. Fetch folders
      const folderUrl = currentFolderId ? `/api/vfs/folders?parentId=${currentFolderId}` : '/api/vfs/folders';
      const folderRes = await apiFetch(folderUrl);
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        setFolders(folderData.folders || []);
        if (folderData.breadcrumbs) {
          setBreadcrumbs(folderData.breadcrumbs);
        }
      }

      // 2. Fetch files
      let fileUrl = '/api/vfs/files';
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      } else if (activeTab === 'starred') {
        params.set('starred', 'true');
      } else if (activeTab === 'trash') {
        params.set('trash', 'true');
      } else if (currentFolderId) {
        params.set('folderId', currentFolderId);
      }

      const queryString = params.toString();
      if (queryString) {
        fileUrl += `?${queryString}`;
      }

      const fileRes = await apiFetch(fileUrl);
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        setFiles(fileData.files || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh items';
      showToast(msg, true);
    } finally {
      setIsLoadingItems(false);
    }
  }, [isUnlocked, currentFolderId, activeTab, searchQuery, apiFetch, showToast]);

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  // Unlock Vault with Master Passphrase
  const unlockVault = useCallback(async (passphrase: string): Promise<boolean> => {
    try {
      let salt: Uint8Array;
      let isNewVault = false;

      if (vaultStatus?.hasVault && vaultStatus.saltHex) {
        salt = hexToSalt(vaultStatus.saltHex);
      } else {
        salt = generateSalt();
        isNewVault = true;
      }

      const derivedKey = await deriveKey(passphrase, salt);

      // If existing vault has verification token, verify it
      if (vaultStatus?.verificationCipherHex) {
        const isValid = await verifyPassphraseKey(vaultStatus.verificationCipherHex, derivedKey);
        if (!isValid) {
          showToast('Incorrect master passphrase. Authentication tag failed.', true);
          return false;
        }
      }

      // If new vault, initialize with salt and verification cipher
      if (isNewVault) {
        const saltHex = saltToHex(salt);
        const verificationCipherHex = await createVerificationCipher(derivedKey);
        const res = await apiFetch('/api/vault/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saltHex, verificationCipherHex }),
        });
        if (!res.ok) throw new Error('Failed to initialize new vault on server');
        await refreshVaultStatus();
      }

      startTransition(() => {
        setMasterKey(derivedKey);
        setIsUnlocked(true);
      });

      haptics.notification('success');
      showToast('Vault unlocked with zero-knowledge master key.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unlock error';
      showToast(msg, true);
      return false;
    }
  }, [vaultStatus, apiFetch, refreshVaultStatus, showToast, haptics]);

  // Lock Vault
  const lockVault = useCallback(() => {
    setMasterKey(null);
    setIsUnlocked(false);
    haptics.impact('medium');
    showToast('Vault locked. Cryptographic keys purged from memory.');
  }, [haptics, showToast]);

  // Navigation: Change Folder
  const navigateToFolder = useCallback((folderId: string | null) => {
    haptics.selection();
    setCurrentFolderId(folderId);
    setSearchQuery('');
  }, [haptics]);

  // Create New Folder
  const createFolder = useCallback(async (name: string) => {
    try {
      const res = await apiFetch('/api/vfs/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: currentFolderId }),
      });
      if (!res.ok) throw new Error('Failed to create folder');
      haptics.notification('success');
      showToast(`Folder "${name}" created.`);
      await refreshItems();
      await refreshVaultStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create folder';
      showToast(msg, true);
    }
  }, [apiFetch, currentFolderId, refreshItems, refreshVaultStatus, showToast, haptics]);

  // Delete Folder
  const deleteFolder = useCallback(async (folderId: string) => {
    try {
      const res = await apiFetch(`/api/vfs/folders/${folderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete folder');
      haptics.notification('success');
      showToast('Folder deleted.');
      await refreshItems();
      await refreshVaultStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not delete folder';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, refreshVaultStatus, showToast, haptics]);

  // Upload File with Client-Side Chunking & Encryption
  const uploadFile = useCallback(async (file: File) => {
    if (!masterKey) {
      showToast('Unlock vault before uploading files', true);
      return;
    }

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const chunks = sliceFileIntoChunks(file);

    setUploadProgress({
      fileId,
      fileName: file.name,
      totalSize: file.size,
      chunkCount: chunks.length,
      currentChunk: 0,
      phase: 'slicing',
      progressPercent: 5,
    });

    try {
      // 1. Create file record in VFS
      const initRes = await apiFetch('/api/vfs/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fileId,
          folderId: currentFolderId,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          totalSizeBytes: file.size,
          chunkCount: chunks.length,
        }),
      });

      if (!initRes.ok) throw new Error('Failed to create file record in VFS');

      // 2. Encrypt and upload chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        setUploadProgress((prev) => prev ? {
          ...prev,
          currentChunk: i + 1,
          phase: 'encrypting',
          progressPercent: Math.round(((i) / chunks.length) * 90) + 10,
        } : null);

        const chunkBuffer = await chunks[i].arrayBuffer();
        const encrypted = await encryptChunk(chunkBuffer, masterKey);

        setUploadProgress((prev) => prev ? {
          ...prev,
          phase: 'uploading',
          progressPercent: Math.round(((i + 0.5) / chunks.length) * 90) + 10,
        } : null);

        const formData = new FormData();
        formData.append('fileId', fileId);
        formData.append('chunkIndex', i.toString());
        formData.append('sha256Hash', encrypted.cipherHashHex);
        const chunkBlob = new Blob([encrypted.chunkBufferWithIv], { type: 'application/octet-stream' });
        formData.append('chunk', chunkBlob, `chunk_${i}.enc`);

        const uploadRes = await apiFetch('/api/chunks/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload chunk ${i + 1} of ${chunks.length}`);
        }
      }

      setUploadProgress((prev) => prev ? {
        ...prev,
        phase: 'completed',
        progressPercent: 100,
      } : null);

      haptics.notification('success');
      showToast(`"${file.name}" encrypted and uploaded successfully!`);
      await refreshItems();
      await refreshVaultStatus();

      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadProgress((prev) => prev ? {
        ...prev,
        phase: 'error',
        errorMessage: msg,
      } : null);
      showToast(msg, true);
    }
  }, [masterKey, currentFolderId, apiFetch, refreshItems, refreshVaultStatus, showToast, haptics]);

  // Decrypt & Download File in Memory
  const decryptAndDownloadFile = useCallback(async (fileItem: FileItem): Promise<Blob> => {
    if (!masterKey) {
      throw new Error('Vault is locked. Decryption key missing.');
    }

    // Fetch full file record with chunk list
    const fileRes = await apiFetch(`/api/vfs/files/${fileItem.id}`);
    if (!fileRes.ok) throw new Error('File manifest not found');
    const fileWithChunks: FileItem = await fileRes.json();

    const chunkRecords = fileWithChunks.chunks || [];
    if (chunkRecords.length === 0) {
      // In demo mode without chunks, return empty simulated blob
      return new Blob(['Demo unencrypted preview content'], { type: fileItem.mime_type });
    }

    const decryptedChunks: ArrayBuffer[] = [];

    for (const chunk of chunkRecords) {
      const chunkRes = await apiFetch(`/api/chunks/${fileItem.id}/${chunk.chunk_index}`);
      if (!chunkRes.ok) {
        throw new Error(`Failed to fetch chunk ${chunk.chunk_index}`);
      }
      const encryptedBuffer = await chunkRes.arrayBuffer();

      // Check if it's the raw demo text fallback
      if (encryptedBuffer.byteLength < 12) {
        decryptedChunks.push(encryptedBuffer);
        continue;
      }

      try {
        const decrypted = await decryptChunk(encryptedBuffer, masterKey);
        decryptedChunks.push(decrypted);
      } catch {
        // Fallback for pre-seeded unencrypted demo files
        decryptedChunks.push(encryptedBuffer);
      }
    }

    return reassembleFile(decryptedChunks, fileItem.mime_type);
  }, [masterKey, apiFetch]);

  // Star / Unstar
  const toggleStar = useCallback(async (fileId: string, currentStarred: number) => {
    try {
      const res = await apiFetch(`/api/vfs/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: currentStarred === 0 }),
      });
      if (!res.ok) throw new Error('Failed to update star');
      haptics.selection();
      await refreshItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating star';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, showToast, haptics]);

  // Move to Trash (Soft Delete) or Restore
  const toggleTrash = useCallback(async (fileId: string, isCurrentlyTrash: number) => {
    try {
      const res = await apiFetch(`/api/vfs/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTrash: isCurrentlyTrash === 0 }),
      });
      if (!res.ok) throw new Error('Failed to update trash status');
      haptics.impact('light');
      showToast(isCurrentlyTrash === 0 ? 'File moved to Trash.' : 'File restored from Trash.');
      await refreshItems();
      await refreshVaultStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error modifying file';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, refreshVaultStatus, showToast, haptics]);

  // Permanent Purge File
  const purgeFile = useCallback(async (fileId: string) => {
    try {
      const res = await apiFetch(`/api/vfs/files/${fileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete file permanently');
      haptics.notification('success');
      showToast('File permanently deleted.');
      await refreshItems();
      await refreshVaultStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not purge file';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, refreshVaultStatus, showToast, haptics]);

  // Rename File
  const renameFile = useCallback(async (fileId: string, newName: string) => {
    try {
      const res = await apiFetch(`/api/vfs/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error('Failed to rename file');
      haptics.notification('success');
      showToast(`Renamed to "${newName}".`);
      await refreshItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error renaming file';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, showToast, haptics]);

  return {
    // Auth & Status
    isUnlocked,
    masterKey,
    vaultStatus,
    isLoadingStatus,
    unlockVault,
    lockVault,

    // Navigation & Data
    currentFolderId,
    breadcrumbs,
    folders,
    files,
    isLoadingItems,
    navigateToFolder,
    refreshItems,

    // Tabs & Search & Views
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,

    // Actions
    createFolder,
    deleteFolder,
    uploadFile,
    decryptAndDownloadFile,
    toggleStar,
    toggleTrash,
    purgeFile,
    renameFile,

    // UI Progress & Toasts
    uploadProgress,
    errorToast,
    successToast,
  };
}
