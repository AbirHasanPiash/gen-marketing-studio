import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { applyTransition, adaptForPlatforms, toWhatsApp } from './post.service.js';
import { schedulePublishJob, cancelPublishJob, retryPublishJob } from '../../jobs/agenda.js';

const router = Router();
router.use(authenticate);

const PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'GENERIC'];

const postBody = z.object({
  brandId: z.string().min(1),
  title: z.string().max(160).optional().nullable(),
  body: z.string().max(5000).default(''),
  hashtags: z.array(z.string()).default([]),
  mediaUrls: z.array(z.string()).default([]),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  scheduledAt: z.coerce.date().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  platformCopy: z.record(z.string()).optional().nullable(),
});

const listInclude = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  reviewer: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true, color: true } },
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { brandId, status, campaignId, authorId } = req.query;
    const where = {
      tenantId: req.tenantId,
      ...(brandId ? { brandId } : {}),
      ...(status ? { status } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(authorId ? { authorId } : {}),
    };
    const posts = await prisma.post.findMany({
      where,
      include: listInclude,
      orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'desc' }],
    });
    return ok(res, posts);
  })
);

/** Calendar feed: scheduled posts within range + an unscheduled backlog. */
router.get(
  '/calendar',
  asyncHandler(async (req, res) => {
    const { brandId, from, to } = req.query;
    const range = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);

    const base = { tenantId: req.tenantId, ...(brandId ? { brandId } : {}) };
    const [scheduled, unscheduled] = await Promise.all([
      prisma.post.findMany({
        where: { ...base, scheduledAt: Object.keys(range).length ? range : { not: null } },
        include: listInclude,
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.post.findMany({
        where: { ...base, scheduledAt: null, status: { in: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] } },
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);
    return ok(res, { scheduled, unscheduled });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        ...listInclude,
        activities: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
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
  validate({ body: postBody.partial().omit({ brandId: true }) }),
  asyncHandler(async (req, res) => {
    const existing = await ensureOwned('post', req.tenantId, req.params.id);
    if (['PUBLISHING', 'PUBLISHED'].includes(existing.status))
      throw ApiError.badRequest('Published posts cannot be edited');
    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: req.body,
      include: listInclude,
    });
    return ok(res, post);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ensureOwned('post', req.tenantId, req.params.id);
    await cancelPublishJob(req.params.id);
    await prisma.post.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);

/** Drag-to-reschedule on the calendar. Reschedules the job if already SCHEDULED. */
router.patch(
  '/:id/reschedule',
  validate({ body: z.object({ scheduledAt: z.coerce.date() }) }),
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

// --- Lifecycle transitions (Feature 4) -------------------------------------

const transitionRoute = (action, schema) =>
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);
    const data = schema ? schema.parse(req.body) : {};
    const updated = await applyTransition({ post, action, actor: req.user, data });

    if (action === 'schedule') await schedulePublishJob(updated, updated.scheduledAt);
    if (action === 'unschedule') await cancelPublishJob(post.id);
    if (action === 'publish') await schedulePublishJob(updated, new Date());

    const full = await prisma.post.findUnique({ where: { id: post.id }, include: listInclude });
    return ok(res, full);
  });

router.post('/:id/submit', transitionRoute('submit'));
router.post('/:id/approve', transitionRoute('approve', z.object({ note: z.string().max(500).optional() })));
router.post('/:id/reject', transitionRoute('reject', z.object({ reason: z.string().max(500).optional() })));
router.post('/:id/schedule', transitionRoute('schedule', z.object({ scheduledAt: z.coerce.date() })));
router.post('/:id/unschedule', transitionRoute('unschedule'));
router.post('/:id/publish', transitionRoute('publish'));
router.post('/:id/archive', transitionRoute('archive'));

router.post(
  '/:id/retry',
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);
    if (post.status !== 'FAILED') throw ApiError.badRequest('Only failed posts can be retried');
    await retryPublishJob(post.id);
    return ok(res, { retried: true });
  })
);

// --- Multi-platform adaptation (F11) & WhatsApp export (F12) ----------------

router.post(
  '/:id/adapt',
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);
    const platformCopy = adaptForPlatforms(post);
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { platformCopy },
      include: listInclude,
    });
    return ok(res, updated);
  })
);

router.get(
  '/:id/whatsapp',
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);
    return ok(res, toWhatsApp(post));
  })
);

router.get(
  '/:id/activities',
  asyncHandler(async (req, res) => {
    await ensureOwned('post', req.tenantId, req.params.id);
    const activities = await prisma.postActivity.findMany({
      where: { postId: req.params.id },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, activities);
  })
);

export default router;
