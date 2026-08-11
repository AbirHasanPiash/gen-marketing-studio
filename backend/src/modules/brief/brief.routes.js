import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { objectId, optionalObjectId } from '../../utils/validators.js';


const router = Router();
router.use(authenticate);

const briefBody = z.object({
  title: z.string().min(2).max(160),
  brandId: objectId('brandId'),
  productId: optionalObjectId('productId'),
  productRef: z.string().max(160).optional().nullable(),
  style: z.string().max(80).optional().nullable(),
  mood: z.string().max(80).optional().nullable(),
  palette: z.string().max(120).optional().nullable(),
  references: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { brandId, status, search } = req.query;
    const where = {
      tenantId: req.tenantId,
      ...(brandId ? { brandId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { title: { contains: String(search), mode: 'insensitive' } } : {}),
    };
    const briefs = await prisma.creativeBrief.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        brand: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        _count: { select: { assets: true } },
      },
    });
    return ok(res, briefs);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const brief = await prisma.creativeBrief.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        brand: true,
        product: true,
        assets: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!brief) throw ApiError.notFound('Brief not found');
    return ok(res, brief);
  })
);

router.post(
  '/',
  validate({ body: briefBody }),
  asyncHandler(async (req, res) => {
    await ensureBrand(req.tenantId, req.body.brandId);
    const brief = await prisma.creativeBrief.create({
      data: { ...req.body, tenantId: req.tenantId, authorId: req.user.id },
    });
    return created(res, brief);
  })
);



router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ensureOwned('creativeBrief', req.tenantId, req.params.id);
    await prisma.creativeBrief.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);


export default router;
