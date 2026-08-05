import { env } from '../config/env.js';
import { logger } from './logger.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const groqEnabled = () => env.groq.enabled;

/* ---------------------------------------------------------------------------
 * Mock generator — produces believable marketing copy with no API key so the
 * whole copy studio is demoable offline.
 * ------------------------------------------------------------------------- */
const EMOJIS = ['✨', '🔥', '🎉', '💡', '🛍️', '🚀', '❤️', '🌟', '👀', '💯'];
const HOOKS = [
  'Meet your new favourite',
  'Say hello to',
  'Stop scrolling —',
  'The wait is over:',
  'Level up with',
  'Everyone is talking about',
];
const CTAS = [
  'Order now — link in bio!',
  'DM us to grab yours today.',
  'Limited stock. Don’t miss out!',
  'Tap the link and treat yourself.',
  'Available now across Bangladesh 🇧🇩',
];

function pick(arr, i) {
  return arr[Math.abs(i) % arr.length];
}

function mockCaption(input, i = 0) {
  const product = input.product || input.topic || 'our latest drop';
  const tone = input.tone ? ` (${input.tone})` : '';
  return `${pick(HOOKS, i)} ${product}${tone} ${pick(EMOJIS, i)}\n\n${
    input.details || 'Crafted with love, made for you.'
  } ${pick(EMOJIS, i + 3)}\n\n${pick(CTAS, i)}`;
}

function mockHashtags(input, i = 0) {
  const base = (input.product || input.topic || 'shop')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const pool = [
    ...base.map((w) => `#${w.replace(/[^a-z0-9]/g, '')}`),
    '#Bangladesh',
    '#Dhaka',
    '#shoplocal',
    '#smallbusiness',
    '#instagood',
    '#trending',
    '#sale',
    '#newarrival',
    '#ootd',
    '#deshi',
  ];
  return [...new Set(pool)].slice(0, 12 + (i % 3)).join(' ');
}

async function mockStream(text, onToken, delay = 12) {
  const tokens = text.match(/\S+\s*/g) || [text];
  for (const t of tokens) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, delay));
    onToken?.(t);
  }
  return text;
}

/* ---------------------------------------------------------------------------
 * Real Groq calls (OpenAI-compatible endpoint).
 * ------------------------------------------------------------------------- */
async function groqRequest(messages, { temperature = 0.9, stream = false, json = false } = {}) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.groq.apiKey}`,
    },
    body: JSON.stringify({
      model: env.groq.model,
      messages,
      temperature,
      stream,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

/** Non-streaming completion → returns the full string. */
export async function complete({ system, prompt, temperature, json } = {}) {
  const messages = [
    system ? { role: 'system', content: system } : null,
    { role: 'user', content: prompt },
  ].filter(Boolean);

  if (!groqEnabled()) {
    return mockCaption({ product: prompt.slice(0, 40) });
  }
  const res = await groqRequest(messages, { temperature, json });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Streaming completion. Invokes `onToken(text)` for each delta and resolves
 * with the concatenated result.
 */
export async function stream({ system, prompt, temperature, onToken, mockText } = {}) {
  const messages = [
    system ? { role: 'system', content: system } : null,
    { role: 'user', content: prompt },
  ].filter(Boolean);

  if (!groqEnabled()) {
    return mockStream(mockText || mockCaption({ product: (prompt || '').slice(0, 40) }), onToken);
  }

  const res = await groqRequest(messages, { temperature, stream: true });
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return full;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          onToken?.(delta);
        }
      } catch {
        /* ignore keep-alive / partial */
      }
    }
  }
  return full;
}

/** Generate N distinct variations of a piece of copy. */
export async function variations({ kind, input, count = 5 } = {}) {
  if (!groqEnabled()) {
    return Array.from({ length: count }, (_, i) =>
      kind === 'hashtags' ? mockHashtags(input, i) : mockCaption(input, i)
    );
  }

  const system =
    'You are a senior social-media copywriter for small Bangladeshi retail brands. ' +
    'Write punchy, culturally-aware copy. Return STRICT JSON: {"variations": string[]}.';
  const user = `Produce ${count} distinct ${kind} variations.\nContext: ${JSON.stringify(input)}`;

  try {
    const res = await groqRequest(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { temperature: 1.0, json: true }
    );
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const list = Array.isArray(parsed.variations) ? parsed.variations : [];
    return list.length ? list.slice(0, count) : Array.from({ length: count }, (_, i) => mockCaption(input, i));
  } catch (err) {
    logger.warn('Groq variations failed, using mock:', err.message);
    return Array.from({ length: count }, (_, i) =>
      kind === 'hashtags' ? mockHashtags(input, i) : mockCaption(input, i)
    );
  }
}

export { mockCaption, mockHashtags };
