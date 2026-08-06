import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Meta Graph API wrapper (Features 8 & 15). Handles OAuth, publishing to
 * Facebook Pages + Instagram, and insight retrieval. When the app isn't
 * configured (or a dev/mock token is used) it returns realistic fake data so
 * the publishing pipeline and analytics run end-to-end without a Meta app.
 */

const graph = (path) =>
  `https://graph.facebook.com/${env.meta.graphVersion}/${path.replace(/^\//, '')}`;

export const metaEnabled = () => env.meta.enabled;
export const isMockToken = (token) => !token || String(token).startsWith('mock.');

export const SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'read_insights',
];

export function getOAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: env.meta.appId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES.join(','),
    response_type: 'code',
  });
  return `https://www.facebook.com/${env.meta.graphVersion}/dialog/oauth?${params}`;
}

async function graphGet(path, params = {}) {
  const url = new URL(graph(path));
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Graph GET ${res.status}`);
  return data;
}

async function graphPost(path, body = {}) {
  const url = new URL(graph(path));
  Object.entries(body).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Graph POST ${res.status}`);
  return data;
}

export async function exchangeCodeForToken(code, redirectUri) {
  const data = await graphGet('oauth/access_token', {
    client_id: env.meta.appId,
    client_secret: env.meta.appSecret,
    redirect_uri: redirectUri,
    code,
  });
  return data.access_token;
}

export async function getLongLivedToken(shortToken) {
  const data = await graphGet('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: env.meta.appId,
    client_secret: env.meta.appSecret,
    fb_exchange_token: shortToken,
  });
  return { token: data.access_token, expiresIn: data.expires_in };
}

/** Returns connectable Facebook Pages + their linked IG business accounts. */
export async function getManagedAccounts(userToken) {
  if (isMockToken(userToken) || !metaEnabled()) {
    return [
      {
        platform: 'FACEBOOK',
        externalId: 'mock.page.123',
        pageId: 'mock.page.123',
        name: 'Demo Brand Page',
        accessToken: 'mock.page.token',
        igBusinessId: 'mock.ig.456',
      },
      {
        platform: 'INSTAGRAM',
        externalId: 'mock.ig.456',
        pageId: 'mock.page.123',
        name: 'Demo Brand (Instagram)',
        accessToken: 'mock.page.token',
        igBusinessId: 'mock.ig.456',
      },
    ];
  }

  const pages = await graphGet('me/accounts', {
    access_token: userToken,
    fields: 'id,name,access_token,instagram_business_account{id,username}',
  });

  const accounts = [];
  for (const page of pages.data || []) {
    accounts.push({
      platform: 'FACEBOOK',
      externalId: page.id,
      pageId: page.id,
      name: page.name,
      accessToken: page.access_token,
      igBusinessId: page.instagram_business_account?.id || null,
    });
    if (page.instagram_business_account) {
      accounts.push({
        platform: 'INSTAGRAM',
        externalId: page.instagram_business_account.id,
        pageId: page.id,
        name: `${page.name} (Instagram)`,
        accessToken: page.access_token,
        igBusinessId: page.instagram_business_account.id,
      });
    }
  }
  return accounts;
}

function mockPublish(platform) {
  const id = `mock_${platform.toLowerCase()}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    externalId: id,
    permalink:
      platform === 'INSTAGRAM'
        ? `https://instagram.com/p/${id}`
        : `https://facebook.com/${id}`,
    mock: true,
  };
}

/** Publish a post to Facebook (photo or text) and return the external id. */
export async function publishToFacebook({ pageId, accessToken, message, imageUrl }) {
  if (isMockToken(accessToken) || !metaEnabled()) return mockPublish('FACEBOOK');
  if (imageUrl) {
    const r = await graphPost(`${pageId}/photos`, { url: imageUrl, caption: message, access_token: accessToken });
    return { externalId: r.post_id || r.id, permalink: `https://facebook.com/${r.post_id || r.id}` };
  }
  const r = await graphPost(`${pageId}/feed`, { message, access_token: accessToken });
  return { externalId: r.id, permalink: `https://facebook.com/${r.id}` };
}

/** Publish to Instagram via the 2-step container → publish flow. */
export async function publishToInstagram({ igBusinessId, accessToken, caption, imageUrl }) {
  if (isMockToken(accessToken) || !metaEnabled()) return mockPublish('INSTAGRAM');
  if (!imageUrl) throw new Error('Instagram requires an image');
  const container = await graphPost(`${igBusinessId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });
  const published = await graphPost(`${igBusinessId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });
  return { externalId: published.id, permalink: `https://instagram.com/p/${published.id}` };
}

/** Fetch engagement insights for a published item (Feature 15). */
export async function getInsights({ platform, externalId, accessToken, igBusinessId }) {
  if (isMockToken(accessToken) || !metaEnabled()) {
    const r = (min, max) => Math.floor(min + Math.random() * (max - min));
    const impressions = r(400, 9000);
    return {
      impressions,
      reach: Math.round(impressions * 0.8),
      views: impressions,
      likes: r(20, 600),
      comments: r(0, 90),
      shares: r(0, 120),
      saves: r(0, 80),
      clicks: r(5, 300),
      mock: true,
    };
  }

  try {
    if (platform === 'INSTAGRAM') {
      const data = await graphGet(`${externalId}/insights`, {
        metric: 'impressions,reach,likes,comments,shares,saved',
        access_token: accessToken,
      });
      const m = Object.fromEntries((data.data || []).map((d) => [d.name, d.values?.[0]?.value || 0]));
      return {
        impressions: m.impressions || 0,
        reach: m.reach || 0,
        views: m.impressions || 0,
        likes: m.likes || 0,
        comments: m.comments || 0,
        shares: m.shares || 0,
        saves: m.saved || 0,
        clicks: 0,
      };
    }
    const data = await graphGet(`${externalId}/insights`, {
      metric: 'post_impressions,post_engaged_users,post_reactions_by_type_total',
      access_token: accessToken,
    });
    const m = Object.fromEntries((data.data || []).map((d) => [d.name, d.values?.[0]?.value || 0]));
    return {
      impressions: m.post_impressions || 0,
      reach: m.post_impressions || 0,
      views: m.post_impressions || 0,
      likes: m.post_engaged_users || 0,
      comments: 0,
      shares: 0,
      saves: 0,
      clicks: 0,
    };
  } catch (err) {
    logger.warn('Insights fetch failed:', err.message);
    throw err;
  }
}

export default {
  getOAuthUrl,
  exchangeCodeForToken,
  getLongLivedToken,
  getManagedAccounts,
  publishToFacebook,
  publishToInstagram,
  getInsights,
  metaEnabled,
  isMockToken,
};
