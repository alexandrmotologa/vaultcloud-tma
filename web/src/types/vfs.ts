export interface FolderItem {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  created_at: number;
}

export interface FileItem {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  mime_type: string;
  total_size_bytes: number;
  chunk_count: number;
  is_starred: number;
  is_trash: number;
  thumbnail_cipher_hex?: string | null;
  is_encrypted?: number;
  created_at: number;
  updated_at: number;
  chunks?: ChunkItem[];
}

export interface ChunkItem {
  id: string;
  file_id: string;
  chunk_index: number;
  telegram_file_id: string;
  size_bytes: number;
  sha256_hash: string;
  created_at: number;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface VaultStatusResponse {
  hasVault: boolean;
  saltHex: string | null;
  verificationCipherHex: string | null;
  demoMode: boolean;
  stats: {
    totalFiles: number;
    totalSizeBytes: number;
    folderCount: number;
  };
  inboxPendingCount?: number;
}

export interface UploadProgressItem {
  fileId: string;
  fileName: string;
  totalSize: number;
  chunkCount: number;
  currentChunk: number;
  phase: 'idle' | 'slicing' | 'encrypting' | 'uploading' | 'verifying' | 'completed' | 'error';
  progressPercent: number;
  errorMessage?: string;
}
