import { prisma } from '../../lib/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import * as meta from '../../lib/meta.js';

const engagementRate = (m) => {
  const denom = m.impressions || m.reach || 1;
  return Number((((m.likes + m.comments + m.shares + m.saves) / denom) * 100).toFixed(2));
};

/** Pull fresh insights for one publication and store a snapshot. */
export async function syncPublication(publication) {
  const token = publication.socialAccount ? decrypt(publication.socialAccount.accessToken) : null;
  const insights = await meta.getInsights({
    platform: publication.platform,
    externalId: publication.externalId,
    accessToken: token,
  });
  return prisma.analyticsSnapshot.create({
    data: {
      tenantId: publication.tenantId,
      publicationId: publication.id,
      views: insights.views || insights.impressions || 0,
      impressions: insights.impressions || 0,
      reach: insights.reach || 0,
      likes: insights.likes || 0,
      comments: insights.comments || 0,
      shares: insights.shares || 0,
      saves: insights.saves || 0,
      clicks: insights.clicks || 0,
      engagement: engagementRate(insights),
    },
  });
}

/** Graph calls run in small batches — serial is slow, unbounded gets throttled. */
const SYNC_CONCURRENCY = 5;
/** Don't re-snapshot a publication that was captured this recently. */
const MIN_SYNC_INTERVAL_MS = 15 * 60_000;
/** Upper bound per run, so one sweep can't run for hours on a large workspace. */
const MAX_PER_RUN = 500;

/**
 * Refresh insights for every successfully-published item. Pass a `tenantId` for
 * user-triggered syncs so one workspace can't kick off Graph calls for another;
 * the recurring job omits it deliberately to cover every tenant.
 *
 * Publications captured within `MIN_SYNC_INTERVAL_MS` are skipped: the sweep
 * runs every 30 minutes and each pass writes a new snapshot row, so without a
 * floor the collection grows forever while the dashboard only ever reads the
 * newest row per publication.
 */
export async function syncAllAnalytics(tenantId) {
  const freshSince = new Date(Date.now() - MIN_SYNC_INTERVAL_MS);
  const pubs = await prisma.publication.findMany({
    where: {
      status: 'SUCCESS',
      externalId: { not: null },
      ...(tenantId ? { tenantId } : {}),
    },
    include: { socialAccount: true, analytics: { orderBy: { capturedAt: 'desc' }, take: 1 } },
    take: MAX_PER_RUN,
    orderBy: { updatedAt: 'desc' },
  });

  const stale = pubs.filter((p) => !p.analytics[0] || p.analytics[0].capturedAt < freshSince);
  let ok = 0;

  for (let i = 0; i < stale.length; i += SYNC_CONCURRENCY) {
    const batch = stale.slice(i, i + SYNC_CONCURRENCY);
     
    const results = await Promise.allSettled(batch.map((pub) => syncPublication(pub)));
    results.forEach((r, n) => {
      if (r.status === 'fulfilled') ok += 1;
      else logger.warn(`Analytics sync failed for publication ${batch[n].id}: ${r.reason?.message}`);
    });
  }

  if (stale.length) logger.info(`Analytics sync: refreshed ${ok}/${stale.length} publications`);
  return { total: stale.length, ok, skipped: pubs.length - stale.length };
}
