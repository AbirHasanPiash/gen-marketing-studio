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
    igBusinessId: publication.socialAccount?.igBusinessId,
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

/**
 * Refresh insights for every successfully-published item. Pass a `tenantId` for
 * user-triggered syncs so one workspace can't kick off Graph calls for another;
 * the recurring job omits it deliberately to cover every tenant.
 */
export async function syncAllAnalytics(tenantId) {
  const pubs = await prisma.publication.findMany({
    where: { status: 'SUCCESS', externalId: { not: null }, ...(tenantId ? { tenantId } : {}) },
    include: { socialAccount: true },
  });
  let ok = 0;
  for (const pub of pubs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await syncPublication(pub);
      ok += 1;
    } catch (err) {
      logger.warn(`Analytics sync failed for publication ${pub.id}: ${err.message}`);
    }
  }
  if (pubs.length) logger.info(`Analytics sync: refreshed ${ok}/${pubs.length} publications`);
  return { total: pubs.length, ok };
}
