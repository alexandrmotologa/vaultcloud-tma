import { IStorageAdapter, SaveChunkResult } from './storageAdapter.js';

export class MockStorageAdapter implements IStorageAdapter {
  private chunks: Map<string, Buffer> = new Map();

  constructor() {
    this.seedDemoChunks();
  }

  async saveChunk(fileId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<SaveChunkResult> {
    const telegramFileId = `mock_tg_${fileId}_chk${chunkIndex}_${Date.now()}`;
    this.chunks.set(telegramFileId, Buffer.from(chunkBuffer));
    return {
      telegramFileId,
      sizeBytes: chunkBuffer.length,
    };
  }

  async getChunk(telegramFileId: string): Promise<Buffer> {
    const chunk = this.chunks.get(telegramFileId);
    if (!chunk) {
      // If requested file is a seeded demo without stored chunk, return simulated encrypted payload
      return Buffer.from('MOCK_ENCRYPTED_TELEGRAM_CHUNK_PAYLOAD');
    }
    return chunk;
  }

  async deleteChunk(telegramFileId: string): Promise<void> {
    this.chunks.delete(telegramFileId);
  }

  private seedDemoChunks(): void {
    // Demo seed chunks for initial showcase
    const welcomeDocText = `# Welcome to VaultCloud TMA!

VaultCloud transforms your Telegram into a zero-knowledge encrypted personal cloud drive.

### Key Highlights:
- **Zero-Knowledge Architecture:** AES-GCM-256 client-side encryption.
- **Hierarchical Folders:** Full folder trees, breadcrumbs, search, and trash bin.
- **Unlimited Telegram Cloud:** Chunks up to 2GB per file stored directly in private Telegram storage.
- **Memory-Only Previews:** View photos, audio, videos, and PDFs without temporary plaintext files on disk.

Enjoy complete privacy and unlimited storage!
`;
    this.chunks.set('mock_tg_welcome_0', Buffer.from(welcomeDocText));
  }
}
