import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { retryPublishJob } from '../../jobs/agenda.js';
import { ensureOwned } from '../../utils/scope.js';
import { objectId, queryObjectId, JOB_STATUSES } from '../../utils/validators.js';

const router = Router();
router.use(authenticate);

/** Publishing operations board — every scheduled/attempted job + its state. */
router.get(
  '/jobs',
  validate({ query: z.object({ status: z.enum(JOB_STATUSES).optional() }) }),
  asyncHandler(async (req, res) => {
    const where = { tenantId: req.tenantId, ...(req.query.status ? { status: req.query.status } : {}) };
    const jobs = await prisma.publishJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        post: {
          select: { id: true, title: true, status: true, platforms: true, brand: { select: { name: true } } },
        },
      },
    });
    return ok(res, jobs);
  })
);

router.get(
  '/publications',
  validate({ query: z.object({ brandId: queryObjectId('brandId') }) }),
  asyncHandler(async (req, res) => {
    const where = { tenantId: req.tenantId, ...(req.query.brandId ? { post: { brandId: req.query.brandId } } : {}) };
    const pubs = await prisma.publication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        post: { select: { id: true, title: true } },
        analytics: { orderBy: { capturedAt: 'desc' }, take: 1 },
      },
    });
    return ok(res, pubs);
  })
);

router.post(
  '/jobs/:postId/retry',
  validate({ params: z.object({ postId: objectId('post id') }) }),
  asyncHandler(async (req, res) => {
    await ensureOwned('post', req.tenantId, req.params.postId);
    await retryPublishJob(req.params.postId);
    return ok(res, { retried: true });
  })
);

export default router;
