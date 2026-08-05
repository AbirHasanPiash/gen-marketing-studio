import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { notFound, errorHandler } from './middleware/error.js';

import authRoutes from './modules/auth/auth.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
// import brandRoutes from './modules/brand/brand.routes.js';
// import productRoutes from './modules/product/product.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // --- Core middleware (must come first) ---
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: [env.webBaseUrl, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  // --- Health check ---
  app.get('/api/health', (_req, res) =>
    res.json({
      success: true,
      status: 'ok',
      env: env.nodeEnv,
      integrations: {
        cloudinary: env.cloudinary.enabled,
        groq: env.groq.enabled,
        meta: env.meta.enabled,
        imageProvider: env.image.provider,
      },
    })
  );

  // --- Routes ---
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  // app.use('/api/brands', requireAuth, brandRoutes);
  // app.use('/api/products', productRoutes);

  // --- Error handling (must be last) ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;