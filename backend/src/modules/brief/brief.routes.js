import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { objectId, optionalObjectId } from '../../utils/validators.js';
import { generateFromPrompt, buildPromptFromBrief } from '../asset/asset.service.js';


const router = Router();
router.use(authenticate);

/** Tags are stored lowercase and whitespace-collapsed, so "Eid " and "EID" are one tag. */
const normalizeTag = (t) => String(t).trim().toLowerCase().replace(/\s+/g, ' ');
const uniqueTags = (list = []) => [...new Set(list.map(normalizeTag).filter(Boolean))];

/** "Eid hero" -> "Eid hero (copy)" -> "Eid hero (copy 2)" ... never collides. */
async function nextCopyTitle(tenantId, title) {
  const root = title.replace(/\s*\(copy(\s+\d+)?\)$/i, '');
  const existing = await prisma.creativeBrief.findMany({
    where: { tenantId, title: { startsWith: root } },
    select: { title: true },
  });
  const taken = new Set(existing.map((b) => b.title));
  if (!taken.has(`${root} (copy)`)) return `${root} (copy)`;
  let n = 2;
  while (taken.has(`${root} (copy ${n})`)) n += 1;
  return `${root} (copy ${n})`;
}

const briefBody = z.object({
  title: z.string().min(2).max(160),
  brandId: objectId('brandId'),
  productId: optionalObjectId('productId'),
  productRef: z.string().max(160).optional().nullable(),
  style: z.string().max(80).optional().nullable(),
  mood: z.string().max(80).optional().nullable(),
  palette: z.string().max(120).optional().nullable(),
  references: z.array(z.string()).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: z.string().max(2000).optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { brandId, status, search, tag } = req.query;
    const where = {
      tenantId: req.tenantId,
      ...(brandId ? { brandId } : {}),
      ...(status ? { status } : {}),
      ...(tag ? { tags: { has: normalizeTag(tag) } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: String(search), mode: 'insensitive' } },
              { tags: { has: normalizeTag(search) } },
            ],
          }
        : {}),
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

/** Distinct tags in this workspace with usage counts — powers the filter chips. */
router.get(
  '/tags',
  asyncHandler(async (req, res) => {
    const briefs = await prisma.creativeBrief.findMany({
      where: { tenantId: req.tenantId, ...(req.query.brandId ? { brandId: req.query.brandId } : {}) },
      select: { tags: true },
    });
    const counts = new Map();
    for (const b of briefs) for (const t of b.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    const tags = [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return ok(res, tags);
  })
);

/**
 * Add and/or remove tags across many briefs at once.
 */
router.post(
  '/bulk/tags',
  validate({
    body: z
      .object({
        ids: z.array(objectId('brief id')).min(1).max(100),
        add: z.array(z.string().trim().min(1).max(40)).default([]),
        remove: z.array(z.string().trim().min(1).max(40)).default([]),
      })
      .refine((v) => v.add.length || v.remove.length, {
        message: 'Provide at least one tag to add or remove',
      }),
  }),
  asyncHandler(async (req, res) => {
    const add = uniqueTags(req.body.add);
    const remove = new Set(uniqueTags(req.body.remove));

    // Tenant scoping happens here: ids from another workspace simply don't come
    // back, so they can never be written to.
    const briefs = await prisma.creativeBrief.findMany({
      where: { id: { in: req.body.ids }, tenantId: req.tenantId },
      select: { id: true, tags: true },
    });
    if (!briefs.length) throw ApiError.notFound('No briefs matched');

    const writes = [];
    for (const b of briefs) {
      const current = b.tags || [];
      const next = uniqueTags([...current, ...add]).filter((t) => !remove.has(t));
      const unchanged = next.length === current.length && next.every((t, i) => t === current[i]);
      if (!unchanged) writes.push(prisma.creativeBrief.update({ where: { id: b.id }, data: { tags: next } }));
    }
    const updated = writes.length ? await prisma.$transaction(writes) : [];

    return ok(res, {
      matched: briefs.length,
      updated: updated.length,
      skipped: briefs.length - updated.length,
      briefs: updated,
    });
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

/**
 * Duplicate a brief as the starting point for a new one. The copy carries the
 */
router.post(
  '/:id/duplicate',
  validate({ body: z.object({ title: z.string().min(2).max(160).optional() }).default({}) }),
  asyncHandler(async (req, res) => {
    const source = await prisma.creativeBrief.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!source) throw ApiError.notFound('Brief not found');

    const copy = await prisma.creativeBrief.create({
      data: {
        tenantId: req.tenantId,
        brandId: source.brandId,
        productId: source.productId,
        authorId: req.user.id, // whoever duplicated it owns the copy
        title: req.body.title?.trim() || (await nextCopyTitle(req.tenantId, source.title)),
        productRef: source.productRef,
        style: source.style,
        mood: source.mood,
        palette: source.palette,
        notes: source.notes,
        references: source.references,
        tags: source.tags,
        prompt: null, // recompiled from the (possibly edited) copy
        status: 'DRAFT', // a copy has never been generated
        isDuplicate: true,
      },
    });
    return created(res, copy);
  })
);

/**
 * Edit a brief, including its tags. The client sends the whole next tag array,
 * so adding and removing are the same idempotent call.
 * `brandId` is omitted so a brief can't be moved past `ensureBrand`.
 */
router.patch(
  '/:id',
  validate({ body: briefBody.partial().omit({ brandId: true }) }),
  asyncHandler(async (req, res) => {
    await ensureOwned('creativeBrief', req.tenantId, req.params.id);
    const data = { ...req.body };
    if (data.tags) data.tags = uniqueTags(data.tags);
    const brief = await prisma.creativeBrief.update({ where: { id: req.params.id }, data });
    return ok(res, brief);
  })
);



/** Resolve the brief + brand kit into a prompt and run cached text-to-image. */
router.post(
  '/:id/generate',
  validate({
    body: z.object({
      size: z.enum(['square', 'portrait', 'story', 'landscape']).default('square'),
      count: z.coerce.number().int().min(1).max(4).default(2),
      force: z.boolean().default(false),
    }),
  }),
  asyncHandler(async (req, res) => {
    const brief = await prisma.creativeBrief.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { brand: true, product: true },
    });
    if (!brief) throw ApiError.notFound('Brief not found');

    const prompt = buildPromptFromBrief(brief, brief.brand);
    await prisma.creativeBrief.update({
      where: { id: brief.id },
      data: { status: 'GENERATING', prompt },
    });

    try {
      const result = await generateFromPrompt({
        tenantId: req.tenantId,
        prompt,
        ...req.body,
      });
      await prisma.creativeBrief.update({
        where: { id: brief.id },
        data: { status: 'COMPLETED' },
      });
      return ok(res, result);
    } catch (err) {
      await prisma.creativeBrief.update({
        where: { id: brief.id },
        data: { status: 'DRAFT' },
      });
      throw err;
    }
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
