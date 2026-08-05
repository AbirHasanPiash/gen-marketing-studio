import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (v) => v === true || v === 'true' || v === '1';

/**
 * Centralised, typed-ish config. Each integration exposes an `enabled` flag so
 * services can transparently fall back to mock mode when keys are absent.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  webBaseUrl: process.env.WEB_BASE_URL || 'http://localhost:5173',

  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  tokenEncryptionKey:
    process.env.TOKEN_ENCRYPTION_KEY ||
    '0000000000000000000000000000000000000000000000000000000000000000',

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    get enabled() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  image: {
    provider: (process.env.IMAGE_PROVIDER || 'pollinations').toLowerCase(),
    stabilityKey: process.env.STABILITY_API_KEY || '',
    replicateToken: process.env.REPLICATE_API_TOKEN || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
  },

  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    graphVersion: process.env.META_GRAPH_VERSION || 'v21.0',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'mkt_studio_verify',
    get enabled() {
      return Boolean(this.appId && this.appSecret);
    },
  },

  ffmpeg: {
    path: process.env.FFMPEG_PATH || '',
  },

  verbose: bool(process.env.VERBOSE),
};

export default env;
