import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';

import { env } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { notFound, errorHandler } from './middleware/error.js';
import { authLimiter, apiLimiter, publicLimiter } from './middleware/rateLimit.js';
import { RENDER_DIR } from './modules/video/video.service.js';
import { UPLOAD_DIR } from './lib/localUploads.js';
import { prisma } from './lib/prisma.js';

import authRoutes from './modules/auth/auth.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import brandRoutes from './modules/brand/brand.routes.js';
import productRoutes from './modules/product/product.routes.js';
import postRoutes from './modules/post/post.routes.js';
import campaignRoutes from './modules/campaign/campaign.routes.js';
import briefRoutes from './modules/brief/brief.routes.js';
import assetRoutes from './modules/asset/asset.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import mediaRoutes from './modules/media/media.routes.js';
import socialRoutes from './modules/social/social.routes.js';
import publishRoutes from './modules/publish/publish.routes.js';
import linkbioRoutes from './modules/linkbio/linkbio.routes.js';
import qrRoutes from './modules/qr/qr.routes.js';
import videoRoutes from './modules/video/video.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import notificationRoutes from './modules/notification/notification.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import webhookRoutes from './modules/webhook/webhook.routes.js';

/** Routers mounted under `/api`, all of them behind `authenticate`. */
const API_ROUTES = {
  dashboard: dashboardRoutes,
  brands: brandRoutes,
  products: productRoutes,
  posts: postRoutes,
  campaigns: campaignRoutes,
  briefs: briefRoutes,
  assets: assetRoutes,
  ai: aiRoutes,
  media: mediaRoutes,
  social: socialRoutes,
  publish: publishRoutes,
  linkbio: linkbioRoutes,
  qr: qrRoutes,
  videos: videoRoutes,
  analytics: analyticsRoutes,
  notifications: notificationRoutes,
};

/**
 * Static media is immutable — every render and upload gets a fresh filename.
 * `fallthrough` stays on so a missing file lands on the shared 404 instead of
 * an fs error whose message contains the server's absolute paths.
 */
const STATIC_OPTIONS = { maxAge: '30d', immutable: true, fallthrough: true };

/** A health check has to answer fast, including when the database is the problem. */
const DB_PING_TIMEOUT_MS = 2_000;

/**
 * gzip everything except Server-Sent Events. Compression buffers its output to
 * fill a block, which for the Copy Studio's token stream means nothing reaches
 * the browser until the whole completion is finished — the streaming effect
 * disappears entirely.
 */
const compressionFilter = (req, res) =>
  res.getHeader('Content-Type') !== 'text/event-stream' && compression.filter(req, res);

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression({ filter: compressionFilter }));
  app.use(cors(corsOptions()));
  // Uploads arrive as base64 data URIs, which inflate by ~4/3 — a 12 MB audio
  // file is ~16 MB on the wire, so the limit has to sit above the file cap.
  app.use(express.json({
    limit: '25mb',
    verify: (req, _res, buffer) => {
      if (req.originalUrl.startsWith('/api/webhooks/meta')) req.rawBody = Buffer.from(buffer);
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  // Rendered videos and uploads (served locally when Cloudinary isn't configured).
  app.use('/media/renders', express.static(RENDER_DIR, STATIC_OPTIONS));
  app.use('/media/uploads', express.static(UPLOAD_DIR, STATIC_OPTIONS));

  app.get('/api/health', async (_req, res) => {
    // A health check that never touches the database reports "ok" while every
    // request is failing, which is exactly when a platform should restart us.
    let database = 'up';
    try {
      // Prisma's own server-selection timeout is 30s, which is far longer than
      // any platform will wait before calling the instance dead.
      await Promise.race([
        prisma.$runCommandRaw({ ping: 1 }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ping timed out')), DB_PING_TIMEOUT_MS).unref();
        }),
      ]);
    } catch {
      database = 'down';
    }
    res.status(database === 'up' ? 200 : 503).json({
      success: database === 'up',
      status: database === 'up' ? 'ok' : 'degraded',
      env: env.nodeEnv,
      uptime: Math.round(process.uptime()),
      database,
      integrations: {
        cloudinary: env.cloudinary.enabled,
        openRouter: env.openRouter.enabled,
        meta: env.meta.enabled,
        imageProvider: env.image.provider,
      },
    });
  });

  // Public & webhook routes (no auth).
  app.use('/api/public', publicLimiter, publicRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // Auth (rate-limited) + authenticated API.
  app.use('/api/auth', authLimiter, authRoutes);
  for (const [path, router] of Object.entries(API_ROUTES)) {
    app.use(`/api/${path}`, apiLimiter, router);
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp;
