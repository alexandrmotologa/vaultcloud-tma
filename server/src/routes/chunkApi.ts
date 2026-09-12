import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VirtualFileSystem } from '../db/vfs.js';
import { IStorageAdapter } from '../storage/storageAdapter.js';

export function registerChunkRoutes(
  fastify: FastifyInstance,
  vfs: VirtualFileSystem,
  storage: IStorageAdapter
): void {
  // Upload encrypted chunk
  fastify.post('/api/chunks/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const parts = request.parts();
    let fileId = '';
    let chunkIndex = 0;
    let sha256Hash = '';
    let chunkBuffer: Buffer | null = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        chunkBuffer = await part.toBuffer();
      } else {
        if (part.fieldname === 'fileId') fileId = String(part.value);
        if (part.fieldname === 'chunkIndex') chunkIndex = parseInt(String(part.value), 10);
        if (part.fieldname === 'sha256Hash') sha256Hash = String(part.value);
      }
    }

    if (!fileId || !chunkBuffer) {
      return reply.status(400).send({ error: 'Missing fileId or chunk file data' });
    }

    // Forward to storage adapter (Telegram Bot API or Mock Storage)
    const result = await storage.saveChunk(fileId, chunkIndex, chunkBuffer);

    // Record chunk in SQLite VFS
    const chunkRecord = vfs.addChunk({
      fileId,
      chunkIndex,
      telegramFileId: result.telegramFileId,
      sizeBytes: result.sizeBytes,
      sha256Hash: sha256Hash || '',
    });

    return {
      success: true,
      chunk: chunkRecord,
    };
  });

  // Download encrypted chunk by fileId and chunkIndex
  fastify.get('/api/chunks/:fileId/:chunkIndex', async (request: FastifyRequest<{
    Params: { fileId: string; chunkIndex: string };
  }>, reply: FastifyReply) => {
    const { fileId, chunkIndex } = request.params;
    const indexNum = parseInt(chunkIndex, 10);

    const chunks = vfs.getChunks(fileId);
    const chunkRecord = chunks.find((c) => c.chunk_index === indexNum);

    if (!chunkRecord) {
      return reply.status(404).send({ error: 'Chunk record not found' });
    }

    try {
      const buffer = await storage.getChunk(chunkRecord.telegram_file_id);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Length', buffer.length);
      reply.header('X-Sha256-Hash', chunkRecord.sha256_hash);
      return reply.send(buffer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Storage retrieval failed';
      return reply.status(502).send({ error: `Failed to retrieve chunk from storage: ${message}` });
    }
  });
}
