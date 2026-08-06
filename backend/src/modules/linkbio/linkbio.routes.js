import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { ensureBrand } from '../../utils/scope.js';
import { uniqueSlug } from '../../utils/slug.js';

const router = Router();
router.use(authenticate);

const linkItem = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(80),
  url: z.string().min(1),
  icon: z.string().max(40).optional().nullable(),
  order: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.get(
  '/:brandId',
  asyncHandler(async (req, res) => {
    await ensureBrand(req.tenantId, req.params.brandId);
    const page = await prisma.linkInBioPage.findUnique({
      where: { brandId: req.params.brandId },
      include: { links: { orderBy: { order: 'asc' } } },
    });
    return ok(res, page);
  })
);

router.put(
  '/:brandId',
  validate({
    body: z.object({
      title: z.string().min(1).max(120),
      bio: z.string().max(500).optional().nullable(),
      avatarUrl: z.string().optional().nullable(),
      slug: z.string().max(60).optional().nullable(),
      theme: z.object({ bg: z.string().optional(), accent: z.string().optional(), style: z.string().optional() }).optional().nullable(),
      published: z.boolean().optional(),
      links: z.array(linkItem).default([]),
    }),
  }),
  asyncHandler(async (req, res) => {
    const brand = await ensureBrand(req.tenantId, req.params.brandId);
    const existing = await prisma.linkInBioPage.findUnique({ where: { brandId: brand.id } });

    let slug = existing?.slug;
    const wanted = req.body.slug || slug || brand.slug || brand.name;
    if (!slug || (req.body.slug && req.body.slug !== slug)) {
      slug = await uniqueSlug(wanted, async (s) => {
        const hit = await prisma.linkInBioPage.findUnique({ where: { slug: s } });
        return Boolean(hit && hit.brandId !== brand.id);
      });
    }

    const page = await prisma.linkInBioPage.upsert({
      where: { brandId: brand.id },
      create: {
        tenantId: req.tenantId,
        brandId: brand.id,
        slug,
        title: req.body.title,
        bio: req.body.bio,
        avatarUrl: req.body.avatarUrl,
        theme: req.body.theme ?? undefined,
        published: req.body.published ?? false,
      },
      update: {
        slug,
        title: req.body.title,
        bio: req.body.bio,
        avatarUrl: req.body.avatarUrl,
        theme: req.body.theme ?? undefined,
        published: req.body.published,
      },
    });

    // Sync links: keep provided ids, drop the rest, upsert each.
    const incoming = req.body.links || [];
    const keepIds = incoming.filter((l) => l.id).map((l) => l.id);
    await prisma.linkItem.deleteMany({
      where: { pageId: page.id, id: { notIn: keepIds.length ? keepIds : ['000000000000000000000000'] } },
    });
    for (const [i, l] of incoming.entries()) {
      const data = { label: l.label, url: l.url, icon: l.icon, order: l.order ?? i, isActive: l.isActive };
      if (l.id) await prisma.linkItem.update({ where: { id: l.id }, data }).catch(() => null);
      else await prisma.linkItem.create({ data: { ...data, pageId: page.id } });
    }

    const full = await prisma.linkInBioPage.findUnique({
      where: { id: page.id },
      include: { links: { orderBy: { order: 'asc' } } },
    });
    return ok(res, full);
  })
);

export default router;
