import { prisma } from '../../lib/prisma.js';
import { generateImages } from '../../lib/imagegen.js';
import { env } from '../../config/env.js';
import { sha256, normalizePrompt } from '../../utils/hash.js';
import { logger } from '../../lib/logger.js';

export const SIZE_PRESETS = {
  square: { width: 1024, height: 1024, label: 'Square 1:1' },
  portrait: { width: 1024, height: 1280, label: 'Portrait 4:5' },
  story: { width: 1024, height: 1792, label: 'Story 9:16' },
  landscape: { width: 1280, height: 1024, label: 'Landscape 5:4' },
};

/** Compose a rich text-to-image prompt from a creative brief + brand kit. */
export function buildPromptFromBrief(brief, brand) {
  const parts = [
    brief.productRef || brief.title,
    brief.style && `${brief.style} style`,
    brief.mood && `${brief.mood} mood`,
    brief.palette && `color palette: ${brief.palette}`,
    brand?.name && `for the brand "${brand.name}"`,
    brief.notes,
    'professional product advertising photography, high detail, studio lighting, marketing creative',
  ].filter(Boolean);
  return parts.join(', ');
}

const cacheKey = (prompt, provider, width, height) =>
  sha256(`${normalizePrompt(prompt)}|${provider}|${width}x${height}`);

/**
 * Text-to-image with a caching layer (Feature 7). Identical prompts return the
 * cached image URLs instead of calling the (potentially paid) provider again,
 * while tracking hit counts to surface high-performing prompts.
 */
export async function generateFromPrompt({
  tenantId,
  prompt,
  size = 'square',
  count = 2,
  force = false,
}) {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.square;
  const provider = env.image.provider;
  const key = cacheKey(prompt, provider, preset.width, preset.height);

  const existing = await prisma.promptCache.findUnique({
    where: { tenantId_promptHash: { tenantId, promptHash: key } },
  });

  if (existing && !force && existing.resultUrls.length) {
    const updated = await prisma.promptCache.update({
      where: { id: existing.id },
      data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    logger.info(`Prompt cache HIT (${updated.hitCount} hits) — skipped image API call`);
    return {
      cached: true,
      images: existing.resultUrls.map((url) => ({ url })),
      promptCacheId: existing.id,
      prompt,
      size,
      provider,
    };
  }

  const images = await generateImages({
    prompt,
    width: preset.width,
    height: preset.height,
    count,
  });
  const resultUrls = images.map((i) => i.url);

  const cache = await prisma.promptCache.upsert({
    where: { tenantId_promptHash: { tenantId, promptHash: key } },
    create: {
      tenantId,
      promptHash: key,
      prompt,
      model: provider,
      params: { width: preset.width, height: preset.height, count },
      resultUrls,
      hitCount: 1,
    },
    update: { resultUrls, lastUsedAt: new Date() },
  });

  logger.info(`Prompt cache MISS — generated ${resultUrls.length} image(s) via ${provider}`);
  return { cached: false, images, promptCacheId: cache.id, prompt, size, provider };
}
