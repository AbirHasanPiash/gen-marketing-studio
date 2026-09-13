import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureBrand } from '../../utils/scope.js';
import { objectId, queryObjectId } from '../../utils/validators.js';
import { signPurposeToken, verifyPurposeToken } from '../../lib/token.js';
import { encrypt } from '../../lib/crypto.js';
import * as meta from '../../lib/meta.js';
import { logger } from '../../lib/logger.js';

const router = Router();

const REDIRECT_URI = `${env.apiBaseUrl}/api/social/meta/callback`;

const publicAccount = (a) => ({
  id: a.id,
  platform: a.platform,
  name: a.name,
  externalId: a.externalId,
  igBusinessId: a.igBusinessId,
  tokenExpiresAt: a.tokenExpiresAt,
  scopes: a.scopes,
  isActive: a.isActive,
  createdAt: a.createdAt,
  connected: true,
});

async function storeAccounts(tenantId, brandId, accounts, tokenExpiresAt = null) {
  const stored = [];
  for (const a of accounts) {
    const existing = await prisma.socialAccount.findFirst({
      where: { brandId, platform: a.platform, externalId: a.externalId },
    });
    const data = {
      tenantId,
      brandId,
      platform: a.platform,
      externalId: a.externalId,
      name: a.name,
      accessToken: encrypt(a.accessToken),
      tokenExpiresAt,
      scopes: meta.SCOPES,
      igBusinessId: a.igBusinessId,
      pageId: a.pageId,
      isActive: true,
    };
    const rec = existing
      ? await prisma.socialAccount.update({ where: { id: existing.id }, data })
      : await prisma.socialAccount.create({ data });
    stored.push(rec);
  }
  return stored;
}

router.get(
  '/accounts',
  authenticate,
  validate({ query: z.object({ brandId: queryObjectId('brandId') }) }),
  asyncHandler(async (req, res) => {
    const where = { tenantId: req.tenantId, ...(req.query.brandId ? { brandId: req.query.brandId } : {}) };
    const accounts = await prisma.socialAccount.findMany({ where, orderBy: { createdAt: 'desc' } });
    return ok(res, accounts.map(publicAccount));
  })
);

/** Returns the Meta OAuth URL, or signals dev mode when the app is unconfigured. */
router.get(
  '/meta/connect',
  authenticate,
  validate({ query: z.object({ brandId: objectId('brandId') }) }),
  asyncHandler(async (req, res) => {
    const { brandId } = req.query;
    await ensureBrand(req.tenantId, brandId);
    if (!meta.metaEnabled()) {
      return ok(res, { devMode: true, message: 'Meta app not configured — use dev connect.' });
    }
    // Short-lived and purpose-tagged: this value ends up in a third-party
    // redirect URL, so it must never be replayable as a session token.
    const state = signPurposeToken('meta_oauth', { tenantId: req.tenantId, brandId, userId: req.user.id });
    return ok(res, { devMode: false, url: meta.getOAuthUrl(REDIRECT_URI, state) });
  })
);

/** OAuth callback (hit by Meta). Identity travels in the signed `state`. */
router.get(
  '/meta/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    const fail = (msg) => res.redirect(`${env.webBaseUrl}/connections?error=${encodeURIComponent(msg)}`);
    if (!code || !state) return fail('Missing code/state');

    let payload;
    try {
      payload = verifyPurposeToken('meta_oauth', String(state));
    } catch {
      return fail('This connection link has expired — start again from Connections.');
    }

    try {
      const shortToken = await meta.exchangeCodeForToken(String(code), REDIRECT_URI);
      const { token, expiresIn } = await meta.getLongLivedToken(shortToken);
      const accounts = await meta.getManagedAccounts(token);
      const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
      await storeAccounts(payload.tenantId, payload.brandId, accounts, tokenExpiresAt);
      logger.success(`Connected ${accounts.length} Meta account(s) for brand ${payload.brandId}`);
      return res.redirect(`${env.webBaseUrl}/connections?connected=1`);
    } catch (err) {
      logger.error('Meta OAuth failed:', err.message);
      return fail(err.message);
    }
  })
);

/** Dev/mock connect — attaches mock FB + IG accounts so publishing works offline. */
router.post(
  '/meta/dev-connect',
  authenticate,
  validate({ body: z.object({ brandId: objectId('brandId') }) }),
  asyncHandler(async (req, res) => {
    await ensureBrand(req.tenantId, req.body.brandId);
    const accounts = await meta.getManagedAccounts('mock.user.token');
    const stored = await storeAccounts(req.tenantId, req.body.brandId, accounts);
    return ok(res, { connected: stored.map(publicAccount), dev: true });
  })
);

router.delete(
  '/accounts/:id',
  authenticate,
  validate({ params: z.object({ id: objectId('account id') }) }),
  asyncHandler(async (req, res) => {
    const acc = await prisma.socialAccount.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!acc) throw ApiError.notFound('Account not found');
    await prisma.socialAccount.delete({ where: { id: acc.id } });
    return ok(res, { disconnected: true });
  })
);

export default router;
