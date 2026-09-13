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
import { decodeDataUri, saveLocalUpload, saveDataUri, isDataUri, MIME_EXT } from '../../lib/localUploads.js';
import { ApiError } from '../../utils/ApiError.js';

const router = Router();
router.use(authenticate);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

router.get('/config', (_req, res) =>
  ok(res, { cloudinaryEnabled: cloudinaryEnabled(), platformSizes: PLATFORM_SIZES })
);

/**
 * Upload a data-URI or remote URL to Cloudinary (auto-resize handled on read).
 *
 * Without Cloudinary the file is written to `tmp/uploads` and a URL is returned.
 * Handing the data URI straight back looks the same in the browser but is not:
 * callers store what they get on a record, so every later read of that brand,
 * asset or post would carry a multi-megabyte base64 blob with it.
 */
router.post(
  '/upload',
  validate({ body: z.object({ source: z.string().min(1), folder: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const { source } = req.body;

    if (isDataUri(source)) {
      let decoded;
      try {
        decoded = decodeDataUri(source);
      } catch {
        throw ApiError.badRequest('That upload is not a readable file.');
      }
      if (!decoded.mime.startsWith('image/')) throw ApiError.badRequest(`${decoded.mime} is not an image file.`);
      if (decoded.buffer.length > MAX_IMAGE_BYTES) {
        throw ApiError.badRequest(
          `Image is ${(decoded.buffer.length / 1e6).toFixed(1)} MB — the limit is ${MAX_IMAGE_BYTES / 1e6} MB.`
        );
      }
      if (!cloudinaryEnabled()) return ok(res, saveDataUri(source));
    }

    const result = await uploadMedia(source, {
      folder: req.body.folder ? `mkt_studio/${req.body.folder}` : 'mkt_studio',
    });
    // A remote URL in mock mode is already a URL — only a data URI needs saving.
    if (result.mock && isDataUri(result.url)) return ok(res, saveDataUri(result.url));
    return ok(res, result);
  })
);

/** Audio track upload for the Video Studio (Feature 14). */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

router.post(
  '/upload-audio',
  validate({ body: z.object({ source: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    let mime;
    let buffer;
    try {
      ({ mime, buffer } = decodeDataUri(req.body.source));
    } catch {
      throw ApiError.badRequest('Upload the audio file itself — a plain URL cannot be read here.');
    }
    if (!mime.startsWith('audio/')) throw ApiError.badRequest(`${mime} is not an audio file.`);
    if (buffer.length > MAX_AUDIO_BYTES) {
      throw ApiError.badRequest(`Audio is ${(buffer.length / 1e6).toFixed(1)} MB — the limit is ${MAX_AUDIO_BYTES / 1e6} MB.`);
    }

    // Cloudinary stores audio under its `video` resource type; `resource_type:
    // auto` in uploadMedia already routes it there. Without keys we keep the
    // file on disk instead of pushing a base64 blob into the database.
    const up = await uploadMedia(req.body.source, { folder: 'mkt_studio/audio' });
    if (!up.mock) return ok(res, { url: up.url, publicId: up.publicId, bytes: up.bytes ?? buffer.length, mock: false });

    const local = saveLocalUpload(buffer, MIME_EXT[mime] || 'mp3');
    return ok(res, { url: local.url, publicId: null, bytes: local.bytes, mock: true });
  })
);

router.post(
  '/destroy',
  validate({
    body: z.object({
      publicId: z.string(),
      // Cloudinary files audio under `video` too, so callers must be able to say.
      resourceType: z.enum(['image', 'video', 'raw']).default('image'),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await destroyMedia(req.body.publicId, req.body.resourceType)))
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

/**
 * Auto-resize one asset for every platform placement (Feature 5). Resizing is a
 * Cloudinary delivery transformation, so a source that doesn't live there yet
 * (an AI image saved straight from its provider URL) is ingested first —
 * otherwise every "variant" would just be the original at its original size.
 */
router.post(
  '/platform-variants',
  validate({ body: z.object({ publicId: z.string().optional().nullable(), url: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    let { publicId } = req.body;
    if (!publicId && cloudinaryEnabled()) {
      publicId = (await uploadMedia(req.body.url, { folder: 'mkt_studio/variants' })).publicId;
    }
    return ok(res, platformVariants(publicId, req.body.url));
  })
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
