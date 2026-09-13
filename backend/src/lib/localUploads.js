import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Where uploads land when Cloudinary isn't configured (mock mode). */
export const UPLOAD_DIR = path.resolve(__dirname, '../../tmp/uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Extension per MIME type, for the formats the studio accepts. */
export const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

export const isDataUri = (value) => typeof value === 'string' && value.startsWith('data:');

/** Decode a data-URI into `{ mime, buffer }`. Throws on anything malformed. */
export function decodeDataUri(dataUri) {
  const comma = dataUri.indexOf(',');
  if (!dataUri.startsWith('data:') || comma < 0) throw new Error('Not a data URI');
  const header = dataUri.slice(5, comma);
  const body = dataUri.slice(comma + 1);
  const isBase64 = header.includes(';base64');
  return {
    mime: header.split(';')[0] || 'application/octet-stream',
    buffer: isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8'),
  };
}

/**
 * Persist a decoded upload on disk and hand back a URL the render job (and the
 * browser) can fetch. Keeps multi-megabyte base64 blobs out of the database:
 * a data URI stored on a record is re-sent on every read of that record, so a
 * single 4 MB logo would be paid for on every brand list request.
 */
export function saveLocalUpload(buffer, ext = 'bin') {
  const filename = `${nanoid(12)}.${ext.replace(/[^a-z0-9]/gi, '') || 'bin'}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { url: `${env.apiBaseUrl}/media/uploads/${filename}`, bytes: buffer.length, filename };
}

/** Decode + persist in one step, returning the same shape as `uploadMedia`. */
export function saveDataUri(dataUri) {
  const { mime, buffer } = decodeDataUri(dataUri);
  const { url, bytes } = saveLocalUpload(buffer, MIME_EXT[mime] || 'bin');
  return { url, secureUrl: url, publicId: null, width: null, height: null, bytes, format: mime, mock: true };
}
