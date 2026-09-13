import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { objectId, optionalObjectId, queryObjectId, POST_STATUSES } from '../../utils/validators.js';
import { schedulePublishJob, cancelPublishJob } from '../../jobs/agenda.js';
import { adaptForPlatforms, applyTransition, toWhatsApp, TRANSITIONS } from './post.service.js';

const router = Router();
router.use(authenticate);

const PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'GENERIC'];

const postBody = z.object({
  brandId: objectId('brandId'),                       // which brand this post belongs to
  title: z.string().max(160).optional().nullable(),   // short title, optional
  body: z.string().max(5000).default(''),             // the actual post text
  hashtags: z.array(z.string().max(60)).max(30).default([]),
  mediaUrls: z.array(z.string().max(2048)).max(4).default([]),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  scheduledAt: z.coerce.date().optional().nullable(),
  campaignId: optionalObjectId('campaignId'),
  platformCopy: z.record(z.string()).optional().nullable(),
});

const listQuery = z.object({
  brandId: queryObjectId('brandId'),
  campaignId: queryObjectId('campaignId'),
  authorId: queryObjectId('authorId'),
  status: z.enum(POST_STATUSES).optional(),
});

const idParam = { params: z.object({ id: objectId('post id') }) };

const listInclude = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  reviewer: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true, color: true } },
};

/** Build a tenant-scoped `where` from the (already validated) query. */
const scopedWhere = (req, extra = {}) => {
  const { brandId, status, campaignId, authorId } = req.query;
  return {
    tenantId: req.tenantId,
    ...(brandId ? { brandId } : {}),
    ...(status ? { status } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(authorId ? { authorId } : {}),
    ...extra,
  };
};

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const posts = await prisma.post.findMany({
      where: scopedWhere(req),
      include: listInclude,
      orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'desc' }],
    });
    return ok(res, posts);
  })
);

/**
 * Counts per status. The sidebar badge only needs a number, and pulling every
 * pending post (with its author, brand and campaign joined) to call `.length`
 * on the client was the most expensive query on every page of the app.
 */
router.get(
  '/stats',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const grouped = await prisma.post.groupBy({ by: ['status'], where: scopedWhere(req), _count: true });
    const byStatus = Object.fromEntries(POST_STATUSES.map((s) => [s, 0]));
    for (const row of grouped) byStatus[row.status] = row._count;
    return ok(res, { byStatus, total: grouped.reduce((sum, row) => sum + row._count, 0) });
  })
);

router.get(
  '/calendar',
  validate({
    query: listQuery.extend({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;

    const range = {};
    if (from) range.gte = from;
    if (to) range.lte = to;
    const hasDateRange = Object.keys(range).length > 0;

    const [scheduled, unscheduled] = await Promise.all([
      prisma.post.findMany({
        where: scopedWhere(req, { scheduledAt: hasDateRange ? range : { not: null } }),
        include: listInclude,
        orderBy: { scheduledAt: 'asc' },
      }),

      // Prisma stores an unset optional field by omitting it, and on MongoDB
      // `scheduledAt: null` does NOT match a missing key — so a post created
      // without the field at all (any client that omits it, e.g. the campaign
      // suggester's draft) was invisible in the backlog. Match both shapes.
      prisma.post.findMany({
        where: scopedWhere(req, {
          OR: [{ scheduledAt: null }, { scheduledAt: { isSet: false } }],
          status: { in: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] },
        }),
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    return ok(res, { scheduled, unscheduled });
  })
);

router.get(
  '/:id/whatsapp',
  validate(idParam),
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);
    return ok(res, toWhatsApp(post));
  })
);

router.post(
  '/:id/adapt',
  validate(idParam),
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { platformCopy: adaptForPlatforms(post) },
      include: listInclude,
    });
    return ok(res, updated);
  })
);

router.get(
  '/:id',
  validate(idParam),
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        ...listInclude,
        activities: {
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        publications: true,
        publishJobs: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });
    if (!post) throw ApiError.notFound('Post not found');
    return ok(res, post);
  })
);

router.post(
  '/',
  validate({ body: postBody }),
  asyncHandler(async (req, res) => {
    await ensureBrand(req.tenantId, req.body.brandId);
    const post = await prisma.post.create({
      data: { ...req.body, tenantId: req.tenantId, authorId: req.user.id },
      include: listInclude,
    });
    return created(res, post);
  })
);

router.patch(
  '/:id',
  validate({ ...idParam, body: postBody.partial().omit({ brandId: true }) }),
  asyncHandler(async (req, res) => {
    const existing = await ensureOwned('post', req.tenantId, req.params.id);
    if (['PUBLISHING', 'PUBLISHED'].includes(existing.status)) {
      throw ApiError.badRequest('Published posts cannot be edited');
    }
    const post = await prisma.post.update({
      where: { id: existing.id },
      data: req.body,
      include: listInclude,
    });
    return ok(res, post);
  })
);

router.delete(
  '/:id',
  validate(idParam),
  asyncHandler(async (req, res) => {
    await ensureOwned('post', req.tenantId, req.params.id);
    await cancelPublishJob(req.params.id);
    await prisma.post.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);

router.patch(
  '/:id/reschedule',
  validate({ ...idParam, body: z.object({ scheduledAt: z.coerce.date() }) }),
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { scheduledAt: req.body.scheduledAt },
      include: listInclude,
    });

    if (post.status === 'SCHEDULED') {
      await cancelPublishJob(post.id);
      await schedulePublishJob(updated, req.body.scheduledAt);
    }
    return ok(res, updated);
  })
);

/**
 * Lifecycle transitions (submit / approve / reject / schedule / unschedule /
 * publish / archive). The state machine itself stays pure — the publish queue
 * is synced here, because a status change that isn't mirrored in Agenda leaves
 * a post either stuck at PUBLISHING or "scheduled" but never sent.
 */
router.post(
  '/:id/:action',
  validate({
    params: z.object({
      id: objectId('post id'),
      action: z.enum(Object.keys(TRANSITIONS)),
    }),
    body: z
      .object({ note: z.string().max(1000).optional(), reason: z.string().max(1000).optional(), scheduledAt: z.coerce.date().optional() })
      .partial()
      .default({}),
  }),
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);
    const { action } = req.params;

    const updated = await applyTransition({ post, action, actor: req.user, data: req.body });

    if (updated.status === 'SCHEDULED') {
      // Re-scheduling replaces any job already queued for this post.
      await cancelPublishJob(post.id);
      await schedulePublishJob(updated, updated.scheduledAt);
    } else if (updated.status === 'PUBLISHING') {
      await schedulePublishJob(updated); // no runAt → publish immediately
    } else if (['unschedule', 'archive'].includes(action)) {
      await cancelPublishJob(post.id);
    }

    return ok(res, updated);
  })
);

export default router;
