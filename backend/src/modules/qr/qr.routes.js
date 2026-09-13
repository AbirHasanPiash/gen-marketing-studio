import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok, created } from '../../utils/http.js';
import { ensureBrand, ensureOwned } from '../../utils/scope.js';
import { objectId, optionalObjectId, queryObjectId, httpUrl } from '../../utils/validators.js';

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

const idParam = { params: z.object({ id: objectId('QR id') }) };
const HEX_COLOR = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'Use a hex colour like #1d3557');

router.get(
  '/',
  validate({ query: z.object({ brandId: queryObjectId('brandId'), campaignId: queryObjectId('campaignId') }) }),
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
      label: z.string().trim().min(1).max(120),
      // A QR code is a redirect other people scan: only http(s) belongs here.
      targetUrl: httpUrl('Target URL'),
      brandId: optionalObjectId('brandId'),
      campaignId: optionalObjectId('campaignId'),
      fgColor: HEX_COLOR.default('#000000'),
      bgColor: HEX_COLOR.default('#ffffff'),
      tracked: z.boolean().default(true),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (req.body.brandId) await ensureBrand(req.tenantId, req.body.brandId);
    const code = await prisma.qRCode.create({
      data: {
        tenantId: req.tenantId,
        label: req.body.label,
        targetUrl: req.body.targetUrl,
        brandId: req.body.brandId || null,
        campaignId: req.body.campaignId || null,
        fgColor: req.body.fgColor,
        bgColor: req.body.bgColor,
        tracked: req.body.tracked,
      },
    });
    const encode = req.body.tracked ? trackingUrl(code.id) : req.body.targetUrl;
    const dataUrl = await renderDataUrl(encode, req.body.fgColor, req.body.bgColor);
    const updated = await prisma.qRCode.update({ where: { id: code.id }, data: { dataUrl } });
    return created(res, updated);
  })
);

router.get(
  '/:id',
  validate(idParam),
  asyncHandler(async (req, res) => ok(res, await ensureOwned('qRCode', req.tenantId, req.params.id)))
);

router.patch(
  '/:id',
  validate({
    ...idParam,
    body: z.object({
      label: z.string().trim().min(1).max(120).optional(),
      targetUrl: httpUrl('Target URL').optional(),
      fgColor: HEX_COLOR.optional(),
      bgColor: HEX_COLOR.optional(),
      tracked: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const code = await ensureOwned('qRCode', req.tenantId, req.params.id);
    const merged = { ...code, ...req.body };
    // Re-encoding always through the tracker used to silently switch untracked
    // codes over to scan tracking. Honour whatever the code was created with.
    const encode = merged.tracked === false ? merged.targetUrl : trackingUrl(code.id);
    const dataUrl = await renderDataUrl(encode, merged.fgColor, merged.bgColor);
    const updated = await prisma.qRCode.update({ where: { id: code.id }, data: { ...req.body, dataUrl } });
    return ok(res, updated);
  })
);

router.delete(
  '/:id',
  validate(idParam),
  asyncHandler(async (req, res) => {
    await ensureOwned('qRCode', req.tenantId, req.params.id);
    await prisma.qRCode.delete({ where: { id: req.params.id } });
    return ok(res, { deleted: true });
  })
);

export default router;
