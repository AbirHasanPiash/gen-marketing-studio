import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Provider-agnostic text-to-image. Default provider `pollinations` is KEYLESS,
 * so image generation works immediately; set IMAGE_PROVIDER + a key to switch
 * to Stability / Replicate / OpenAI. Every provider returns [{ url, seed }],
 * where `url` is directly renderable (remote URL or data URI).
 */

function seededFrom(prompt, i) {
  let h = 0;
  const s = `${prompt}:${i}`;
  for (let k = 0; k < s.length; k += 1) h = (h * 31 + s.charCodeAt(k)) >>> 0;
  return h % 1_000_000;
}

function pollinations(prompt, { width, height, count }) {
  return Array.from({ length: count }, (_, i) => {
    const seed = seededFrom(prompt, i);
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
    return { url, seed, provider: 'pollinations' };
  });
}

function mock(prompt, { width, height, count }) {
  return Array.from({ length: count }, (_, i) => {
    const seed = seededFrom(prompt, i);
    return {
      url: `https://picsum.photos/seed/${seed}/${width}/${height}`,
      seed,
      provider: 'mock',
    };
  });
}

async function stability(prompt, { width, height, count }) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.image.stabilityKey}`,
          Accept: 'application/json',
        },
        body: (() => {
          const fd = new FormData();
          fd.append('prompt', prompt);
          fd.append('output_format', 'png');
          fd.append('aspect_ratio', width === height ? '1:1' : '9:16');
          return fd;
        })(),
      }
    );
    if (!res.ok) throw new Error(`Stability ${res.status}: ${await res.text()}`);
    const data = await res.json();
    out.push({ url: `data:image/png;base64,${data.image}`, seed: data.seed, provider: 'stability' });
  }
  return out;
}

async function openai(prompt, { width, height, count }) {
  const size = width === height ? '1024x1024' : '1024x1792';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.image.openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: count, size }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d, i) => ({
    url: d.url || `data:image/png;base64,${d.b64_json}`,
    seed: i,
    provider: 'openai',
  }));
}

async function replicate(prompt, { width, height, count }) {
  // Uses the sync-ish create + poll flow for SDXL.
  const create = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.image.replicateToken}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      version: 'black-forest-labs/flux-schnell',
      input: { prompt, num_outputs: count, aspect_ratio: width === height ? '1:1' : '9:16' },
    }),
  });
  if (!create.ok) throw new Error(`Replicate ${create.status}: ${await create.text()}`);
  const data = await create.json();
  const urls = Array.isArray(data.output) ? data.output : [data.output].filter(Boolean);
  return urls.map((url, i) => ({ url, seed: i, provider: 'replicate' }));
}

const PROVIDERS = { pollinations, mock, stability, openai, replicate };

export async function generateImages({ prompt, width = 1024, height = 1024, count = 1 } = {}) {
  const provider = env.image.provider;
  const opts = { width, height, count: Math.min(4, Math.max(1, count)) };

  // Guard: paid providers need a key; otherwise degrade to pollinations.
  const keyMissing =
    (provider === 'stability' && !env.image.stabilityKey) ||
    (provider === 'openai' && !env.image.openaiKey) ||
    (provider === 'replicate' && !env.image.replicateToken);

  const fn = PROVIDERS[provider] && !keyMissing ? PROVIDERS[provider] : PROVIDERS.pollinations;

  try {
    return await fn(prompt, opts);
  } catch (err) {
    logger.warn(`Image provider "${provider}" failed (${err.message}); using pollinations.`);
    return pollinations(prompt, opts);
  }
}

export default { generateImages };
