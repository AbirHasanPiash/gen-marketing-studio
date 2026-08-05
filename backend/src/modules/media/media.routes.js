import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import {
  uploadMedia,
  destroyMedia,
  backgroundRemovedUrl,
  platformVariants,
  compositeUrl,
  cloudinaryEnabled,
  PLATFORM_SIZES,
} from '../../lib/cloudinary.js';
import { extractPalette } from '../../lib/vibrant.js';

const router = Router();
router.use(authenticate);

router.get('/config', (_req, res) =>
  ok(res, { cloudinaryEnabled: cloudinaryEnabled(), platformSizes: PLATFORM_SIZES })
);

/** Upload a data-URI or remote URL to Cloudinary (auto-resize handled on read). */
router.post(
  '/upload',
  validate({ body: z.object({ source: z.string().min(1), folder: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const result = await uploadMedia(req.body.source, {
      folder: req.body.folder ? `mkt_studio/${req.body.folder}` : 'mkt_studio',
    });
    return ok(res, result);
  })
);

router.post(
  '/destroy',
  validate({ body: z.object({ publicId: z.string() }) }),
  asyncHandler(async (req, res) => ok(res, await destroyMedia(req.body.publicId)))
);

/** Automated background removal (Feature 5). */
router.post(
  '/remove-bg',
  validate({ body: z.object({ publicId: z.string().optional().nullable(), url: z.string() }) }),
  asyncHandler(async (req, res) => {
    const url = backgroundRemovedUrl(req.body.publicId, req.body.url);
    return ok(res, { url, applied: cloudinaryEnabled() && Boolean(req.body.publicId) });
  })
);

/** Auto-resize one asset for every platform placement (Feature 5). */
router.post(
  '/platform-variants',
  validate({ body: z.object({ publicId: z.string().optional().nullable(), url: z.string() }) }),
  asyncHandler(async (req, res) => ok(res, platformVariants(req.body.publicId, req.body.url)))
);

/** Extract a colour palette from any image (Feature 5 brand kit helper). */
router.post(
  '/extract-palette',
  validate({ body: z.object({ source: z.string().min(1) }) }),
  asyncHandler(async (req, res) => ok(res, await extractPalette(req.body.source)))
);

/** Composite a product cutout over a background with text (Feature 13). */
router.post(
  '/composite',
  validate({
    body: z.object({
      backgroundPublicId: z.string().optional().nullable(),
      productPublicId: z.string().optional().nullable(),
      backgroundUrl: z.string().optional().nullable(),
      productUrl: z.string().optional().nullable(),
      text: z.string().max(120).optional().nullable(),
      textColor: z.string().max(8).default('FFFFFF'),
      font: z.string().max(40).default('Arial'),
      fontSize: z.coerce.number().int().min(10).max(200).default(72),
      width: z.coerce.number().int().default(1080),
      height: z.coerce.number().int().default(1080),
    }),
  }),
  asyncHandler(async (req, res) => {
    let { backgroundPublicId, productPublicId } = req.body;

    // If only URLs are supplied and Cloudinary is live, ingest them first.
    if (cloudinaryEnabled()) {
      if (!backgroundPublicId && req.body.backgroundUrl) {
        backgroundPublicId = (await uploadMedia(req.body.backgroundUrl, { folder: 'mkt_studio/composite' })).publicId;
      }
      if (!productPublicId && req.body.productUrl) {
        productPublicId = (await uploadMedia(req.body.productUrl, { folder: 'mkt_studio/composite' })).publicId;
      }
    }

    const result = compositeUrl({ ...req.body, backgroundPublicId, productPublicId });
    return ok(res, {
      ...result,
      // In mock mode the browser composites on a <canvas>; hand back the inputs.
      inputs: {
        backgroundUrl: req.body.backgroundUrl,
        productUrl: req.body.productUrl,
        text: req.body.text,
        textColor: req.body.textColor,
      },
      cloudinaryEnabled: cloudinaryEnabled(),
    });
  })
);

export default router;
