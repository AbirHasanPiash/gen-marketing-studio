import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler, ok, created, paginate, pageMeta } from '../../utils/http.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';

const router = Router();
router.use(authenticate);

const productBody = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1).max(160),
  sku: z.string().max(60).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  price: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().max(8).default('BDT'),
  category: z.string().max(80).optional().nullable(),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = paginate(req.query);
    const where = {
      tenantId: req.tenantId,
      ...(req.query.brandId ? { brandId: req.query.brandId } : {}),
      ...(req.query.search
        ? { name: { contains: String(req.query.search), mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.product.count({ where }),
    ]);
    return ok(res, items, pageMeta(page, limit, total));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => ok(res, await ensureOwned('product', req.tenantId, req.params.id)))
);

router.post(
  '/',
  validate({ body: productBody }),
  asyncHandler(async (req, res) => {
    await ensureBrand(req.tenantId, req.body.brandId);
    const product = await prisma.product.create({ data: { ...req.body, tenantId: req.tenantId } });
    return created(res, product);
  })
);

router.patch(
  '/:id',
  validate({ body: productBody.partial().omit({ brandId: true }) }),
  asyncHandler(async (req, res) => {
    await ensureOwned('product', req.tenantId, req.params.id);
    const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, product);
  })
);

router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    await ensureOwned('product', req.tenantId, req.params.id);
    await prisma.product.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);

export default router;
