import crypto from 'node:crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface AuthContext {
  userId: string;
  user: TelegramUser;
  isDemo: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Validates Telegram Mini App initData HMAC-SHA256 signature.
 */
export function validateTelegramInitData(initDataRaw: string, botToken: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    // Sort parameters alphabetically
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map((k) => `${k}=${params.get(k)}`).join('\n');

    // Compute secret key: HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

    // Compute data signature: HMAC_SHA256(secretKey, dataCheckString)
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return null;
    }

    const userRaw = params.get('user');
    if (!userRaw) return null;

    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    return null;
  }
}

/**
 * Fastify preHandler hook for authenticating requests.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers['authorization'];

  // Handle DEMO_MODE or local testing fallback
  if (config.demoMode || !authHeader || authHeader.toLowerCase() === 'tma demo' || authHeader.toLowerCase() === 'bearer demo') {
    request.auth = {
      userId: 'user_10001',
      user: {
        id: 10001,
        first_name: 'Demo',
        last_name: 'Explorer',
        username: 'demo_user',
      },
      isDemo: true,
    };
    return;
  }

  // Parse "tma <initData>" or "Bearer <initData>"
  const parts = authHeader.split(' ');
  const initData = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];

  const tgUser = validateTelegramInitData(initData, config.telegramBotToken);
  if (!tgUser) {
    reply.status(401).send({ error: 'Unauthorized: Invalid Telegram authentication signature' });
    return;
  }

  request.auth = {
    userId: `tg_${tgUser.id}`,
    user: tgUser,
    isDemo: false,
  };
}
