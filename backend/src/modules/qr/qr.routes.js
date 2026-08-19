import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ensureOwned } from '../../utils/scope.js';

const router = Router();
router.use(authenticate);

const trackingUrl = (id) => `${env.apiBaseUrl}/api/public/qr/${id}`;

async function renderDataUrl(text, fg, bg) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: fg || '#000000', light: bg || '#ffffff' },
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = {
      tenantId: req.tenantId,
      ...(req.query.brandId ? { brandId: req.query.brandId } : {}),
      ...(req.query.campaignId ? { campaignId: req.query.campaignId } : {}),
    };
    const codes = await prisma.qRCode.findMany({ where, orderBy: { createdAt: 'desc' } });
    return ok(res, codes);
  })
);

router.post(
  '/',
  validate({
    body: z.object({
      label: z.string().min(1).max(120),
      targetUrl: z.string().min(1),
      brandId: z.string().optional().nullable(),
      campaignId: z.string().optional().nullable(),
      fgColor: z.string().max(9).default('#000000'),
      bgColor: z.string().max(9).default('#ffffff'),
      tracked: z.boolean().default(true),
    }),
  }),
  asyncHandler(async (req, res) => {
    const code = await prisma.qRCode.create({
      data: {
        tenantId: req.tenantId,
        label: req.body.label,
        targetUrl: req.body.targetUrl,
        brandId: req.body.brandId || null,
        campaignId: req.body.campaignId || null,
        fgColor: req.body.fgColor,
        bgColor: req.body.bgColor,
      },
    });
    const encode = req.body.tracked ? trackingUrl(code.id) : req.body.targetUrl;
    const dataUrl = await renderDataUrl(encode, req.body.fgColor, req.body.bgColor);
    const updated = await prisma.qRCode.update({ where: { id: code.id }, data: { dataUrl } });
    return created(res, updated);
  })
);

router.get('/:id', asyncHandler(async (req, res) => ok(res, await ensureOwned('qRCode', req.tenantId, req.params.id))));

router.patch(
  '/:id',
  validate({
    body: z.object({
      label: z.string().max(120).optional(),
      targetUrl: z.string().optional(),
      fgColor: z.string().max(9).optional(),
      bgColor: z.string().max(9).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const code = await ensureOwned('qRCode', req.tenantId, req.params.id);
    const merged = { ...code, ...req.body };
    const dataUrl = await renderDataUrl(trackingUrl(code.id), merged.fgColor, merged.bgColor);
    const updated = await prisma.qRCode.update({ where: { id: code.id }, data: { ...req.body, dataUrl } });
    return ok(res, updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ensureOwned('qRCode', req.tenantId, req.params.id);
    await prisma.qRCode.delete({ where: { id: req.params.id } });
    return ok(res,{ deleted: true });
  })
);

export default router;
