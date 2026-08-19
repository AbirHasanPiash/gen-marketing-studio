import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { schedulePublishJob, cancelPublishJob } from '../../jobs/agenda.js';
import { applyTransition } from './post.service.js';


const router = Router();

router.use(authenticate);


const PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'GENERIC'];


const postBody = z.object({
  brandId: z.string().min(1),               // which brand this post belongs to (required)
  title: z.string().max(160).optional().nullable(),   // short title, optional
  body: z.string().max(5000).default(''),    // the actual post text
  hashtags: z.array(z.string()).default([]), // list of hashtags, e.g. ["sale", "eid"]
  mediaUrls: z.array(z.string()).default([]),// list of image/video links
  platforms: z.array(z.enum(PLATFORMS)).default([]), // which platforms to post to
  scheduledAt: z.coerce.date().optional().nullable(), // when it should go live
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

    
    const where = { tenantId: req.tenantId };

    
    if (brandId) where.brandId = brandId;
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;
    if (authorId) where.authorId = authorId;

    
    const posts = await prisma.post.findMany({
      where,
      include: listInclude,
      
      orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'desc' }],
    });

    
    return ok(res, posts);
  })
);


router.get(
  '/calendar',
  asyncHandler(async (req, res) => {
    
    const { brandId, from, to } = req.query;

   
    const range = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);

    
    const base = { tenantId: req.tenantId };
    if (brandId) base.brandId = brandId;

    
    const hasDateRange = Object.keys(range).length > 0;

    
    const [scheduledPosts, unscheduledPosts] = await Promise.all([
      
      prisma.post.findMany({
        where: {
          ...base,
          scheduledAt: hasDateRange ? range : { not: null },
        },
        include: listInclude,
        orderBy: { scheduledAt: 'asc' },
      }),

      
      prisma.post.findMany({
        where: {
          ...base,
          scheduledAt: null,
          status: { in: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] },
        },
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    
    return ok(res, { scheduled: scheduledPosts, unscheduled: unscheduledPosts });
  })
);


router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        ...listInclude,
        
        activities: {
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        publications: true,
        publishJobs: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });

    
    if (!post) {
      throw ApiError.notFound('Post not found');
    }

    
    return ok(res, post);
  })
);


router.post(
  '/',
  validate({ body: postBody }),
  asyncHandler(async (req, res) => {
    
    await ensureBrand(req.tenantId, req.body.brandId);

    
    const newPost = await prisma.post.create({
      data: {
        ...req.body,
        tenantId: req.tenantId,
        authorId: req.user.id,
      },
      include: listInclude,
    });

    
    return created(res, newPost);
  })
);


router.patch(
  '/:id',
  validate({ body: postBody.partial().omit({ brandId: true }) }),
  asyncHandler(async (req, res) => {
    
    const existingPost = await ensureOwned('post', req.tenantId, req.params.id);

    
    const cannotBeEdited = ['PUBLISHING', 'PUBLISHED'].includes(existingPost.status);
    if (cannotBeEdited) {
      throw ApiError.badRequest('Published posts cannot be edited');
    }

    
    const updatedPost = await prisma.post.update({
      where: { id: req.params.id },
      data: req.body,
      include: listInclude,
    });

    
    return ok(res, updatedPost);
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


router.patch(
  '/:id/reschedule',
  validate({ body: z.object({ scheduledAt: z.coerce.date() }) }),
  asyncHandler(async (req, res) => {
    
    const post = await ensureOwned('post', req.tenantId, req.params.id);

    
    const updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: { scheduledAt: req.body.scheduledAt },
      include: listInclude,
    });

    
    if (post.status === 'SCHEDULED') {
      await cancelPublishJob(post.id);
      await schedulePublishJob(updatedPost, req.body.scheduledAt);
    }

    
    return ok(res, updatedPost);
  })
);

router.post(
  '/:id/:action',
  asyncHandler(async (req, res) => {
    const post = await ensureOwned('post', req.tenantId, req.params.id);

    const updated = await applyTransition({
      post,
      action: req.params.action,
      actor: req.user,
      data: req.body,
    });

    return ok(res, updated);
  })
);

export default router;
