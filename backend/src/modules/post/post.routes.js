import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { schedulePublishJob, cancelPublishJob } from '../../jobs/agenda.js';

// ============================================================================
// FEATURE 2 — Post Editor & Content Calendar CRUD
// This file only contains routes for creating, viewing, editing, deleting,
// and rescheduling posts. Other features (approvals, WhatsApp export, etc.)
// live in a different part of the project and are not included here.
// ============================================================================

const router = Router();

// Every route below requires the user to be logged in first.
router.use(authenticate);

// The platforms a post can be sent to.
const PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'GENERIC'];

// This describes exactly what fields are allowed when creating or editing
// a post. If the frontend sends something that doesn't match this shape,
// the request gets rejected automatically before it ever reaches our code.
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

// Whenever we fetch a post from the database, also grab these extra
// related details (like the author's name) so the frontend doesn't have
// to make separate requests for them.
const listInclude = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  reviewer: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true, color: true } },
};

// ----------------------------------------------------------------------------
// GET /api/posts
// Returns a list of posts. You can narrow it down with query filters,
// e.g. /api/posts?status=DRAFT&brandId=123
// ----------------------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Step 1: Read whatever filters the frontend sent in the URL.
    const { brandId, status, campaignId, authorId } = req.query;

    // Step 2: Always search only inside the current user's own workspace.
    // This is important for security — it stops one company from seeing
    // another company's posts.
    const where = { tenantId: req.tenantId };

    // Step 3: Only add a filter if the user actually asked for it.
    if (brandId) where.brandId = brandId;
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;
    if (authorId) where.authorId = authorId;

    // Step 4: Ask the database for every post matching our filters.
    const posts = await prisma.post.findMany({
      where,
      include: listInclude,
      // Show posts with the soonest scheduled date first. If two posts
      // have no date, show whichever was edited most recently.
      orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'desc' }],
    });

    // Step 5: Send the list back to the frontend.
    return ok(res, posts);
  })
);

// ----------------------------------------------------------------------------
// GET /api/posts/calendar
// Used by the Calendar page. Returns two separate lists: posts that
// already have a date (shown on the calendar grid) and posts that don't
// have a date yet (shown in a "backlog" sidebar).
// ----------------------------------------------------------------------------
router.get(
  '/calendar',
  asyncHandler(async (req, res) => {
    // Step 1: Read which brand and date range the calendar is asking for.
    const { brandId, from, to } = req.query;

    // Step 2: Build the date range filter.
    //   gte = "greater than or equal to" -> the start of the range
    //   lte = "less than or equal to"    -> the end of the range
    const range = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);

    // Step 3: Every query below needs to search inside this user's
    // workspace, and optionally only inside one brand.
    const base = { tenantId: req.tenantId };
    if (brandId) base.brandId = brandId;

    // Step 4: Check whether we were given a date range at all.
    const hasDateRange = Object.keys(range).length > 0;

    // Step 5: Run both database lookups at the same time (this is faster
    // than doing them one after another).
    const [scheduledPosts, unscheduledPosts] = await Promise.all([
      // 5a) Posts that DO have a scheduled date, inside our date range.
      prisma.post.findMany({
        where: {
          ...base,
          scheduledAt: hasDateRange ? range : { not: null },
        },
        include: listInclude,
        orderBy: { scheduledAt: 'asc' },
      }),

      // 5b) Posts that DON'T have a date yet — these are drafts or
      // posts waiting to be scheduled. We only grab the newest 50 so
      // the sidebar doesn't get overloaded.
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

    // Step 6: Send both lists back together.
    return ok(res, { scheduled: scheduledPosts, unscheduled: unscheduledPosts });
  })
);

// ----------------------------------------------------------------------------
// GET /api/posts/:id
// Returns ONE post with full details — used when opening a post in the
// editor to see everything about it.
// ----------------------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    // Step 1: Look up the post, but only if it belongs to this workspace.
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        ...listInclude,
        // Also include the post's history (status changes, edits, etc.)
        activities: {
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        publications: true,
        publishJobs: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });

    // Step 2: If nothing was found, stop here and send a clear error.
    if (!post) {
      throw ApiError.notFound('Post not found');
    }

    // Step 3: Send the post back.
    return ok(res, post);
  })
);

// ----------------------------------------------------------------------------
// POST /api/posts
// Creates a brand new post. Used by the "New Post" button in the editor.
// ----------------------------------------------------------------------------
router.post(
  '/',
  validate({ body: postBody }),
  asyncHandler(async (req, res) => {
    // Step 1: Make sure the brand this post is for actually exists and
    // belongs to this user's workspace.
    await ensureBrand(req.tenantId, req.body.brandId);

    // Step 2: Create the post. We attach tenantId (their workspace) and
    // authorId (whoever is logged in) automatically — the frontend
    // never has to send these itself.
    const newPost = await prisma.post.create({
      data: {
        ...req.body,
        tenantId: req.tenantId,
        authorId: req.user.id,
      },
      include: listInclude,
    });

    // Step 3: Send back the new post, with a "201 Created" response.
    return created(res, newPost);
  })
);

// ----------------------------------------------------------------------------
// PATCH /api/posts/:id
// Edits an existing post (title, text, media, date, etc.).
// ----------------------------------------------------------------------------
router.patch(
  '/:id',
  validate({ body: postBody.partial().omit({ brandId: true }) }),
  asyncHandler(async (req, res) => {
    // Step 1: Find the post and make sure it belongs to this workspace.
    const existingPost = await ensureOwned('post', req.tenantId, req.params.id);

    // Step 2: Once a post is being published or already published, we
    // don't allow further edits — that could cause confusing bugs.
    const cannotBeEdited = ['PUBLISHING', 'PUBLISHED'].includes(existingPost.status);
    if (cannotBeEdited) {
      throw ApiError.badRequest('Published posts cannot be edited');
    }

    // Step 3: Save whatever new fields the frontend sent.
    const updatedPost = await prisma.post.update({
      where: { id: req.params.id },
      data: req.body,
      include: listInclude,
    });

    // Step 4: Send back the updated post.
    return ok(res, updatedPost);
  })
);

// ----------------------------------------------------------------------------
// DELETE /api/posts/:id
// Deletes a post permanently.
// ----------------------------------------------------------------------------
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // Step 1: Make sure the post exists and belongs to this workspace.
    await ensureOwned('post', req.tenantId, req.params.id);

    // Step 2: If this post had a background job waiting to auto-publish
    // it, cancel that job first — we don't want it publishing a post
    // that no longer exists.
    await cancelPublishJob(req.params.id);

    // Step 3: Actually delete the post from the database.
    await prisma.post.delete({ where: { id: req.params.id } });

    // Step 4: Tell the frontend the delete worked.
    return ok(res, { deleted: true });
  })
);

// ----------------------------------------------------------------------------
// PATCH /api/posts/:id/reschedule
// This runs when a user DRAGS a post to a new day on the calendar.
// It only changes the date — nothing else about the post.
// ----------------------------------------------------------------------------
router.patch(
  '/:id/reschedule',
  validate({ body: z.object({ scheduledAt: z.coerce.date() }) }),
  asyncHandler(async (req, res) => {
    // Step 1: Make sure the post exists and belongs to this workspace.
    const post = await ensureOwned('post', req.tenantId, req.params.id);

    // Step 2: Update just the scheduled date.
    const updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: { scheduledAt: req.body.scheduledAt },
      include: listInclude,
    });

    // Step 3: If this post was already set to auto-publish at a specific
    // time, we need to cancel that old timer and create a new one at the
    // new time — otherwise it would still fire at the old (wrong) time.
    if (post.status === 'SCHEDULED') {
      await cancelPublishJob(post.id);
      await schedulePublishJob(updatedPost, req.body.scheduledAt);
    }

    // Step 4: Send back the post with its new date.
    return ok(res, updatedPost);
  })
);

export default router;