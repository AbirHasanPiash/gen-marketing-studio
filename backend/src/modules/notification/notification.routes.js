import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { ensureOwned } from '../../utils/scope.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } }),
    ]);
    return ok(res, { items, unread });
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const n = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!n) return ok(res, { updated: false });
    await prisma.notification.update({ where: { id: n.id }, data: { read: true } });
    return ok(res, { updated: true });
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    return ok(res, { updated: true });
  })
);

export default router;
