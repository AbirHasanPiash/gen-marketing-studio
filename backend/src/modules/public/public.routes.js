import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';
import { objectId } from '../../utils/validators.js';

const router = Router();

/** Only ever redirect a scanner to a real web address. */
const isSafeRedirect = (url) => /^https?:\/\//i.test(String(url || ''));

/** Public Link-in-bio page (Feature 9). Only published pages are visible. */
router.get(
  '/pages/:slug',
  validate({ params: z.object({ slug: z.string().min(1).max(80) }) }),
  asyncHandler(async (req, res) => {
    const page = await prisma.linkInBioPage.findUnique({
      where: { slug: req.params.slug },
      include: {
        links: { where: { isActive: true }, orderBy: { order: 'asc' } },
        brand: { select: { name: true, logoUrl: true, tagline: true } },
      },
    });
    if (!page || !page.published) throw ApiError.notFound('Page not found');
    // Fire-and-forget: a view counter must never delay or fail the page itself.
    prisma.linkInBioPage
      .update({ where: { id: page.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
    return ok(res, {
      slug: page.slug,
      title: page.title,
      bio: page.bio,
      avatarUrl: page.avatarUrl || page.brand?.logoUrl,
      theme: page.theme,
      brand: page.brand,
      links: page.links.map((l) => ({ id: l.id, label: l.label, url: l.url, icon: l.icon })),
    });
  })
);

/** Link click tracking — returns the destination for the client to follow. */
router.post(
  '/links/:linkId/click',
  validate({ params: z.object({ linkId: objectId('link id') }) }),
  asyncHandler(async (req, res) => {
    const link = await prisma.linkItem.findUnique({ where: { id: req.params.linkId } });
    if (!link) throw ApiError.notFound('Link not found');
    prisma.linkItem.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } }).catch(() => {});
    return ok(res, { url: link.url });
  })
);

/** QR scan endpoint (Feature 10) — counts the scan and redirects. */
router.get(
  '/qr/:id',
  validate({ params: z.object({ id: objectId('QR id') }) }),
  asyncHandler(async (req, res) => {
    const code = await prisma.qRCode.findUnique({ where: { id: req.params.id } });
    if (!code) return res.status(404).send('QR code not found');
    // Codes created before target URLs were validated could hold anything, and
    // this endpoint turns whatever it holds into a redirect for the scanner.
    if (!isSafeRedirect(code.targetUrl)) return res.status(400).send('This QR code has an invalid destination');
    prisma.qRCode.update({ where: { id: code.id }, data: { scanCount: { increment: 1 } } }).catch(() => {});
    return res.redirect(302, code.targetUrl);
  })
);

export default router;
