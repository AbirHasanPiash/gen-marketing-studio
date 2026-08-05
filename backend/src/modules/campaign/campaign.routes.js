import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ensureOwned } from '../../utils/scope.js';

const router = Router();
router.use(authenticate);

const campaignBody = z.object({
  name: z.string().min(2).max(120),
  theme: z.string().max(80).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  brandId: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  isSuggested: z.boolean().optional(),
  momentKey: z.string().optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = { tenantId: req.tenantId, ...(req.query.brandId ? { brandId: req.query.brandId } : {}) };
    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } }, brand: { select: { id: true, name: true } } },
    });
    return ok(res, campaigns);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { posts: { include: { author: { select: { name: true } } } }, brand: true },
    });
    return ok(res, campaign);
  })
);

router.post(
  '/',
  validate({ body: campaignBody }),
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.create({ data: { ...req.body, tenantId: req.tenantId } });
    return created(res, campaign);
  })
);

router.patch(
  '/:id',
  validate({ body: campaignBody.partial() }),
  asyncHandler(async (req, res) => {
    await ensureOwned('campaign', req.tenantId, req.params.id);
    const campaign = await prisma.campaign.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, campaign);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ensureOwned('campaign', req.tenantId, req.params.id);
    await prisma.campaign.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);

export default router;
