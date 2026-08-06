import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export const TRANSITIONS = {
  submit: { from: ['DRAFT', 'REJECTED'], to: 'PENDING_REVIEW', roles: ['OWNER', 'CREATOR'] },
  approve: { from: ['PENDING_REVIEW'], to: 'APPROVED', roles: ['OWNER'] },
  reject: { from: ['PENDING_REVIEW'], to: 'REJECTED', roles: ['OWNER'] },
  schedule: { from: ['APPROVED', 'DRAFT', 'SCHEDULED'], to: 'SCHEDULED', roles: ['OWNER'] },
  unschedule: { from: ['SCHEDULED'], to: 'APPROVED', roles: ['OWNER'] },
  publish: { from: ['APPROVED', 'SCHEDULED'], to: 'PUBLISHING', roles: ['OWNER'] },
  archive: {
    from: ['DRAFT', 'REJECTED', 'PUBLISHED', 'FAILED', 'APPROVED', 'SCHEDULED'],
    to: 'ARCHIVED',
    roles: ['OWNER', 'CREATOR'],
  },
};

async function notify(tenantId, userIds, payload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ tenantId, userId, ...payload })),
  });
}


export async function applyTransition({ post, action, actor, data = {} }) {
  const rule = TRANSITIONS[action];
  if (!rule) throw ApiError.badRequest(`Unknown action: ${action}`);
  if (!rule.roles.includes(actor.role))
    throw ApiError.forbidden(`Your role cannot ${action} a post`);
  if (!rule.from.includes(post.status))
    throw ApiError.badRequest(`Cannot ${action} a post in ${post.status} state`);

  const updateData = { status: rule.to };
  if (action === 'approve') {
    updateData.reviewerId = actor.id;
    updateData.reviewNote = data.note || null;
    updateData.rejectReason = null;
  }
  if (action === 'reject') {
    updateData.reviewerId = actor.id;
    updateData.rejectReason = data.reason || 'No reason provided';
  }
  if (action === 'schedule') {
    if (!data.scheduledAt) throw ApiError.badRequest('scheduledAt is required to schedule');
    updateData.scheduledAt = new Date(data.scheduledAt);
  }
  if (action === 'unschedule') updateData.scheduledAt = null;

  const [updated] = await prisma.$transaction([
    prisma.post.update({ where: { id: post.id }, data: updateData }),
    prisma.postActivity.create({
      data: {
        postId: post.id,
        actorId: actor.id,
        action: action.toUpperCase(),
        fromState: post.status,
        toState: rule.to,
        note: data.note || data.reason || null,
      },
    }),
  ]);


  if (action === 'submit') {
    const owners = await prisma.user.findMany({
      where: { tenantId: post.tenantId, role: 'OWNER', isActive: true },
      select: { id: true },
    });
    await notify(post.tenantId, owners.map((o) => o.id), {
      type: 'APPROVAL_REQUEST',
      title: 'New post awaiting review',
      body: post.title || post.body?.slice(0, 80),
      link: `/approvals`,
    });
  } else if (action === 'approve' || action === 'reject') {
    await notify(post.tenantId, [post.authorId], {
      type: action === 'approve' ? 'APPROVED' : 'REJECTED',
      title: action === 'approve' ? 'Your post was approved' : 'Your post needs changes',
      body: data.note || data.reason || post.title || '',
      link: `/posts/${post.id}`,
    });
  }

  return updated;
}


function splitHashtags(text) {
  const tags = (text.match(/#[\p{L}0-9_]+/gu) || []);
  const body = text.replace(/#[\p{L}0-9_]+/gu, '').replace(/\n{3,}/g, '\n\n').trim();
  return { body, tags };
}


export function adaptForPlatforms(post) {
  const raw = post.body || '';
  const { body, tags } = splitHashtags(raw);
  const hashtags = [...new Set([...(post.hashtags || []), ...tags.map((t) => t.replace('#', ''))])];

  const facebook = [
    post.title ? `${post.title}\n` : '',
    body,
    '',
    '👉 Learn more / order — link in the comments.',
    hashtags.slice(0, 3).map((t) => `#${t}`).join(' '),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  const firstLine = body.split('\n')[0];
  const rest = body.split('\n').slice(1).join('\n');
  const instagram = [
    post.title ? `✨ ${post.title}` : `✨ ${firstLine}`,
    post.title ? firstLine : '',
    rest,
    '',
    '.\n.\n.',
    hashtags.slice(0, 15).map((t) => `#${t}`).join(' '),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  return { FACEBOOK: facebook, INSTAGRAM: instagram };
}



export function toWhatsApp(post) {
  const { body, tags } = splitHashtags(post.body || '');
  const hashtags = [...new Set([...(post.hashtags || []), ...tags.map((t) => t.replace('#', ''))])];
  const text = [
    post.title ? `*${post.title}*` : '',
    body,
    hashtags.length ? hashtags.map((t) => `#${t}`).join(' ') : '',
    post.mediaUrls?.[0] ? `\n📷 ${post.mediaUrls[0]}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return { text, waLink: `https://wa.me/?text=${encodeURIComponent(text)}` };
}
