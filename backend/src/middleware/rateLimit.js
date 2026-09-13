import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Shared limiter factory. Limits are per-IP and deliberately generous in
 * development, where a hot-reloading client can burn through a production
 * budget in seconds.
 */
const limiter = ({ windowMs, max, message, keyGenerator }) =>
  rateLimit({
    windowMs,
    max: env.isProd ? max : max * 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, _res, next) => next(new ApiError(429, message)),
  });

/** Sign-in / sign-up. Tight, because this is where credentials get guessed. */
export const authLimiter = limiter({
  windowMs: 15 * 60_000,
  max: 20,
  message: 'Too many attempts. Wait a few minutes and try again.',
});

/**
 * Everything else behind a session — a safety net, not a throttle. Generous on
 * purpose: several screens poll (render status every 4s, publish jobs every 5s,
 * notifications every 30s) and a whole team can share one office IP.
 */
export const apiLimiter = limiter({
  windowMs: 60_000,
  max: 600,
  message: 'You are sending requests too quickly. Slow down and retry.',
});

/**
 * Generation endpoints. These call paid third-party APIs, so the cap is per
 * *workspace* rather than per IP — one team behind one NAT should not be able
 * to spend another's budget, and one user on a phone should not dodge the cap.
 */
export const generationLimiter = limiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many generations in a row. Give it a minute.',
  keyGenerator: (req) => req.tenantId || req.ip,
});

/** Unauthenticated public surface: QR scans, link clicks, bio pages. */
export const publicLimiter = limiter({
  windowMs: 60_000,
  max: 120,
  message: 'Too many requests.',
});
