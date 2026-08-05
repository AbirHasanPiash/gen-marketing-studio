import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../lib/token.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { uniqueSlug } from '../../utils/slug.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id,   
  name: u.name,
  email: u.email,
  role: u.role,
  avatarUrl: u.avatarUrl,
  tenantId: u.tenantId,
  tenant: u.tenant,
});

const registerSchema = {
  body: z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(6).max(128),
    tenantName: z.string().min(2).max(80).optional(),
  }),
};

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, tenantName } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict('That email is already registered');

    const slug = await uniqueSlug(tenantName || `${name} studio`, async (s) =>
      Boolean(await prisma.tenant.findUnique({ where: { slug: s } }))
    );

    const passwordHash = await bcrypt.hash(password, 10);
    // Owner + their workspace are created together (a new tenant per sign-up).
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName || `${name}'s Studio`,
        slug,
        users: { create: { name, email, passwordHash, role: 'OWNER' } },
      },
      include: { users: true },
    });
    const user = tenant.users[0];
    const token = signToken({ sub: user.id, tenantId: tenant.id, role: user.role });
    return created(res, {
      token,
      user: publicUser({ ...user, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } }),
    });
  })
);
    
router.post(
  '/login',
  validate({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
    });
    if (!user || !user.isActive) throw ApiError.unauthorized('Invalid credentials');
    const okPass = await bcrypt.compare(password, user.passwordHash);
    if (!okPass) throw ApiError.unauthorized('Invalid credentials');

    const token = signToken({ sub: user.id, tenantId: user.tenantId, role: user.role });
    return ok(res, { token, user: publicUser(user) });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => ok(res, { user: publicUser(req.user) }))
);

// --- Team management (Owner invites Content Creators) ----------------------

router.get(
  '/users',
  authenticate,
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return ok(res, users);
  })
);

router.post(
  '/users',
  authenticate,
  requireRole('OWNER'),
  validate({
    body: z.object({
      name: z.string().min(2).max(80),
      email: z.string().email(),
      password: z.string().min(6).max(128),
      role: z.enum(['OWNER', 'CREATOR']).default('CREATOR'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict('That email is already in use');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, tenantId: req.tenantId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return created(res, user);
  })
);

router.patch(
  '/users/:id',
  authenticate,
  requireRole('OWNER'),
  validate({
    body: z.object({
      role: z.enum(['OWNER', 'CREATOR']).optional(),
      isActive: z.boolean().optional(),
      name: z.string().min(2).max(80).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!target) throw ApiError.notFound('User not found');
    if (target.id === req.user.id && req.body.isActive === false)
      throw ApiError.badRequest('You cannot deactivate yourself');
    const user = await prisma.user.update({
      where: { id: target.id },
      data: req.body,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return ok(res, user);
  })
);

export default router;
