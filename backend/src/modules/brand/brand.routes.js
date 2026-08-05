import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ensureBrand } from '../../utils/scope.js';
import { ApiError } from '../../utils/ApiError.js';
import { uniqueSlug } from '../../utils/slug.js';

const router = Router();
router.use(authenticate);

const brandBody = z.object({
  name: z.string().min(2).max(120),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  industry: z.string().max(80).optional().nullable(),
  website: z.string().url().optional().or(z.literal('')).nullable(),
  logoUrl: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  socialLinks: z.record(z.string()).optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const brands = await prisma.brandProfile.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        brandKit: true,
        _count: { select: { products: true, posts: true, assets: true } },
      },
    });
    return ok(res, brands);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const brand = await prisma.brandProfile.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { brandKit: true, _count: { select: { products: true, posts: true, assets: true } } },
    });
    if (!brand) throw ApiError.notFound('Brand not found');
    return ok(res, brand);
  })
);

router.post(
  '/',
  requireRole('OWNER'),
  validate({ body: brandBody }),
  asyncHandler(async (req, res) => {
    const slug = await uniqueSlug(req.body.name, async (s) =>
      Boolean(await prisma.brandProfile.findFirst({ where: { tenantId: req.tenantId, slug: s } }))
    );
    const brand = await prisma.brandProfile.create({
      data: { ...req.body, slug, tenantId: req.tenantId },
    });
    return created(res, brand);
  })
);

router.patch(
  '/:id',
  requireRole('OWNER'),
  validate({ body: brandBody.partial() }),
  asyncHandler(async (req, res) => {
    await ensureBrand(req.tenantId, req.params.id);
    const brand = await prisma.brandProfile.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, brand);
  })
);

router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    await ensureBrand(req.tenantId, req.params.id);
    await prisma.brandProfile.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);


export default router;
