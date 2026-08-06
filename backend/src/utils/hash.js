import crypto from 'node:crypto';

/** Deterministic SHA-256 of an object/string — used for the prompt cache key. */
export function sha256(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/** Normalise a prompt so cosmetically-different prompts share a cache entry. */
export function normalizePrompt(prompt) {
  return String(prompt || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
