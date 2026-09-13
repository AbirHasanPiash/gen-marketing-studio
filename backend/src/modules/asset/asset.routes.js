import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created, paginate, pageMeta } from '../../utils/http.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { ApiError } from '../../utils/ApiError.js';
import { objectId, optionalObjectId, queryObjectId, pageQuery, searchQuery } from '../../utils/validators.js';
import { generationLimiter } from '../../middleware/rateLimit.js';
import { generateFromPrompt, SIZE_PRESETS } from './asset.service.js';

const router = Router();
router.use(authenticate);

const assetBody = z.object({
  url: z.string().min(1).max(2048),
  thumbnailUrl: z.string().max(2048).optional().nullable(),
  type: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
  source: z.enum(['UPLOAD', 'AI_GENERATED', 'COMPOSITED', 'VIDEO_RENDER']).default('AI_GENERATED'),
  prompt: z.string().max(2000).optional().nullable(),
  brandId: optionalObjectId('brandId'),
  briefId: optionalObjectId('briefId'),
  cloudinaryId: z.string().max(300).optional().nullable(),
  width: z.coerce.number().int().optional().nullable(),
  height: z.coerce.number().int().optional().nullable(),
  colors: z.any().optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  parentAssetId: optionalObjectId('parentAssetId'),
});

const idParam = { params: z.object({ id: objectId('asset id') }) };

// --- Text-to-image generation (Feature 7) --------------

router.get('/sizes', (_req, res) => ok(res, SIZE_PRESETS));

router.post(
  '/generate',
  generationLimiter,
  validate({
    body: z.object({
      prompt: z.string().min(3).max(1000),
      size: z.enum(['square', 'portrait', 'story', 'landscape']).default('square'),
      count: z.coerce.number().int().min(1).max(4).default(2),
      force: z.boolean().default(false),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await generateFromPrompt({ tenantId: req.tenantId, ...req.body });
    return ok(res, result);
  })
);

/** High-performing / most-reused prompts (Feature 7 cache view). */
router.get(
  '/cache',
  asyncHandler(async (req, res) => {
    const entries = await prisma.promptCache.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ performance: 'desc' }, { hitCount: 'desc' }, { lastUsedAt: 'desc' }],
      take: 50,
    });
    return ok(res, entries);
  })
);

router.post(
  '/cache/:id/boost',
  validate({ params: z.object({ id: objectId('cache id') }) }),
  asyncHandler(async (req, res) => {
    const entry = await ensureOwned('promptCache', req.tenantId, req.params.id);
    const updated = await prisma.promptCache.update({
      where: { id: entry.id },
      data: { performance: { increment: 1 } },
    });
    return ok(res, updated);
  })
);

// --- Versioned gallery (Feature 3) -----------------------------------------

router.get(
  '/',
  validate({
    query: pageQuery(24, 60).extend({
      brandId: queryObjectId('brandId'),
      briefId: queryObjectId('briefId'),
      type: z.enum(['IMAGE', 'VIDEO']).optional(),
      source: z.enum(['UPLOAD', 'AI_GENERATED', 'COMPOSITED', 'VIDEO_RENDER']).optional(),
      tag: searchQuery(40),
      favorite: z.enum(['true', 'false']).optional(),
      search: searchQuery(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = paginate(req.query, { defaultLimit: 24, maxLimit: 60 });
    const { brandId, briefId, type, source, tag, favorite, search } = req.query;
    const where = {
      tenantId: req.tenantId,
      ...(brandId ? { brandId } : {}),
      ...(briefId ? { briefId } : {}),
      ...(type ? { type } : {}),
      ...(source ? { source } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(favorite === 'true' ? { isFavorite: true } : {}),
      ...(search
        ? { OR: [{ prompt: { contains: search, mode: 'insensitive' } }, { tags: { has: search } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { _count: { select: { versions: true } }, brief: { select: { id: true, title: true } } },
      }),
      prisma.asset.count({ where }),
    ]);
    return ok(res, items, pageMeta(page, limit, total));
  })
);

router.get(
  '/:id',
  validate(idParam),
  asyncHandler(async (req, res) => {
    const asset = await prisma.asset.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { versions: { orderBy: { version: 'desc' } }, parentAsset: true, brief: true },
    });
    if (!asset) throw ApiError.notFound('Asset not found');
    return ok(res, asset);
  })
);

router.post(
  '/',
  validate({ body: assetBody }),
  asyncHandler(async (req, res) => {
    if (req.body.brandId) await ensureBrand(req.tenantId, req.body.brandId);
    let version = 1;
    let parentAssetId = req.body.parentAssetId || null;
    if (parentAssetId) {
      const parent = await ensureOwned('asset', req.tenantId, parentAssetId);
      const root = parent.parentAssetId || parent.id;
      parentAssetId = root;
      const siblings = await prisma.asset.aggregate({
        where: { OR: [{ id: root }, { parentAssetId: root }] },
        _max: { version: true },
      });
      version = (siblings._max.version || 1) + 1;
    }
    const asset = await prisma.asset.create({
      data: { ...req.body, parentAssetId, version, tenantId: req.tenantId },
    });
    return created(res, asset);
  })
);

router.post(
  '/:id/version',
  validate({ ...idParam, body: assetBody.partial().extend({ url: z.string().min(1).max(2048) }) }),
  asyncHandler(async (req, res) => {
    const parent = await ensureOwned('asset', req.tenantId, req.params.id);
    const root = parent.parentAssetId || parent.id;
    const agg = await prisma.asset.aggregate({
      where: { OR: [{ id: root }, { parentAssetId: root }] },
      _max: { version: true },
    });
    const asset = await prisma.asset.create({
      data: {
        tenantId: req.tenantId,
        parentAssetId: root,
        version: (agg._max.version || 1) + 1,
        url: req.body.url,
        thumbnailUrl: req.body.thumbnailUrl,
        type: parent.type,
        source: req.body.source || parent.source,
        prompt: req.body.prompt ?? parent.prompt,
        brandId: req.body.brandId ?? parent.brandId,
        briefId: req.body.briefId ?? parent.briefId,
        tags: req.body.tags ?? parent.tags,
        colors: req.body.colors ?? parent.colors,
      },
    });
    return created(res, asset);
  })
);

router.patch(
  '/:id',
  validate({
    ...idParam,
    body: z.object({
      tags: z.array(z.string().max(40)).max(20).optional(),
      isFavorite: z.boolean().optional(),
      performance: z.coerce.number().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await ensureOwned('asset', req.tenantId, req.params.id);
    const asset = await prisma.asset.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, asset);
  })
);

router.delete(
  '/:id',
  validate(idParam),
  asyncHandler(async (req, res) => {
    await ensureOwned('asset', req.tenantId, req.params.id);
    await prisma.asset.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);

export default router;
