import * as agendaPkg from 'agenda';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { runPublishJob } from '../modules/publish/publish.service.js';
import { syncAllAnalytics } from '../modules/analytics/analytics.service.js';

// Agenda ships as CJS; resolve the class regardless of interop shape.
const Agenda = agendaPkg.Agenda || agendaPkg.default || agendaPkg;

let agenda = null;
export const getAgenda = () => agenda;

const BACKOFF_CAP_MIN = 60;
const backoffMinutes = (attempt) => Math.min(BACKOFF_CAP_MIN, 2 ** attempt); // 2,4,8,16,32,60...

/**
 * Core worker with explicit retry logic (Feature 16). Tracks attempts on the
 * PublishJob row and reschedules with exponential backoff on transient errors,
 * giving up (and flipping the post to FAILED) once maxAttempts is reached or
 * the error is marked permanent.
 */
async function handlePublish(postId) {
  const job = await prisma.publishJob.findFirst({
    where: { postId },
    orderBy: { createdAt: 'desc' },
  });
  const attempt = (job?.attempts || 0) + 1;
  const maxAttempts = job?.maxAttempts || 5;
  if (job) await prisma.publishJob.update({ where: { id: job.id }, data: { attempts: attempt, status: 'RUNNING' } });

  try {
    await runPublishJob(postId);
    if (job) await prisma.publishJob.update({ where: { id: job.id }, data: { status: 'SUCCESS', lastError: null } });
    logger.success(`publish-post succeeded for ${postId} (attempt ${attempt})`);
  } catch (err) {
    const canRetry = !err.permanent && attempt < maxAttempts;
    if (canRetry) {
      const mins = backoffMinutes(attempt);
      const nextRetryAt = new Date(Date.now() + mins * 60_000);
      if (job)
        await prisma.publishJob.update({
          where: { id: job.id },
          data: { status: 'RETRYING', lastError: err.message, nextRetryAt },
        });
      await agenda.schedule(nextRetryAt, 'publish-post', { postId });
      logger.warn(`publish-post failed for ${postId} (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying in ${mins}m`);
    } else {
      if (job)
        await prisma.publishJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', lastError: err.message },
        });
      const post = await prisma.post.update({ where: { id: postId }, data: { status: 'FAILED' } }).catch(() => null);
      if (post) {
        await prisma.notification.create({
          data: {
            tenantId: post.tenantId,
            userId: post.authorId,
            type: 'PUBLISH_FAILED',
            title: 'Publishing failed',
            body: `${post.title || 'Your post'} could not be published: ${err.message}`,
            link: `/posts/${postId}`,
          },
        });
      }
      logger.error(`publish-post permanently failed for ${postId}: ${err.message}`);
    }
  }
}

export async function startAgenda() {
  if (agenda) return agenda;
  agenda = new Agenda({
    db: { address: env.databaseUrl, collection: 'agendaJobs' },
    processEvery: '15 seconds',
    maxConcurrency: 5,
    defaultConcurrency: 3,
  });

  agenda.define('publish-post', { priority: 'high' }, async (job) => {
    await handlePublish(job.attrs.data.postId);
  });

  agenda.define('sync-analytics', async () => {
    await syncAllAnalytics();
  });

  agenda.on('ready', () => logger.success('Agenda connected to MongoDB'));
  agenda.on('error', (e) => logger.error('Agenda error:', e.message));

  await agenda.start();
  await agenda.every('30 minutes', 'sync-analytics');
  logger.success('Agenda scheduler started');
  return agenda;
}

/** Schedule (or immediately queue) a post's publish job. */
export async function schedulePublishJob(post, runAt) {
  const when = runAt ? new Date(runAt) : new Date();
  const pj = await prisma.publishJob.create({
    data: { tenantId: post.tenantId, postId: post.id, runAt: when, status: 'QUEUED' },
  });
  if (!agenda) {
    logger.warn('Agenda not started; publish job recorded but not scheduled.');
    return pj;
  }
  const job = await agenda.schedule(when, 'publish-post', { postId: post.id });
  await prisma.publishJob.update({ where: { id: pj.id }, data: { agendaJobId: String(job.attrs._id) } });
  return pj;
}

/** Cancel any pending publish jobs for a post (used on unschedule/delete). */
export async function cancelPublishJob(postId) {
  if (agenda) await agenda.cancel({ name: 'publish-post', 'data.postId': postId });
  await prisma.publishJob.updateMany({
    where: { postId, status: { in: ['QUEUED', 'RETRYING'] } },
    data: { status: 'CANCELLED' },
  });
}

/** Manually retry a failed publish immediately (Feature 16 — UI button). */
export async function retryPublishJob(postId) {
  await prisma.publishJob.updateMany({
    where: { postId, status: 'FAILED' },
    data: { status: 'QUEUED', nextRetryAt: null },
  });
  await prisma.post.update({ where: { id: postId }, data: { status: 'APPROVED' } }).catch(() => null);
  if (agenda) await agenda.now('publish-post', { postId });
  else await handlePublish(postId);
}

export async function stopAgenda() {
  if (agenda) await agenda.stop();
}
