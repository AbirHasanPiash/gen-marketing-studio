import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err.code === 'P2002') {
    // Prisma unique constraint
    status = 409;
    message = `A record with that ${err.meta?.target || 'value'} already exists`;
  } else if (err.code === 'P2025') {
    status = 404;
    message = 'Record not found';
  } else if (err.code === 'P2023' || err.name === 'PrismaClientValidationError') {
    status = 400;
    message = 'Invalid identifier or query';
    // The Prisma message names the offending field/value — without it this 400
    // is undebuggable from the client, so surface it outside production.
    if (!env.isProd) details = err.message;
    logger.warn(`${req.method} ${req.originalUrl} →`, err.message);
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} →`, err.stack || err.message);
  }

  res.status(status).json({
    success: false,
    error: { message, ...(details ? { details } : {}) },
    ...(env.isProd ? {} : { stack: status >= 500 ? err.stack : undefined }),
  });
}
