import { Router } from 'express';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { syncAllAnalytics } from '../analytics/analytics.service.js';

const router = Router();

function hasValidSignature(req) {
  if (!env.meta.enabled) return true;
  const signature = req.get('x-hub-signature-256') || '';
  if (!signature.startsWith('sha256=') || !req.rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', env.meta.appSecret).update(req.rawBody).digest('hex')}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

/** Meta webhook subscription verification handshake. */
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.meta.webhookVerifyToken) {
    logger.success('Meta webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/** Incoming engagement change events → refresh insights (fire-and-forget). */
router.post('/meta', (req, res) => {
  if (!hasValidSignature(req)) return res.sendStatus(403);
  logger.info('Meta webhook event received');
  // Acknowledge fast; Meta retries on non-200.
  res.sendStatus(200);
  syncAllAnalytics().catch((e) => logger.warn('Webhook-triggered sync failed:', e.message));
});

export default router;
