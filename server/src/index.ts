import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';

import { config } from './config.js';
import { getDatabase, closeDatabase } from './db/database.js';
import { VirtualFileSystem } from './db/vfs.js';
import { IStorageAdapter } from './storage/storageAdapter.js';
import { MockStorageAdapter } from './storage/mockStorage.js';
import { TelegramRelayAdapter } from './storage/telegramRelay.js';
import { createTelegramBot } from './bot/bot.js';
import { registerVfsRoutes } from './routes/vfsApi.js';
import { registerChunkRoutes } from './routes/chunkApi.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Multipart uploads (up to 25MB chunks)
  await fastify.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1,
    },
  });

  // Database and Virtual File System
  const db = getDatabase();
  const vfs = new VirtualFileSystem(db);

  // Storage Adapter
  let storage: IStorageAdapter;
  if (config.demoMode) {
    console.log('[Storage] Initializing In-Memory MockStorageAdapter (DEMO_MODE=true)');
    storage = new MockStorageAdapter();
    vfs.seedDemoData('user_10001');
  } else {
    console.log('[Storage] Initializing TelegramRelayAdapter');
    const bot = createTelegramBot(vfs);
    if (!bot) {
      throw new Error('Telegram bot initialization failed with provided token');
    }
    storage = new TelegramRelayAdapter(bot);

    // Start bot long polling
    bot.start({
      onStart: (info) => console.log(`[Bot] Started polling as @${info.username}`),
    }).catch((err) => console.error('[Bot] Polling error:', err));
  }

  // Register API routes
  registerVfsRoutes(fastify, vfs);
  registerChunkRoutes(fastify, vfs, storage);

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    demoMode: config.demoMode,
    timestamp: Date.now(),
  }));

  // Static web frontend
  const webDistPath = path.resolve(process.cwd(), 'web/dist');
  if (fs.existsSync(webDistPath)) {
    console.log(`[Static] Serving web frontend from ${webDistPath}`);
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    fastify.setNotFoundHandler((_request, reply) => {
      reply.sendFile('index.html');
    });
  } else {
    console.log('[Static] web/dist not found, serving fallback HTML');
    fastify.get('/', async (_req, reply) => {
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <head><title>VaultCloud TMA Backend</title></head>
          <body style="font-family: sans-serif; background: #0b0f19; color: #f8fafc; padding: 2rem;">
            <h1>VaultCloud TMA Relay Server</h1>
            <p>Backend API is active on port ${config.port}.</p>
            <p>Demo Mode: <strong>${config.demoMode ? 'ENABLED' : 'DISABLED'}</strong></p>
            <p>Build the web frontend with <code>npm run build --workspace=web</code> to serve the full Mini App here.</p>
          </body>
        </html>
      `);
    });
  }

  return fastify;
}

// Direct execution entrypoint
export async function start() {
  try {
    const server = await buildServer();
    await server.listen({ port: config.port, host: config.host });
    console.log(`[VaultCloud] Server running at http://${config.host}:${config.port}`);
    return server;
  } catch (err) {
    console.error('[VaultCloud] Fatal startup error:', err);
    closeDatabase();
    process.exit(1);
  }
}

// Automatically start server
start();
