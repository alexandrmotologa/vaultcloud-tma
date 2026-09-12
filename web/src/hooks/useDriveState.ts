import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import JSZip from 'jszip';
import { FolderItem, FileItem, BreadcrumbItem, VaultStatusResponse, UploadProgressItem } from '../types/vfs';
import { deriveKey, hexToSalt, saltToHex, generateSalt } from '../crypto/keyDerivation';
import { encryptChunk, decryptChunk, sliceFileIntoChunks, reassembleFile } from '../crypto/chunkCrypt';
import { createVerificationCipher, verifyPassphraseKey } from '../crypto/keyBackup';
import { generateEncryptedThumbnail } from '../crypto/thumbnail';
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

  // Multi-File Selection State
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Inactivity & PIN Lock State
  const [isPinLocked, setIsPinLocked] = useState(false);
  const [pinCode, setPinCode] = useState<string | null>(() => localStorage.getItem('vaultcloud_pin') || null);
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(() => {
    const saved = localStorage.getItem('vaultcloud_autolock');
    return saved ? parseInt(saved, 10) || 5 : 5;
  });
  const lastActiveRef = useRef<number>(Date.now());

  // Inbox Ingestion State
  const [isEncryptingInbox, setIsEncryptingInbox] = useState(false);

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

  // Clear selection on folder navigation or tab switch
  useEffect(() => {
    setSelectedFileIds([]);
  }, [currentFolderId, activeTab]);

  // Inactivity auto-lock listener
  useEffect(() => {
    if (!isUnlocked) return;

    const resetTimer = () => {
      lastActiveRef.current = Date.now();
    };

    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('click', resetTimer, { passive: true });

    const interval = setInterval(() => {
      const inactiveMs = Date.now() - lastActiveRef.current;
      const thresholdMs = autoLockMinutes * 60 * 1000;

      if (inactiveMs >= thresholdMs) {
        if (pinCode) {
          setIsPinLocked(true);
        } else {
          setMasterKey(null);
          setIsUnlocked(false);
        }
        showToast('Session locked due to inactivity.', false);
      }
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('click', resetTimer);
      clearInterval(interval);
    };
  }, [isUnlocked, autoLockMinutes, pinCode, showToast]);

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

      if (vaultStatus?.verificationCipherHex) {
        const isValid = await verifyPassphraseKey(vaultStatus.verificationCipherHex, derivedKey);
        if (!isValid) {
          showToast('Incorrect master passphrase. Authentication tag failed.', true);
          return false;
        }
      }

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
        setIsPinLocked(false);
      });

      lastActiveRef.current = Date.now();
      haptics.notification('success');
      showToast('Vault unlocked with zero-knowledge master key.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unlock error';
      showToast(msg, true);
      return false;
    }
  }, [vaultStatus, apiFetch, refreshVaultStatus, showToast, haptics]);

  // Lock Vault Completely
  const lockVault = useCallback(() => {
    setMasterKey(null);
    setIsUnlocked(false);
    setIsPinLocked(false);
    setSelectedFileIds([]);
    haptics.impact('medium');
    showToast('Vault locked. Cryptographic keys purged from memory.');
  }, [haptics, showToast]);

  // Quick PIN lock
  const lockWithPin = useCallback(() => {
    if (!pinCode) {
      lockVault();
      return;
    }
    setIsPinLocked(true);
    haptics.impact('light');
    showToast('Vault quick-locked with PIN.');
  }, [pinCode, lockVault, haptics, showToast]);

  const unlockWithPin = useCallback((enteredPin: string): boolean => {
    if (enteredPin === pinCode) {
      setIsPinLocked(false);
      lastActiveRef.current = Date.now();
      haptics.notification('success');
      showToast('Quick PIN verified.');
      return true;
    }
    haptics.notification('error');
    return false;
  }, [pinCode, haptics, showToast]);

  const setPin = useCallback((newPin: string | null) => {
    if (newPin) {
      localStorage.setItem('vaultcloud_pin', newPin);
      setPinCode(newPin);
      showToast('Quick PIN set successfully.');
    } else {
      localStorage.removeItem('vaultcloud_pin');
      setPinCode(null);
      showToast('Quick PIN disabled.');
    }
    haptics.selection();
  }, [haptics, showToast]);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    localStorage.setItem('vaultcloud_autolock', minutes.toString());
    setAutoLockMinutesState(minutes);
    showToast(`Auto-lock interval set to ${minutes} minute${minutes > 1 ? 's' : ''}.`);
  }, [showToast]);

  // Selection handlers
  const toggleSelectFile = useCallback((fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
    haptics.selection();
  }, [haptics]);

  const selectAllFiles = useCallback(() => {
    setSelectedFileIds(files.map((f) => f.id));
    haptics.selection();
  }, [files, haptics]);

  const clearSelection = useCallback(() => {
    setSelectedFileIds([]);
  }, []);

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

  // Upload File with Client-Side Chunking, Thumbnails & Encryption
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
      // Generate client-side thumbnail if image
      let thumbnailCipherHex: string | null = null;
      if (file.type.startsWith('image/')) {
        try {
          thumbnailCipherHex = await generateEncryptedThumbnail(file, masterKey);
        } catch (thumbErr) {
          console.warn('Thumbnail generation skipped:', thumbErr);
        }
      }

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
          thumbnailCipherHex,
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

    const fileRes = await apiFetch(`/api/vfs/files/${fileItem.id}`);
    if (!fileRes.ok) throw new Error('File manifest not found');
    const fileWithChunks: FileItem = await fileRes.json();

    const chunkRecords = fileWithChunks.chunks || [];
    if (chunkRecords.length === 0) {
      return new Blob(['Demo unencrypted preview content'], { type: fileItem.mime_type });
    }

    const decryptedChunks: ArrayBuffer[] = [];

    for (const chunk of chunkRecords) {
      const chunkRes = await apiFetch(`/api/chunks/${fileItem.id}/${chunk.chunk_index}`);
      if (!chunkRes.ok) {
        throw new Error(`Failed to fetch chunk ${chunk.chunk_index}`);
      }
      const encryptedBuffer = await chunkRes.arrayBuffer();

      if (encryptedBuffer.byteLength < 12) {
        decryptedChunks.push(encryptedBuffer);
        continue;
      }

      try {
        const decrypted = await decryptChunk(encryptedBuffer, masterKey);
        decryptedChunks.push(decrypted);
      } catch {
        decryptedChunks.push(encryptedBuffer);
      }
    }

    return reassembleFile(decryptedChunks, fileItem.mime_type);
  }, [masterKey, apiFetch]);

  // Save Encrypted Markdown Note
  const saveEncryptedNote = useCallback(async (
    title: string,
    content: string,
    existingFileId?: string
  ) => {
    if (!masterKey) {
      showToast('Vault is locked', true);
      return;
    }

    try {
      const encoder = new TextEncoder();
      const contentBuffer = encoder.encode(content).buffer;
      const encrypted = await encryptChunk(contentBuffer, masterKey);
      const noteFileId = existingFileId || `note_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      if (!existingFileId) {
        const createRes = await apiFetch('/api/vfs/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: noteFileId,
            folderId: currentFolderId,
            name: title,
            mimeType: 'text/markdown',
            totalSizeBytes: contentBuffer.byteLength,
            chunkCount: 1,
          }),
        });
        if (!createRes.ok) throw new Error('Failed to create note record');
      } else {
        await apiFetch(`/api/vfs/files/${existingFileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: title }),
        });
      }

      const formData = new FormData();
      formData.append('fileId', noteFileId);
      formData.append('chunkIndex', '0');
      formData.append('sha256Hash', encrypted.cipherHashHex);
      const chunkBlob = new Blob([encrypted.chunkBufferWithIv], { type: 'application/octet-stream' });
      formData.append('chunk', chunkBlob, 'note_chunk_0.enc');

      const uploadRes = await apiFetch('/api/chunks/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Failed to upload encrypted note');

      haptics.notification('success');
      showToast(`Note "${title}" saved and encrypted.`);
      await refreshItems();
      await refreshVaultStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save note';
      showToast(msg, true);
    }
  }, [masterKey, currentFolderId, apiFetch, refreshItems, refreshVaultStatus, showToast, haptics]);

  // Batch Operations
  const handleBatchTrash = useCallback(async (fileIds: string[], isTrash: boolean) => {
    try {
      const res = await apiFetch('/api/vfs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isTrash ? 'trash' : 'restore',
          fileIds,
        }),
      });
      if (!res.ok) throw new Error('Batch operation failed');
      setSelectedFileIds([]);
      showToast(`${fileIds.length} item(s) ${isTrash ? 'moved to Trash' : 'restored'}.`);
      await refreshItems();
      await refreshVaultStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch trash error';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, refreshVaultStatus, showToast]);

  const handleBatchStar = useCallback(async (fileIds: string[], isStarred: boolean) => {
    try {
      const res = await apiFetch('/api/vfs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isStarred ? 'star' : 'unstar',
          fileIds,
        }),
      });
      if (!res.ok) throw new Error('Batch star failed');
      setSelectedFileIds([]);
      showToast(`${fileIds.length} item(s) ${isStarred ? 'starred' : 'unstarred'}.`);
      await refreshItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch star error';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, showToast]);

  const handleBatchMove = useCallback(async (fileIds: string[], targetFolderId: string | null) => {
    try {
      const res = await apiFetch('/api/vfs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          fileIds,
          targetFolderId,
        }),
      });
      if (!res.ok) throw new Error('Batch move failed');
      setSelectedFileIds([]);
      showToast(`${fileIds.length} item(s) moved.`);
      await refreshItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch move error';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, showToast]);

  const handleBatchPurge = useCallback(async (fileIds: string[]) => {
    try {
      const res = await apiFetch('/api/vfs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purge',
          fileIds,
        }),
      });
      if (!res.ok) throw new Error('Batch purge failed');
      setSelectedFileIds([]);
      showToast(`${fileIds.length} item(s) permanently deleted.`);
      await refreshItems();
      await refreshVaultStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch purge error';
      showToast(msg, true);
    }
  }, [apiFetch, refreshItems, refreshVaultStatus, showToast]);

  // Download selected files as in-memory decrypted ZIP
  const handleDownloadBatchZip = useCallback(async (fileIds: string[]) => {
    if (!masterKey) return;
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      const filesToDownload = files.filter((f) => fileIds.includes(f.id));

      for (const fileItem of filesToDownload) {
        try {
          const blob = await decryptAndDownloadFile(fileItem);
          zip.file(fileItem.name, blob);
        } catch (fileErr) {
          console.error(`Failed to decrypt file ${fileItem.name} for zip:`, fileErr);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaultcloud_selection_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`ZIP archive of ${filesToDownload.length} files generated and downloaded.`);
      setSelectedFileIds([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ZIP generation failed';
      showToast(msg, true);
    } finally {
      setIsDownloadingZip(false);
    }
  }, [masterKey, files, decryptAndDownloadFile, showToast]);

  // Full Vault Export & Disaster Recovery Archive
  const exportFullVaultZip = useCallback(async () => {
    if (!masterKey) {
      showToast('Unlock vault before exporting', true);
      return;
    }

    showToast('Preparing full vault export archive...');
    try {
      const res = await apiFetch('/api/vfs/files');
      if (!res.ok) throw new Error('Failed to retrieve file list for export');
      const data = await res.json();
      const allFiles: FileItem[] = data.files || [];

      const nonTrashFiles = allFiles.filter((f) => f.is_trash === 0);
      const zip = new JSZip();

      const manifestData = {
        exportedAt: new Date().toISOString(),
        totalFiles: nonTrashFiles.length,
        version: '1.0.0',
        files: nonTrashFiles.map((f) => ({
          name: f.name,
          sizeBytes: f.total_size_bytes,
          mimeType: f.mime_type,
          createdAt: f.created_at,
        })),
      };

      zip.file('vaultcloud_manifest.json', JSON.stringify(manifestData, null, 2));

      for (const f of nonTrashFiles) {
        try {
          const blob = await decryptAndDownloadFile(f);
          zip.file(f.name, blob);
        } catch (fErr) {
          console.warn(`Could not export file ${f.name}:`, fErr);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaultcloud_full_backup_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Full vault backup successfully downloaded!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      showToast(msg, true);
    }
  }, [masterKey, apiFetch, decryptAndDownloadFile, showToast]);

  // Vault Inbox Files (Ingest unencrypted files sent to bot)
  const vaultInboxFiles = useCallback(async () => {
    if (!masterKey) return;
    setIsEncryptingInbox(true);
    try {
      const inboxRes = await apiFetch('/api/vfs/inbox');
      if (!inboxRes.ok) throw new Error('Failed to fetch inbox files');
      const inboxData = await inboxRes.json();
      const inboxFiles: FileItem[] = inboxData.files || [];

      for (const item of inboxFiles) {
        const chunkRes = await apiFetch(`/api/chunks/${item.id}/0`);
        if (!chunkRes.ok) continue;
        const rawBuf = await chunkRes.arrayBuffer();

        const encrypted = await encryptChunk(rawBuf, masterKey);

        const formData = new FormData();
        formData.append('fileId', item.id);
        formData.append('chunkIndex', '0');
        formData.append('sha256Hash', encrypted.cipherHashHex);
        const chunkBlob = new Blob([encrypted.chunkBufferWithIv], { type: 'application/octet-stream' });
        formData.append('chunk', chunkBlob, 'chunk_0.enc');

        await apiFetch('/api/chunks/upload', {
          method: 'POST',
          body: formData,
        });

        await apiFetch('/api/vfs/inbox/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: item.id,
            totalSizeBytes: rawBuf.byteLength,
            chunkCount: 1,
          }),
        });
      }

      haptics.notification('success');
      showToast(`Encrypted and vaulted ${inboxFiles.length} file(s) from Telegram inbox.`);
      await refreshItems();
      await refreshVaultStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Inbox vaulting failed';
      showToast(msg, true);
    } finally {
      setIsEncryptingInbox(false);
    }
  }, [masterKey, apiFetch, refreshItems, refreshVaultStatus, showToast, haptics]);

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

    // PIN Lock & Inactivity
    isPinLocked,
    hasPin: Boolean(pinCode),
    autoLockMinutes,
    unlockWithPin,
    setPin,
    setAutoLockMinutes,
    lockWithPin,

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

    // Multi-File Selection
    selectedFileIds,
    toggleSelectFile,
    selectAllFiles,
    clearSelection,
    isDownloadingZip,
    handleBatchTrash,
    handleBatchStar,
    handleBatchMove,
    handleBatchPurge,
    handleDownloadBatchZip,

    // Actions
    createFolder,
    deleteFolder,
    uploadFile,
    decryptAndDownloadFile,
    saveEncryptedNote,
    exportFullVaultZip,
    toggleStar,
    toggleTrash,
    purgeFile,
    renameFile,

    // Inbox Ingestion
    vaultInboxFiles,
    isEncryptingInbox,

    // UI Progress & Toasts
    uploadProgress,
    errorToast,
    successToast,
  };
}
