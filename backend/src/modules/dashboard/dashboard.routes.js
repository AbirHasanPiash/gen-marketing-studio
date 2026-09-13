import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { queryObjectId } from '../../utils/validators.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  validate({ query: z.object({ brandId: queryObjectId('brandId') }) }),
  asyncHandler(async (req, res) => {
    const t = req.tenantId;
    const brandFilter = req.query.brandId ? { brandId: req.query.brandId } : {};
    const base = { tenantId: t, ...brandFilter };

    const [byStatus, brands, briefs, assets, campaigns, accounts, upcoming, pendingReview, recentActivity] =
      await Promise.all([
        prisma.post.groupBy({ by: ['status'], where: base, _count: true }),
        prisma.brandProfile.count({ where: { tenantId: t } }),
        prisma.creativeBrief.count({ where: base }),
        prisma.asset.count({ where: base }),
        prisma.campaign.count({ where: { tenantId: t, ...brandFilter } }),
        prisma.socialAccount.count({ where: { tenantId: t, ...brandFilter, isActive: true } }),
        prisma.post.findMany({
          where: { ...base, status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
          orderBy: { scheduledAt: 'asc' },
          take: 5,
          include: { brand: { select: { name: true } } },
        }),
        prisma.post.count({ where: { ...base, status: 'PENDING_REVIEW' } }),
        prisma.postActivity.findMany({
          where: { post: { tenantId: t, ...brandFilter } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { actor: { select: { name: true } }, post: { select: { id: true, title: true } } },
        }),
      ]);

    const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    const totalPosts = byStatus.reduce((sum, s) => sum + s._count, 0);

    return ok(res, {
      counts: {
        posts: totalPosts,
        brands,
        briefs,
        assets,
        campaigns,
        connectedAccounts: accounts,
        pendingReview,
      },
      statusCounts,
      upcoming,
      recentActivity,
    });
  })
);

export default router;
