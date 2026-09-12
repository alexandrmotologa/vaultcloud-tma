import { Bot, InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import { VirtualFileSystem } from '../db/vfs.js';

export function createTelegramBot(vfs: VirtualFileSystem): Bot | null {
  if (config.demoMode && config.telegramBotToken === 'mock_bot_token') {
    console.log('[Bot] Running in DEMO_MODE with mock bot token. Live polling skipped.');
    return null;
  }

  const bot = new Bot(config.telegramBotToken);

  // Command /start
  bot.command('start', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp('Open VaultCloud Drive', config.appUrl);

    await ctx.reply(
      `Welcome to VaultCloud TMA!\n\n` +
      `Your personal zero-knowledge encrypted cloud drive.\n\n` +
      `Features:\n` +
      `- Client-side AES-GCM-256 encryption via WebCrypto\n` +
      `- Unlimited Telegram document storage\n` +
      `- Direct chat document drop (Inbox)\n` +
      `- In-memory media previews and ZIP downloads\n\n` +
      `Click below to launch your encrypted drive:`,
      { reply_markup: keyboard }
    );
  });

  // Command /drive
  bot.command('drive', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp('Open Drive', config.appUrl);
    await ctx.reply('Tap below to access your files:', { reply_markup: keyboard });
  });

  // Command /quota
  bot.command('quota', async (ctx) => {
    const userId = `tg_${ctx.from?.id}`;
    const stats = vfs.getVaultStats(userId);
    const mb = (stats.totalSizeBytes / (1024 * 1024)).toFixed(2);

    await ctx.reply(
      `Vault Storage Statistics:\n\n` +
      `- Total Files: ${stats.totalFiles}\n` +
      `- Folders: ${stats.folderCount}\n` +
      `- Encrypted Storage Used: ${mb} MB\n` +
      `- Telegram Cloud Limit: Unlimited (2GB per file)`
    );
  });

  // Command /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `VaultCloud TMA Help & Security:\n\n` +
      `1. Zero-Knowledge: Files are sliced into 10MB chunks and encrypted with AES-GCM-256 inside your browser.\n` +
      `2. Inbox Dropper: Forward any file directly to this bot to save it in your Inbox, then encrypt it in the Mini App.\n` +
      `3. Commands:\n` +
      `  /drive - Open the Mini App\n` +
      `  /quota - View storage stats\n` +
      `  /help - View security information`
    );
  });

  // Ingest incoming documents directly dropped into chat
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    const userId = `tg_${ctx.from?.id}`;

    const fileId = `file_inbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    vfs.createFile(userId, {
      id: fileId,
      name: doc.file_name || 'unnamed_document',
      mimeType: doc.mime_type || 'application/octet-stream',
      totalSizeBytes: doc.file_size || 0,
      chunkCount: 1,
      isEncrypted: 0, // Pending client-side encryption in Mini App
    });

    vfs.addChunk({
      fileId,
      chunkIndex: 0,
      telegramFileId: doc.file_id,
      sizeBytes: doc.file_size || 0,
      sha256Hash: '',
    });

    const keyboard = new InlineKeyboard().webApp('Open Vault & Encrypt', config.appUrl);
    await ctx.reply(
      `Received "${doc.file_name}" into your Vault Inbox!\n\nOpen VaultCloud to encrypt it with your master key.`,
      { reply_markup: keyboard }
    );
  });

  // Ingest incoming photos directly dropped into chat
  bot.on('message:photo', async (ctx) => {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const userId = `tg_${ctx.from?.id}`;

    const fileId = `file_inbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    vfs.createFile(userId, {
      id: fileId,
      name: `photo_${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      totalSizeBytes: largestPhoto.file_size || 0,
      chunkCount: 1,
      isEncrypted: 0,
    });

    vfs.addChunk({
      fileId,
      chunkIndex: 0,
      telegramFileId: largestPhoto.file_id,
      sizeBytes: largestPhoto.file_size || 0,
      sha256Hash: '',
    });

    const keyboard = new InlineKeyboard().webApp('Open Vault & Encrypt', config.appUrl);
    await ctx.reply(
      `Photo added to your Vault Inbox! Open VaultCloud to encrypt and store it.`,
      { reply_markup: keyboard }
    );
  });

  return bot;
}
