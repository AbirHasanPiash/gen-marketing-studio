import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { syncAllAnalytics } from './analytics.service.js';

const router = Router();
router.use(authenticate);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Aggregated analytics for the dashboard (Feature 15). Computes totals,
 * a daily time-series, per-platform split, best-time-to-post signals,
 * top posts and a simple campaign-ROI proxy — all Recharts-ready.
 */
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const { brandId } = req.query;
    const days = Math.min(180, Number(req.query.days) || 30);
    const since = new Date(Date.now() - days * 86400_000);

    const publications = await prisma.publication.findMany({
      where: {
        tenantId: req.tenantId,
        status: 'SUCCESS',
        ...(brandId ? { post: { brandId } } : {}),
      },
      include: {
        analytics: { orderBy: { capturedAt: 'desc' }, take: 1 },
        post: {
          select: {
            id: true,
            title: true,
            publishedAt: true,
            campaign: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    const rows = publications
      .map((p) => ({ pub: p, m: p.analytics[0], when: p.post?.publishedAt || p.publishedAt || p.createdAt }))
      .filter((r) => r.m);

    const zeroTotals = { views: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
    const totals = rows.reduce((acc, { m }) => {
      for (const k of Object.keys(zeroTotals)) acc[k] += m[k] || 0;
      return acc;
    }, { ...zeroTotals });
    const engagementActions = totals.likes + totals.comments + totals.shares + totals.saves;
    totals.engagementRate = totals.impressions
      ? Number(((engagementActions / totals.impressions) * 100).toFixed(2))
      : 0;
    totals.posts = rows.length;

    // Daily time-series across the window.
    const buckets = new Map();
    for (let i = days - 1; i >= 0; i -= 1) {
      const key = dayKey(new Date(Date.now() - i * 86400_000));
      buckets.set(key, { date: key, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0 });
    }
    rows.forEach(({ m, when }) => {
      const key = dayKey(when);
      if (!buckets.has(key)) return;
      const b = buckets.get(key);
      b.views += m.views || 0;
      b.likes += m.likes || 0;
      b.comments += m.comments || 0;
      b.shares += m.shares || 0;
      b.engagement += (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);
    });
    const timeseries = [...buckets.values()];

    // Per-platform split.
    const platformMap = {};
    rows.forEach(({ pub, m }) => {
      const p = (platformMap[pub.platform] ||= { platform: pub.platform, posts: 0, views: 0, engagement: 0 });
      p.posts += 1;
      p.views += m.views || 0;
      p.engagement += (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);
    });
    const byPlatform = Object.values(platformMap);

    // Best time to post: average engagement-rate per weekday & per hour.
    const wd = WEEKDAYS.map((label, i) => ({ label, day: i, total: 0, n: 0 }));
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, n: 0 }));
    rows.forEach(({ m, when }) => {
      const d = new Date(when);
      const er = m.engagement || 0;
      wd[d.getDay()].total += er;
      wd[d.getDay()].n += 1;
      hours[d.getHours()].total += er;
      hours[d.getHours()].n += 1;
    });
    const byWeekday = wd.map((x) => ({ label: x.label, engagement: x.n ? Number((x.total / x.n).toFixed(2)) : 0 }));
    const byHour = hours.map((x) => ({ hour: x.hour, engagement: x.n ? Number((x.total / x.n).toFixed(2)) : 0 }));
    const bestHour = [...byHour].sort((a, b) => b.engagement - a.engagement)[0];
    const bestDay = [...byWeekday].sort((a, b) => b.engagement - a.engagement)[0];

    // Top posts by engagement actions.
    const topPosts = rows
      .map(({ pub, m }) => ({
        postId: pub.post?.id,
        title: pub.post?.title || 'Untitled',
        platform: pub.platform,
        permalink: pub.permalink,
        views: m.views || 0,
        engagement: (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0),
        engagementRate: m.engagement || 0,
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);

    // Campaign ROI proxy: engagement per post within each campaign.
    const campMap = {};
    rows.forEach(({ pub, m }) => {
      const c = pub.post?.campaign;
      if (!c) return;
      const entry = (campMap[c.id] ||= { id: c.id, name: c.name, color: c.color, posts: 0, engagement: 0, reach: 0 });
      entry.posts += 1;
      entry.engagement += (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);
      entry.reach += m.reach || 0;
    });
    const campaignROI = Object.values(campMap)
      .map((c) => ({ ...c, roi: c.posts ? Number((c.engagement / c.posts).toFixed(1)) : 0 }))
      .sort((a, b) => b.roi - a.roi);

    return ok(res, {
      totals,
      timeseries,
      byPlatform,
      bestTime: { byWeekday, byHour, bestHour, bestDay },
      topPosts,
      campaignROI,
      window: { days, since },
    });
  })
);

router.post(
  '/sync',
  asyncHandler(async (_req, res) => ok(res, await syncAllAnalytics()))
);

export default router;
