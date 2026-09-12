export interface SaveChunkResult {
  telegramFileId: string;
  sizeBytes: number;
}

export interface IStorageAdapter {
  saveChunk(fileId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<SaveChunkResult>;
  getChunk(telegramFileId: string): Promise<Buffer>;
  deleteChunk(telegramFileId: string): Promise<void>;
}
