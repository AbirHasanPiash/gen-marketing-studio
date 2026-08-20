import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { notFound, errorHandler } from './middleware/error.js';
import { RENDER_DIR } from './modules/video/video.service.js';
import { UPLOAD_DIR } from './lib/localUploads.js';

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

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: [env.webBaseUrl, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    })
  );
  app.use(express.json({
    limit: '15mb',
    verify: (req, _res, buffer) => {
      if (req.originalUrl.startsWith('/api/webhooks/meta')) req.rawBody = Buffer.from(buffer);
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  // Rendered videos and uploads (served locally when Cloudinary isn't configured).
  app.use('/media/renders', express.static(RENDER_DIR));
  app.use('/media/uploads', express.static(UPLOAD_DIR));

  app.get('/api/health', (_req, res) =>
    res.json({
      success: true,
      status: 'ok',
      env: env.nodeEnv,
      integrations: {
        cloudinary: env.cloudinary.enabled,
        openRouter: env.openRouter.enabled,
        meta: env.meta.enabled,
        imageProvider: env.image.provider,
      },
    })
  );

  // Public & webhook routes (no auth).
  app.use('/api/public', publicRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // Auth (rate-limited) + authenticated API.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
  app.use('/api/auth', authLimiter, authRoutes);

  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/brands', brandRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/briefs', briefRoutes);
  app.use('/api/assets', assetRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/social', socialRoutes);
  app.use('/api/publish', publishRoutes);
  app.use('/api/linkbio', linkbioRoutes);
  app.use('/api/qr', qrRoutes);
  app.use('/api/videos', videoRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp;
