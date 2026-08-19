import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startAgenda, stopAgenda } from './jobs/agenda.js';
import { resetStuckRenders } from './modules/video/video.service.js';

async function main() {
  const app = createApp();

  // Verify the database connection early with a clear message on failure.
  try {
    await prisma.$connect();
    logger.success('Connected to MongoDB via Prisma');
  } catch (err) {
    logger.error('Could not connect to MongoDB. Is the replica set running (docker compose up -d)?');
    logger.error(err.message);
    process.exit(1);
  }

  // Video renders live in-process, so any left at RENDERING died with the last
  // process — fail them so the UI stops polling and offers a retry.
  await resetStuckRenders().catch((err) => logger.warn('Could not reset stuck renders:', err.message));

  // Run the scheduler in-process so scheduled publishing and webhook analytics
  // continue to work when the API is deployed as a single service.
  try {
    await startAgenda();
  } catch (err) {
    logger.warn('Agenda failed to start; scheduled publishing is disabled:', err.message);
  }

  const server = app.listen(env.port, () => {
    logger.success(`API listening on ${env.apiBaseUrl} (port ${env.port})`);
    // logger.info(
    //   `Integrations → cloudinary:${env.cloudinary.enabled} openRouter:${env.openRouter.enabled} meta:${env.meta.enabled} image:${env.image.provider}`
    // );
  });

  const shutdown = async (signal) => {
    logger.warn(`${signal} received — shutting down...`);
    server.close();
    await stopAgenda().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
