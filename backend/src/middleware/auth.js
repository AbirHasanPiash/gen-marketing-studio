import { verifyToken } from '../lib/token.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/http.js';

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.token) return req.cookies.token;
  return null;
}


export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
  // Single-purpose tokens (the Meta OAuth `state`, for one) are signed with the
  // same secret but travel through URLs and third-party servers. They are not
  // credentials — refuse them here rather than trusting `sub` alone.
  if (payload.purpose) throw ApiError.unauthorized('This token cannot be used to sign in');

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, slug: true, plan: true } },
    },
  });

  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or disabled');

  req.user = user;
  req.tenantId = user.tenantId;
  next();
});

/** Restrict a route to specific roles (e.g. requireRole('OWNER')). */
export const requireRole = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`Requires role: ${roles.join(' or ')}`);
    }
    next();
  });

/** Attaches user if a valid token is present, but never rejects (public routes). */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    if (payload.purpose) return next();
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      // isActive has to be selected or the check below is always true and a
      // deactivated account keeps its identity on optional-auth routes.
      select: { id: true, role: true, tenantId: true, name: true, email: true, isActive: true },
    });
    if (user?.isActive) {
      req.user = user;
      req.tenantId = user?.tenantId;
    }
  } catch {
    /* ignore — anonymous */
  }
  return next();
});
