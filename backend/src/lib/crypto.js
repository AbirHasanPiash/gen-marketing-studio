import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * AES-256-GCM encryption for secrets at rest (Meta access tokens). Output is
 * `iv:tag:ciphertext` hex. Falls back to a warning if the key is the default.
 */
const ALGO = 'aes-256-gcm';

function key() {
  const hex = env.tokenEncryptionKey;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    logger.warn('TOKEN_ENCRYPTION_KEY is not a 32-byte hex string; using a derived key.');
    return crypto.createHash('sha256').update(String(hex)).digest();
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(payload) {
  if (!payload) return null;
  try {
    const [ivHex, tagHex, dataHex] = String(payload).split(':');
    if (!ivHex || !tagHex || !dataHex) return payload; // not encrypted
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    logger.error('Failed to decrypt secret:', err.message);
    return null;
  }
}
