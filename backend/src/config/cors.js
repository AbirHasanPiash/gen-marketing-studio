import { env } from './env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../lib/logger.js';

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Vercel gives every preview deployment its own hostname —
 * `<project>-<hash>-<scope>.vercel.app` and `<project>-git-<branch>-<scope>.vercel.app` —
 * so an exact-match allow-list covers production and nothing else, and every
 * preview build fails CORS against the deployed API.
 *
 * We allow previews for ONE named project rather than all of `*.vercel.app`,
 * which would let any site hosted on Vercel call this API. Residual risk worth
 * knowing: someone could register a Vercel project whose name starts with
 * yours and land inside this pattern. That's acceptable here because auth is a
 * localStorage bearer token — origin-scoped, so a hostile page can't read it —
 * rather than a cookie the browser would attach automatically. Set
 * `VERCEL_PREVIEWS=false` to drop back to exact origins only.
 */
function previewPattern() {
  if (!env.cors.vercelPreviews) return null;

  let slug = env.cors.vercelProject;
  if (!slug) {
    // Derive it when production is itself on vercel.app; a custom domain has
    // to name the project explicitly via VERCEL_PROJECT_NAME.
    try {
      const { hostname } = new URL(env.webBaseUrl);
      if (hostname.endsWith('.vercel.app')) slug = hostname.replace(/\.vercel\.app$/, '');
    } catch {
      /* WEB_BASE_URL isn't a URL — no previews */
    }
  }
  if (!slug) return null;
  return new RegExp(`^https://${escapeRe(slug)}(-[a-z0-9-]+)?\\.vercel\\.app$`);
}

/** Build the `cors` options once at startup. */
export function corsOptions() {
  const exact = new Set([env.webBaseUrl, ...DEV_ORIGINS, ...env.cors.extraOrigins].filter(Boolean));
  const preview = previewPattern();
  const reported = new Set();

  if (preview) logger.info(`CORS: Vercel previews allowed for ${preview.source}`);

  return {
    credentials: true,
    origin(origin, callback) {
      // No Origin header at all: curl, server-to-server, same-origin navigation.
      if (!origin) return callback(null, true);
      if (exact.has(origin) || preview?.test(origin)) return callback(null, true);

      // Log each unknown origin once — a misconfigured frontend would otherwise
      // repeat this on every request.
      if (!reported.has(origin)) {
        reported.add(origin);
        logger.warn(`CORS blocked ${origin} — set WEB_BASE_URL, or add it to CORS_EXTRA_ORIGINS.`);
      }
      return callback(ApiError.forbidden(`Origin not allowed by CORS: ${origin}`));
    },
  };
}

export default corsOptions;
