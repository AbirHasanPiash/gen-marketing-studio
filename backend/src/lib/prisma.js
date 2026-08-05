import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * Single PrismaClient instance for the whole process. Re-used across hot
 * reloads in dev via the global to avoid exhausting Mongo connections.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma__ ||
  new PrismaClient({
    log: env.verbose ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProd) globalForPrisma.__prisma__ = prisma;

export default prisma;
