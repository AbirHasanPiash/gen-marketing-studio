import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Where uploads land when Cloudinary isn't configured (mock mode). */
export const UPLOAD_DIR = path.resolve(__dirname, '../../tmp/uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
 * browser) can fetch. Keeps multi-megabyte base64 blobs out of the database.
 */
export function saveLocalUpload(buffer, ext = 'bin') {
  const filename = `${nanoid(12)}.${ext.replace(/[^a-z0-9]/gi, '') || 'bin'}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { url: `${env.apiBaseUrl}/media/uploads/${filename}`, bytes: buffer.length, filename };
}
