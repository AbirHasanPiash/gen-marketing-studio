import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const getAgenda = () => null;

export async function startAgenda() {
  logger.info('Background publishing worker disabled in this feature build.');
  return null;
}

export async function schedulePublishJob(post, runAt) {
  return prisma.publishJob.create({
    data: {
      tenantId: post.tenantId,
      postId: post.id,
      runAt: runAt ? new Date(runAt) : new Date(),
      status: 'QUEUED',
    },
  });
}

export async function cancelPublishJob(postId) {
  await prisma.publishJob.updateMany({
    where: { postId, status: { in: ['QUEUED', 'RETRYING'] } },
    data: { status: 'CANCELLED' },
  });
}

export async function retryPublishJob() {
  logger.info('Publishing retry is disabled in this feature build.');
}

export async function stopAgenda() {}
