import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Load .env from root or server dir
const rootEnvPath = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(process.cwd(), 'server/.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else {
  dotenv.config();
}

export interface AppConfig {
  port: number;
  host: string;
  demoMode: boolean;
  telegramBotToken: string;
  telegramStorageChatId: string;
  databasePath: string;
  appUrl: string;
}

const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 8085;

export const config: AppConfig = {
  port: envPort,
  host: process.env.HOST || '0.0.0.0',
  demoMode: process.env.DEMO_MODE !== 'false', // Default to true for zero-config demo
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || 'mock_bot_token',
  telegramStorageChatId: process.env.TELEGRAM_STORAGE_CHAT_ID || 'mock_chat_id',
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data/vaultcloud.db'),
  appUrl: process.env.APP_URL || `http://localhost:${envPort}`,
};
