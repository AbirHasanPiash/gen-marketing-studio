import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { startAgenda } from './jobs/agenda.js';

/**
 * Standalone worker process (optional). On Render/Railway you can run this as a
 * separate "Background Worker" service so scheduled publishing keeps running
 * independently of the web dyno. The web service also runs Agenda in-process,
 * so this is only needed if you want to scale the worker separately.
 */
async function main() {
  await prisma.$connect();
  await startAgenda();
  logger.success('Background worker started (Agenda scheduler active)');
}

main().catch((err) => {
  logger.error('Worker failed to start:', err);
  process.exit(1);
});
