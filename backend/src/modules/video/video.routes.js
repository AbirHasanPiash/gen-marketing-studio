import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../lib/logger.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { objectId, optionalObjectId, queryObjectId } from '../../utils/validators.js';
import { generationLimiter } from '../../middleware/rateLimit.js';
import { generateFromPrompt } from '../asset/asset.service.js';
import {
  renderVideo,
  ffmpegCapabilities,
  captionSupport,
  isRendering,
  resolveDurations,
  validateDurations,
  alignDurations,
  cleanupProjectFiles,
} from './video.service.js';

const router = Router();
router.use(authenticate);

/** Aspect ratio -> the Image Studio size preset that matches it. */
const ASPECT_TO_SIZE = { '9:16': 'story', '1:1': 'square', '16:9': 'landscape' };

const videoBody = z.object({
  title: z.string().min(1).max(160),
  brandId: optionalObjectId('brandId'),
  images: z.array(z.string().min(1).max(2048)).min(1).max(8),
  captions: z.array(z.string().max(200)).max(8).default([]),
  durations: z.array(z.coerce.number().min(0.5).max(30)).default([]),
  audioUrl: z.string().max(2048).optional().nullable(),
  durationS: z.coerce.number().int().min(5).max(30).default(10),
  aspect: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
});

router.get(
  '/status/ffmpeg',
  asyncHandler(async (_req, res) => {
    const caps = await ffmpegCapabilities({ refresh: true });
    return ok(res, { available: caps.available, drawtext: caps.drawtext, captions: await captionSupport() });
  })
);

const idParam = { params: z.object({ id: objectId('video id') }) };

router.get(
  '/',
  validate({ query: z.object({ brandId: queryObjectId('brandId') }) }),
  asyncHandler(async (req, res) => {
    const where = { tenantId: req.tenantId, ...(req.query.brandId ? { brandId: req.query.brandId } : {}) };
    const videos = await prisma.videoProject.findMany({ where, orderBy: { createdAt: 'desc' } });
    return ok(res, videos);
  })
);

/** The resolved per-scene timeline, and whether it is renderable. */
router.get(
  '/:id/timeline',
  validate(idParam),
  asyncHandler(async (req, res) => {
    const project = await ensureOwned('videoProject', req.tenantId, req.params.id);
    const durations = resolveDurations(project);
    return ok(res, {
      scenes: (project.images || []).map((image, i) => ({
        index: i,
        image,
        caption: project.captions?.[i] || '',
        duration: durations[i],
      })),
      durations,
      ...validateDurations(durations, project.durationS),
    });
  })
);

router.get(
  '/:id',
  validate(idParam),
  asyncHandler(async (req, res) => ok(res, await ensureOwned('videoProject', req.tenantId, req.params.id)))
);

router.post(
  '/',
  validate({ body: videoBody }),
  asyncHandler(async (req, res) => {
    if (req.body.brandId) await ensureBrand(req.tenantId, req.body.brandId);
    const durations = alignDurations(req.body.durations, req.body.images.length, req.body.durationS);
    const video = await prisma.videoProject.create({
      data: { ...req.body, durations, tenantId: req.tenantId },
    });
    return created(res, video);
  })
);

router.patch(
  '/:id',
  validate({ ...idParam, body: videoBody.partial() }),
  asyncHandler(async (req, res) => {
    const current = await ensureOwned('videoProject', req.tenantId, req.params.id);
    const data = { ...req.body };
    // Durations are index-aligned with images, so any change to either has to
    // re-align them: extras dropped, new scenes given a share of what's left.
    if (data.images || data.durations || data.durationS) {
      const images = data.images ?? current.images;
      const target = data.durationS ?? current.durationS;
      data.durations = alignDurations(data.durations ?? current.durations, images.length, target);
    }
    const video = await prisma.videoProject.update({ where: { id: req.params.id }, data });
    return ok(res, video);
  })
);

/** Kick off a background render, returns immediately with RENDERING status. */
router.post(
  '/:id/render',
  validate(idParam),
  asyncHandler(async (req, res) => {
    const video = await ensureOwned('videoProject', req.tenantId, req.params.id);
    if (video.status === 'RENDERING' || isRendering(video.id)) {
      throw ApiError.conflict('This reel is already rendering');
    }

    // Recompute and validate the timeline before anything is queued.
    const check = validateDurations(resolveDurations(video), video.durationS);
    if (!check.valid) {
      throw ApiError.badRequest(
        `Scene durations add up to ${check.total}s but the reel is set to ${check.target}s ` +
          `(off by ${check.delta > 0 ? '+' : ''}${check.delta}s).`,
        check
      );
    }

    // Persist RENDERING *before* replying: the client starts polling off the
    // status it gets back, and the background job can't win that race.
    // outputUrl is left alone, so the previous render stays playable throughout.
    const queued = await prisma.videoProject.update({
      where: { id: video.id },
      data: { status: 'RENDERING', error: null, warning: null },
    });
    renderVideo(video.id).catch((err) => logger.error(`Video ${video.id} render rejected:`, err));
    return ok(res, queued);
  })
);

/**
 * Regenerate ONE scene — a new still (uploaded, linked, or generated from a
 * prompt), a new caption, a new duration — then re-render. Only that scene's
 * content hash changes, so only its segment is re-encoded; every other scene is
 * stream-copied straight out of the segment cache.
 */
router.post(
  '/:id/scenes/:index/regenerate',
  generationLimiter,
  validate({
    params: z.object({ id: objectId('video id'), index: z.coerce.number().int().min(0).max(7) }),
    body: z.object({
      image: z.string().min(1).optional(),
      caption: z.string().max(200).optional(),
      duration: z.coerce.number().min(0.5).max(30).optional(),
      prompt: z.string().min(3).max(1000).optional(),
      render: z.boolean().default(true),
    }),
  }),
  asyncHandler(async (req, res) => {
    const video = await ensureOwned('videoProject', req.tenantId, req.params.id);
    if (video.status === 'RENDERING' || isRendering(video.id)) {
      throw ApiError.conflict('This reel is already rendering');
    }

    const i = req.params.index;
    if (i >= video.images.length) {
      throw ApiError.badRequest(`Scene ${req.params.index} does not exist on this reel`);
    }

    let image = req.body.image ?? video.images[i];
    if (req.body.prompt) {
      const gen = await generateFromPrompt({
        tenantId: req.tenantId,
        prompt: req.body.prompt,
        size: ASPECT_TO_SIZE[video.aspect] || 'story',
        count: 1,
        force: true, // a *regeneration* must not hand back the cached still
      });
      image = gen.images[0]?.url || image;
    }

    const images = video.images.map((v, x) => (x === i ? image : v));
    const captions = video.images.map((_, x) =>
      x === i ? req.body.caption ?? video.captions?.[x] ?? '' : video.captions?.[x] ?? ''
    );
    const durations = resolveDurations(video).map((d, x) => (x === i ? req.body.duration ?? d : d));

    // A scene whose length changed can unbalance the reel.
    const check = validateDurations(durations, video.durationS);
    if (req.body.render && !check.valid) {
      throw ApiError.badRequest(
        `Scene durations would add up to ${check.total}s but the reel is set to ${check.target}s. ` +
          'Adjust the timings, then render.',
        check
      );
    }

    const updated = await prisma.videoProject.update({
      where: { id: video.id },
      data: {
        images,
        captions,
        durations,
        ...(req.body.render ? { status: 'RENDERING', error: null, warning: null } : {}),
      },
    });

    if (req.body.render) {
      renderVideo(video.id).catch((err) => logger.error(`Video ${video.id} regenerate rejected:`, err));
    }
    return ok(res, { project: updated, timeline: check, regeneratedScene: i });
  })
);

/** Swap back to the render the last success replaced. Calling it twice redoes. */
router.post(
  '/:id/rollback',
  validate(idParam),
  asyncHandler(async (req, res) => {
    const video = await ensureOwned('videoProject', req.tenantId, req.params.id);
    if (video.status === 'RENDERING' || isRendering(video.id)) {
      throw ApiError.conflict('Wait for the current render to finish');
    }
    if (!video.previousUrl) throw ApiError.badRequest('There is no earlier render to restore');
    const restored = await prisma.videoProject.update({
      where: { id: video.id },
      data: {
        outputUrl: video.previousUrl,
        previousUrl: video.outputUrl,
        status: 'READY',
        error: null,
      },
    });
    return ok(res, restored);
  })
);

router.delete(
  '/:id',
  validate(idParam),
  asyncHandler(async (req, res) => {
    await ensureOwned('videoProject', req.tenantId, req.params.id);
    await prisma.videoProject.delete({ where: { id: req.params.id } });
    cleanupProjectFiles(req.params.id); // rendered files + cached segments
    return ok(res, { deleted: true });
  })
);

export default router;
