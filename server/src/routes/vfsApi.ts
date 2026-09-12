import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VirtualFileSystem } from '../db/vfs.js';
import { authenticate } from '../security/auth.js';
import { config } from '../config.js';

export function registerVfsRoutes(fastify: FastifyInstance, vfs: VirtualFileSystem): void {
  // Add authentication hook to all /api/ routes
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      await authenticate(request, reply);
    }
  });

  // --- Vault Endpoints ---

  fastify.get('/api/vault/status', async (request: FastifyRequest, _reply: FastifyReply) => {
    const userId = request.auth!.userId;
    const vault = vfs.getUserVault(userId);
    const stats = vfs.getVaultStats(userId);

    return {
      hasVault: Boolean(vault),
      saltHex: vault?.salt_hex || null,
      verificationCipherHex: vault?.verification_cipher_hex || null,
      demoMode: config.demoMode,
      stats,
    };
  });

  fastify.post('/api/vault/init', async (request: FastifyRequest<{
    Body: { saltHex: string; verificationCipherHex?: string };
  }>, reply: FastifyReply) => {
    const userId = request.auth!.userId;
    const { saltHex, verificationCipherHex } = request.body || {};

    if (!saltHex || saltHex.length !== 32) {
      return reply.status(400).send({ error: 'Valid 16-byte hex salt is required (32 hex characters)' });
    }

    vfs.saveUserVault(userId, saltHex, verificationCipherHex);
    return { success: true, saltHex };
  });

  // --- Folder Endpoints ---

  fastify.get('/api/vfs/folders', async (request: FastifyRequest<{
    Querystring: { parentId?: string };
  }>) => {
    const userId = request.auth!.userId;
    const parentId = request.query.parentId || null;
    const folders = vfs.listFolders(userId, parentId);
    const breadcrumbs = vfs.getBreadcrumbs(userId, parentId);

    return {
      folders,
      breadcrumbs,
    };
  });

  fastify.post('/api/vfs/folders', async (request: FastifyRequest<{
    Body: { name: string; parentId?: string | null };
  }>, reply: FastifyReply) => {
    const userId = request.auth!.userId;
    const { name, parentId } = request.body || {};

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Folder name is required' });
    }

    const folder = vfs.createFolder(userId, name.trim(), parentId);
    return { success: true, folder };
  });

  fastify.delete('/api/vfs/folders/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>) => {
    const userId = request.auth!.userId;
    vfs.deleteFolder(userId, request.params.id);
    return { success: true };
  });

  // --- File Endpoints ---

  fastify.get('/api/vfs/files', async (request: FastifyRequest<{
    Querystring: {
      folderId?: string;
      starred?: string;
      trash?: string;
      search?: string;
    };
  }>) => {
    const userId = request.auth!.userId;
    const { folderId, starred, trash, search } = request.query;

    const files = vfs.listFiles(userId, {
      folderId: folderId || null,
      starred: starred === 'true',
      trash: trash === 'true',
      search: search || undefined,
    });

    return { files };
  });

  fastify.get('/api/vfs/files/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const userId = request.auth!.userId;
    const file = vfs.getFile(userId, request.params.id);
    if (!file) {
      return reply.status(404).send({ error: 'File not found' });
    }
    return file;
  });

  fastify.post('/api/vfs/files', async (request: FastifyRequest<{
    Body: {
      id?: string;
      folderId?: string | null;
      name: string;
      mimeType: string;
      totalSizeBytes: number;
      chunkCount: number;
    };
  }>, reply: FastifyReply) => {
    const userId = request.auth!.userId;
    const { id, folderId, name, mimeType, totalSizeBytes, chunkCount } = request.body || {};

    if (!name || totalSizeBytes === undefined || chunkCount === undefined) {
      return reply.status(400).send({ error: 'Missing required file fields' });
    }

    const file = vfs.createFile(userId, {
      id,
      folderId,
      name,
      mimeType: mimeType || 'application/octet-stream',
      totalSizeBytes,
      chunkCount,
    });

    return { success: true, file };
  });

  fastify.patch('/api/vfs/files/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      name?: string;
      folderId?: string | null;
      isStarred?: boolean;
      isTrash?: boolean;
    };
  }>, reply: FastifyReply) => {
    const userId = request.auth!.userId;
    const updated = vfs.updateFile(userId, request.params.id, request.body || {});
    if (!updated) {
      return reply.status(404).send({ error: 'File not found' });
    }
    return { success: true, file: updated };
  });

  fastify.delete('/api/vfs/files/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>) => {
    const userId = request.auth!.userId;
    vfs.deleteFile(userId, request.params.id);
    return { success: true };
  });
}
