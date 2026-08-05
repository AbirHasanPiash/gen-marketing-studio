import slugify from 'slugify';
import { customAlphabet } from 'nanoid';

const short = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

export const toSlug = (str) =>
  slugify(String(str || ''), { lower: true, strict: true, trim: true }) || 'item';

/** Slug guaranteed unique via `exists(slug) => Promise<bool>`. */
export async function uniqueSlug(base, exists) {
  const root = toSlug(base);
  let candidate = root;
  // Try the clean slug first, then append short random suffixes.
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(candidate))) return candidate;
    candidate = `${root}-${short()}`;
  }
  return `${root}-${short()}`;
}

export const nanoSlug = () => short();
