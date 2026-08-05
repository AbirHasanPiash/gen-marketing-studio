import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ensureOwned } from '../../utils/scope.js';
import { renderVideo, ffmpegAvailable } from './video.service.js';

const router = Router();
router.use(authenticate);

const videoBody = z.object({
  title: z.string().min(1).max(160),
  brandId: z.string().optional().nullable(),
  images: z.array(z.string()).min(1).max(8),
  captions: z.array(z.string()).default([]),
  audioUrl: z.string().optional().nullable(),
  durationS: z.coerce.number().int().min(5).max(30).default(10),
  aspect: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
});

router.get('/status/ffmpeg', asyncHandler(async (_req, res) => ok(res, { available: await ffmpegAvailable() })));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = { tenantId: req.tenantId, ...(req.query.brandId ? { brandId: req.query.brandId } : {}) };
    const videos = await prisma.videoProject.findMany({ where, orderBy: { createdAt: 'desc' } });
    return ok(res, videos);
  })
);

router.get('/:id', asyncHandler(async (req, res) => ok(res, await ensureOwned('videoProject', req.tenantId, req.params.id))));

router.post(
  '/',
  validate({ body: videoBody }),
  asyncHandler(async (req, res) => {
    const video = await prisma.videoProject.create({ data: { ...req.body, tenantId: req.tenantId } });
    return created(res, video);
  })
);

router.patch(
  '/:id',
  validate({ body: videoBody.partial() }),
  asyncHandler(async (req, res) => {
    await ensureOwned('videoProject', req.tenantId, req.params.id);
    const video = await prisma.videoProject.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, video);
  })
);

/** Kick off a background render; returns immediately with RENDERING status. */
router.post(
  '/:id/render',
  asyncHandler(async (req, res) => {
    const video = await ensureOwned('videoProject', req.tenantId, req.params.id);
    renderVideo(video.id); // fire-and-forget background job
    return ok(res, { ...video, status: 'RENDERING' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ensureOwned('videoProject', req.tenantId, req.params.id);
    await prisma.videoProject.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);

export default router;
