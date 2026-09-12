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
      `- Virtual folders, breadcrumb navigation, and in-memory media previews\n\n` +
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
      `1. Zero-Knowledge: Your files are sliced into 10MB chunks and encrypted with AES-GCM-256 inside your browser.\n` +
      `2. Passphrase: Your master key is derived with PBKDF2 (100,000 iterations). Plaintext files never reach the server.\n` +
      `3. Commands:\n` +
      `  /drive - Open the Mini App\n` +
      `  /quota - View storage stats\n` +
      `  /help - View security information`
    );
  });

  return bot;
}
