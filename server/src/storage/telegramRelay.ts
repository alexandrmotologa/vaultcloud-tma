import { Bot, InputFile } from 'grammy';
import { IStorageAdapter, SaveChunkResult } from './storageAdapter.js';
import { config } from '../config.js';

export class TelegramRelayAdapter implements IStorageAdapter {
  private bot: Bot;
  private chatId: string;

  constructor(bot: Bot) {
    this.bot = bot;
    this.chatId = config.telegramStorageChatId;
  }

  async saveChunk(fileId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<SaveChunkResult> {
    const filename = `vault_${fileId}_part${chunkIndex}.enc`;
    const inputFile = new InputFile(chunkBuffer, filename);

    const message = await this.bot.api.sendDocument(this.chatId, inputFile, {
      caption: `#vaultcloud ${fileId} part ${chunkIndex}`,
    });

    if (!message.document) {
      throw new Error('Telegram Bot API did not return document payload');
    }

    return {
      telegramFileId: message.document.file_id,
      sizeBytes: message.document.file_size || chunkBuffer.length,
    };
  }

  async getChunk(telegramFileId: string): Promise<Buffer> {
    const fileInfo = await this.bot.api.getFile(telegramFileId);
    if (!fileInfo.file_path) {
      throw new Error('Telegram file path not resolved');
    }

    const downloadUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Failed to download chunk from Telegram: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async deleteChunk(_telegramFileId: string): Promise<void> {
    // Telegram stores documents in chat history; database metadata removal suffices
  }
}
