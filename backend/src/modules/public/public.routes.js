import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { ApiError } from '../../utils/ApiError.js';

const router = Router();

/** Public Link-in-bio page (Feature 9). Only published pages are visible. */
router.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await prisma.linkInBioPage.findUnique({
      where: { slug: req.params.slug },
      include: {
        links: { where: { isActive: true }, orderBy: { order: 'asc' } },
        brand: { select: { name: true, logoUrl: true, tagline: true } },
      },
    });
    if (!page || !page.published) throw ApiError.notFound('Page not found');
    await prisma.linkInBioPage.update({ where: { id: page.id }, data: { viewCount: { increment: 1 } } });
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
  asyncHandler(async (req, res) => {
    const link = await prisma.linkItem.findUnique({ where: { id: req.params.linkId } });
    if (!link) throw ApiError.notFound('Link not found');
    await prisma.linkItem.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } });
    return ok(res, { url: link.url });
  })
);

/** QR scan endpoint (Feature 10) — counts the scan and redirects. */
router.get(
  '/qr/:id',
  asyncHandler(async (req, res) => {
    const code = await prisma.qRCode.findUnique({ where: { id: req.params.id } });
    if (!code) return res.status(404).send('QR code not found');
    await prisma.qRCode.update({ where: { id: code.id }, data: { scanCount: { increment: 1 } } });
    return res.redirect(302, code.targetUrl);
  })
);

export default router;
