import { prisma } from '../../lib/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import * as meta from '../../lib/meta.js';
import { adaptForPlatforms } from '../post/post.service.js';

const PUBLISHABLE = ['FACEBOOK', 'INSTAGRAM'];

/** Mark an error as non-retryable (missing account, no platforms, etc.). */
function permanent(message) {
  const e = new Error(message);
  e.permanent = true;
  return e;
}

/**
 * Executes the publishing pipeline for a post across its selected platforms.
 * Creates a Publication row per platform and flips the post to PUBLISHED when
 * at least one platform succeeds. Throws (optionally `.permanent`) on failure
 * so the Agenda worker can decide whether to retry.
 */
export async function runPublishJob(postId) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { brand: true } });
  if (!post) throw permanent('Post not found');

  const targets = (post.platforms || []).filter((p) => PUBLISHABLE.includes(p));
  if (!targets.length) throw permanent('No publishable platforms selected (Facebook/Instagram)');

  await prisma.post.update({ where: { id: postId }, data: { status: 'PUBLISHING' } });
  // Clear stale failures from previous attempts so retries stay idempotent.
  await prisma.publication.deleteMany({ where: { postId, status: 'FAILED' } });

  const accounts = await prisma.socialAccount.findMany({
    where: { brandId: post.brandId, isActive: true, platform: { in: targets } },
  });

  const platformCopy = post.platformCopy || adaptForPlatforms(post);
  const results = [];
  let anySuccess = false;
  let lastError = null;

  for (const platform of targets) {
    const account = accounts.find((a) => a.platform === platform);
    if (!account) {
      lastError = permanent(`No connected ${platform} account for this brand`);
      results.push(
        // eslint-disable-next-line no-await-in-loop
        await prisma.publication.create({
          data: { tenantId: post.tenantId, postId, platform, status: 'FAILED', error: lastError.message },
        })
      );
      continue;
    }

    const token = decrypt(account.accessToken);
    const caption = platformCopy?.[platform] || post.body;
    const imageUrl = post.mediaUrls?.[0];

    try {
      const r =
        platform === 'FACEBOOK'
          ? // eslint-disable-next-line no-await-in-loop
            await meta.publishToFacebook({
              pageId: account.pageId || account.externalId,
              accessToken: token,
              message: caption,
              imageUrl,
            })
          : // eslint-disable-next-line no-await-in-loop
            await meta.publishToInstagram({
              igBusinessId: account.igBusinessId || account.externalId,
              accessToken: token,
              caption,
              imageUrl,
            });

      results.push(
        // eslint-disable-next-line no-await-in-loop
        await prisma.publication.create({
          data: {
            tenantId: post.tenantId,
            postId,
            platform,
            socialAccountId: account.id,
            externalId: r.externalId,
            permalink: r.permalink,
            status: 'SUCCESS',
            publishedAt: new Date(),
          },
        })
      );
      anySuccess = true;
    } catch (err) {
      lastError = err;
      results.push(
        // eslint-disable-next-line no-await-in-loop
        await prisma.publication.create({
          data: {
            tenantId: post.tenantId,
            postId,
            platform,
            socialAccountId: account.id,
            status: 'FAILED',
            error: err.message,
          },
        })
      );
    }
  }

  if (!anySuccess) {
    const e = new Error(lastError?.message || 'Publishing failed');
    if (lastError?.permanent) e.permanent = true;
    throw e;
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
  await prisma.notification.create({
    data: {
      tenantId: post.tenantId,
      userId: post.authorId,
      type: 'PUBLISHED',
      title: 'Your post is live 🎉',
      body: post.title || post.body?.slice(0, 80) || '',
      link: `/posts/${postId}`,
    },
  });

  logger.success(`Published post ${postId} to ${results.filter((r) => r.status === 'SUCCESS').length} platform(s)`);
  return results;
}
