import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';
import * as groq from '../../lib/groq.js';
import { upcomingMoments, getMoment } from '../../data/localMoments.js';

const router = Router();

const COPY_SYSTEM =
  'You are an expert social-media copywriter for small and medium Bangladeshi retail brands. ' +
  'You write scroll-stopping, culturally-aware copy in a warm, modern voice, mixing English with the ' +
  'occasional natural Bangla word where it fits. Keep it concise and platform-appropriate.';

function buildCopyPrompt(kind, input) {
  const ctx = [
    input.product && `Product/topic: ${input.product}`,
    input.brandName && `Brand: ${input.brandName}`,
    input.platform && `Platform: ${input.platform}`,
    input.tone && `Tone: ${input.tone}`,
    input.details && `Extra details: ${input.details}`,
    input.audience && `Audience: ${input.audience}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (kind === 'ad_copy') {
    return `Write short, persuasive ad copy (headline + 2-3 sentence body + CTA) for the following.\n${ctx}`;
  }
  return `Write one engaging social-media caption with 1-2 emojis and a strong call-to-action.\n${ctx}`;
}

// --- Streaming single generation (Feature 6) -------------------------------

router.post(
  '/copy/stream',
  authenticate,
  validate({
    body: z.object({
      kind: z.enum(['caption', 'ad_copy']).default('caption'),
      product: z.string().max(200).optional(),
      brandName: z.string().max(120).optional(),
      platform: z.string().max(40).optional(),
      tone: z.string().max(40).optional(),
      details: z.string().max(1000).optional(),
      audience: z.string().max(120).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { kind, ...input } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let full = '';
    try {
      full = await groq.stream({
        system: COPY_SYSTEM,
        prompt: buildCopyPrompt(kind, input),
        temperature: 0.9,
        mockText: groq.mockCaption({ product: input.product, tone: input.tone }),
        onToken: (t) => res.write(`data: ${JSON.stringify({ token: t })}\n\n`),
      });
      await prisma.copyGeneration.create({
        data: { tenantId: req.tenantId, authorId: req.user.id, kind, input, variations: [full] },
      });
      res.write(`event: done\ndata: ${JSON.stringify({ text: full })}\n\n`);
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    } finally {
      res.end();
    }
  })
);

// --- "Generate 5 variations" (Feature 6) -----------------------------------

router.post(
  '/copy/variations',
  authenticate,
  validate({
    body: z.object({
      kind: z.enum(['caption', 'hashtags', 'ad_copy']).default('caption'),
      input: z.object({}).passthrough().default({}),
      count: z.coerce.number().int().min(1).max(8).default(5),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { kind, input, count } = req.body;
    const variations = await groq.variations({ kind, input, count });
    const record = await prisma.copyGeneration.create({
      data: { tenantId: req.tenantId, authorId: req.user.id, kind, input, variations },
    });
    return ok(res, { id: record.id, kind, variations });
  })
);

router.get(
  '/copy/history',
  authenticate,
  asyncHandler(async (req, res) => {
    const items = await prisma.copyGeneration.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { author: { select: { name: true } } },
    });
    return ok(res, items);
  })
);

// --- Local campaign suggester (Feature 6) ----------------------------------

router.get(
  '/moments',
  authenticate,
  asyncHandler(async (req, res) => {
    const withinDays = Math.min(365, Number(req.query.withinDays) || 90);
    return ok(res, upcomingMoments(new Date(), withinDays));
  })
);

router.post(
  '/campaigns/suggest',
  authenticate,
  validate({
    body: z.object({
      brandId: z.string().optional(),
      withinDays: z.coerce.number().int().min(7).max(365).default(90),
      limit: z.coerce.number().int().min(1).max(8).default(4),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { brandId, withinDays, limit } = req.body;
    const brand = brandId
      ? await prisma.brandProfile.findFirst({ where: { id: brandId, tenantId: req.tenantId } })
      : null;

    const moments = upcomingMoments(new Date(), withinDays).slice(0, limit);
    const suggestions = await Promise.all(
      moments.map(async (m) => {
        let caption = m.sampleAngle;
        if (groq.groqEnabled()) {
          try {
            caption = await groq.complete({
              system: COPY_SYSTEM,
              prompt:
                `Write one short social caption for a ${brand?.industry || 'retail'} brand` +
                `${brand ? ` called "${brand.name}"` : ''} for "${m.name}" (${m.subtitle}). ` +
                `Angle: ${m.sampleAngle}. Include a CTA and 1 emoji.`,
              temperature: 0.9,
            });
          } catch {
            /* keep sample angle */
          }
        }
        return {
          momentKey: m.key,
          name: `${m.name} Campaign`,
          moment: { name: m.name, subtitle: m.subtitle, emoji: m.emoji, inDays: m.inDays },
          theme: m.themes[0],
          themes: m.themes,
          color: m.colors[0],
          colors: m.colors,
          description: m.description,
          startsInDays: m.inDays,
          draftCaption: caption,
        };
      })
    );

    return ok(res, suggestions);
  })
);

/** Accept a suggestion → persist a Campaign (and optionally a draft post). */
router.post(
  '/campaigns/accept',
  authenticate,
  validate({
    body: z.object({
      momentKey: z.string(),
      brandId: z.string().optional().nullable(),
      createDraftPost: z.boolean().default(true),
      draftCaption: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const moment = getMoment(req.body.momentKey);
    if (!moment) return ok(res, { created: false });

    const campaign = await prisma.campaign.create({
      data: {
        tenantId: req.tenantId,
        brandId: req.body.brandId || null,
        name: `${moment.name} Campaign`,
        theme: moment.themes[0],
        description: moment.description,
        color: moment.colors[0],
        isSuggested: true,
        momentKey: moment.key,
        startDate: new Date(Date.now() + moment.month * 0), // anchored client-side; kept simple
      },
    });

    let post = null;
    if (req.body.createDraftPost && req.body.brandId) {
      post = await prisma.post.create({
        data: {
          tenantId: req.tenantId,
          brandId: req.body.brandId,
          authorId: req.user.id,
          campaignId: campaign.id,
          title: `${moment.emoji} ${moment.name}`,
          body: req.body.draftCaption || moment.sampleAngle,
          platforms: ['FACEBOOK', 'INSTAGRAM'],
          status: 'DRAFT',
        },
      });
    }
    return ok(res, { created: true, campaign, post });
  })
);

export default router;
