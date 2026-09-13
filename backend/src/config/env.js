import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (v) => v === true || v === 'true' || v === '1';

// A trailing slash on a base URL turns every interpolation into `host//path`
// and stops the CORS allow-list matching (an Origin header never has one).
const baseUrl = (v, fallback) => String(v || fallback).trim().replace(/\/+$/, '');
const csv = (v) => String(v || '').split(',').map((s) => baseUrl(s.trim(), '')).filter(Boolean);

/**
 * Centralised, typed-ish config. Each integration exposes an `enabled` flag so
 * services can transparently fall back to mock mode when keys are absent.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  apiBaseUrl: baseUrl(process.env.API_BASE_URL, 'http://localhost:4000'),
  webBaseUrl: baseUrl(process.env.WEB_BASE_URL, 'http://localhost:5173'),

  cors: {
    /** Extra exact origins (staging domains, a second frontend), comma-separated. */
    extraOrigins: csv(process.env.CORS_EXTRA_ORIGINS),
    /** Vercel project whose preview deploys may call the API. Derived from WEB_BASE_URL when unset. */
    vercelProject: (process.env.VERCEL_PROJECT_NAME || '').trim(),
    /** Set VERCEL_PREVIEWS=false to allow only the exact origins above. */
    vercelPreviews: process.env.VERCEL_PREVIEWS !== 'false',
  },

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

  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || '',
    apiUrl:
      process.env.OPENROUTER_API_URL ||
      process.env.API_URL ||
      'https://openrouter.ai/api/v1/chat/completions',
    model:
      process.env.OPENROUTER_MODEL ||
      process.env.GROQ_MODEL ||
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  image: {
    provider: (process.env.IMAGE_PROVIDER || 'pollinations').toLowerCase(),
    stabilityKey: process.env.STABILITY_API_KEY || '',
    replicateToken: process.env.REPLICATE_API_TOKEN || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    geminiKey: process.env.GEMINI_API_KEY || '',
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

const DEV_JWT_SECRET = 'dev-insecure-secret-change-me';
const DEV_ENCRYPTION_KEY = '0'.repeat(64);

/**
 * Fail fast rather than booting a production deploy that signs sessions with a
 * public constant, or one that "encrypts" Meta tokens with an all-zero key.
 * Both are silent in development and catastrophic in production.
 */
export function assertProductionConfig() {
  if (!env.isProd) return;
  const problems = [];
  if (!env.databaseUrl) problems.push('DATABASE_URL is not set');
  if (env.jwt.secret === DEV_JWT_SECRET) problems.push('JWT_SECRET is still the development default');
  if (env.tokenEncryptionKey === DEV_ENCRYPTION_KEY) {
    problems.push('TOKEN_ENCRYPTION_KEY is still the development default (`openssl rand -hex 32`)');
  }
  if (problems.length) {
    throw new Error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
  }
}

export default env;
