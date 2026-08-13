import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Provider-agnostic text-to-image. Default provider `pollinations` is KEYLESS,
 * so image generation works immediately; set IMAGE_PROVIDER + a key to switch
 * to Stability / Replicate / OpenAI / Gemini. Every provider returns [{ url, seed }],
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

async function gemini(prompt, { count }) {
  const out = [];
  
  // Gemini doesn't currently support native batch generation for images via REST in a single call,
  // so we use a loop similar to the Stability AI implementation.
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${env.image.geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE']
          }
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    
    // Google's API returns the image inline as base64 inside the content part
    const part = data.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/png';
      out.push({
        url: `data:${mime};base64,${part.inlineData.data}`,
        seed: i,
        provider: 'gemini',
      });
    } else {
      throw new Error('Gemini API returned an unexpected payload structure.');
    }
  }
  return out;
}

// 1. Added gemini to the PROVIDERS map
const PROVIDERS = { pollinations, mock, stability, openai, replicate, gemini };

export async function generateImages({ prompt, width = 1024, height = 1024, count = 1 } = {}) {
  const provider = env.image.provider;
  const opts = { width, height, count: Math.min(4, Math.max(1, count)) };

  // 2. Added safety guard for gemini
  const keyMissing =
    (provider === 'stability' && !env.image.stabilityKey) ||
    (provider === 'openai' && !env.image.openaiKey) ||
    (provider === 'replicate' && !env.image.replicateToken) ||
    (provider === 'gemini' && !env.image.geminiKey);

  const fn = PROVIDERS[provider] && !keyMissing ? PROVIDERS[provider] : PROVIDERS.pollinations;

  try {
    return await fn(prompt, opts);
  } catch (err) {
    logger.warn(`Image provider "${provider}" failed (${err.message}); using pollinations.`);
    return pollinations(prompt, opts);
  }
}

export default { generateImages };