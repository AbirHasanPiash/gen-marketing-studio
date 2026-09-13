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
import { objectId } from '../../utils/validators.js';

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

/** One place to state the password rule, so sign-up and reset can't drift. */
const password = z.string().min(8, 'Use at least 8 characters').max(128);
const email = z.string().trim().toLowerCase().email();

const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email,
    password,
    tenantName: z.string().trim().min(2).max(80).optional(),
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
  validate({ body: z.object({ email, password: z.string().min(1).max(128) }) }),
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

/** Edit your own profile. Role and tenant are deliberately not editable here. */
router.patch(
  '/me',
  authenticate,
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(80).optional(),
      avatarUrl: z.string().max(2048).nullish(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body,
      include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
    });
    return ok(res, { user: publicUser(user) });
  })
);

/**
 * Change your own password. Owners hand new members a temporary one, so without
 * this there is no way for a creator to ever stop using a password their whole
 * team knows.
 */
router.post(
  '/me/password',
  authenticate,
  validate({
    body: z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: password,
    }),
  }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw ApiError.unauthorized('That current password is not right');
    }
    if (currentPassword === newPassword) {
      throw ApiError.badRequest('Pick a password you have not used here before');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return ok(res, { updated: true });
  })
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
      name: z.string().trim().min(2).max(80),
      email,
      password,
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
    params: z.object({ id: objectId('user id') }),
    body: z.object({
      role: z.enum(['OWNER', 'CREATOR']).optional(),
      isActive: z.boolean().optional(),
      name: z.string().trim().min(2).max(80).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!target) throw ApiError.notFound('User not found');
    if (target.id === req.user.id) {
      // Demoting or disabling yourself is the classic way to lock a workspace
      // with a single owner out of its own settings.
      if (req.body.isActive === false) throw ApiError.badRequest('You cannot deactivate yourself');
      if (req.body.role && req.body.role !== target.role) {
        throw ApiError.badRequest('You cannot change your own role');
      }
    }
    if (target.role === 'OWNER' && (req.body.role === 'CREATOR' || req.body.isActive === false)) {
      const owners = await prisma.user.count({
        where: { tenantId: req.tenantId, role: 'OWNER', isActive: true },
      });
      if (owners <= 1) throw ApiError.badRequest('A workspace needs at least one active owner');
    }
    const user = await prisma.user.update({
      where: { id: target.id },
      data: req.body,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return ok(res, user);
  })
);

export default router;
