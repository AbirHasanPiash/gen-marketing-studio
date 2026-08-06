import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let configured = false;
function ensure() {
  if (configured) return env.cloudinary.enabled;
  if (env.cloudinary.enabled) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
    logger.success('Cloudinary configured');
  }
  return env.cloudinary.enabled;
}

/** Canonical output sizes per social placement. */
export const PLATFORM_SIZES = {
  INSTAGRAM_SQUARE: { width: 1080, height: 1080, label: 'Instagram · Square' },
  INSTAGRAM_PORTRAIT: { width: 1080, height: 1350, label: 'Instagram · Portrait' },
  INSTAGRAM_STORY: { width: 1080, height: 1920, label: 'Instagram · Story/Reel' },
  FACEBOOK_FEED: { width: 1200, height: 630, label: 'Facebook · Feed' },
  FACEBOOK_SQUARE: { width: 1200, height: 1200, label: 'Facebook · Square' },
};

export const cloudinaryEnabled = () => env.cloudinary.enabled;

/**
 * Upload a data-URI or remote URL to Cloudinary. In mock mode (no keys) the
 * original source is returned so the UI still shows the real image.
 */
export async function uploadMedia(source, { folder = 'mkt_studio', publicId } = {}) {
  if (!ensure()) {
    return {
      url: source,
      secureUrl: source,
      publicId: null,
      width: null,
      height: null,
      bytes: null,
      format: source?.startsWith('data:') ? source.slice(5, source.indexOf(';')) : null,
      mock: true,
    };
  }
  const res = await cloudinary.uploader.upload(source, {
    folder,
    public_id: publicId,
    resource_type: 'auto',
    overwrite: true,
  });
  return {
    url: res.secure_url,
    secureUrl: res.secure_url,
    publicId: res.public_id,
    width: res.width,
    height: res.height,
    bytes: res.bytes,
    format: res.format,
    mock: false,
  };
}

export async function destroyMedia(publicId) {
  if (!publicId || !ensure()) return { ok: true, mock: true };
  await cloudinary.uploader.destroy(publicId);
  return { ok: true };
}

/** Build resized variants for every platform placement from one public id. */
export function platformVariants(publicId, url) {
  if (!ensure() || !publicId) {
    // Mock: return the same url labelled per size.
    return Object.entries(PLATFORM_SIZES).map(([key, s]) => ({
      key,
      ...s,
      url,
    }));
  }
  return Object.entries(PLATFORM_SIZES).map(([key, s]) => ({
    key,
    ...s,
    url: cloudinary.url(publicId, {
      secure: true,
      transformation: [{ width: s.width, height: s.height, crop: 'fill', gravity: 'auto' }],
    }),
  }));
}

/** Cloudinary AI background removal (requires the add-on on paid tiers). */
export function backgroundRemovedUrl(publicId, url) {
  if (!ensure() || !publicId) return url;
  return cloudinary.url(publicId, {
    secure: true,
    effect: 'background_removal',
    format: 'png',
  });
}

/**
 * Composite a product cutout over a background with an optional text overlay
 * (Feature 13). Everything is expressed as a single delivery transformation.
 */
export function compositeUrl({
  backgroundPublicId,
  productPublicId,
  text,
  textColor = 'FFFFFF',
  font = 'Arial',
  fontSize = 72,
  width = 1080,
  height = 1080,
} = {}) {
  if (!ensure() || !backgroundPublicId) {
    return { url: null, mock: true };
  }
  const transformation = [{ width, height, crop: 'fill', gravity: 'auto' }];
  if (productPublicId) {
    transformation.push({
      overlay: productPublicId.replace(/\//g, ':'),
      width: Math.round(width * 0.7),
      crop: 'fit',
      gravity: 'center',
    });
  }
  if (text) {
    const safe = encodeURIComponent(text).replace(/%2C/g, '%252C');
    transformation.push({
      overlay: { font_family: font, font_size: fontSize, font_weight: 'bold', text: safe },
      color: `#${textColor}`,
      gravity: 'south',
      y: 80,
    });
  }
  return { url: cloudinary.url(backgroundPublicId, { secure: true, transformation }), mock: false };
}

export default cloudinary;
