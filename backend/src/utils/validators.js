import { z } from 'zod';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * A Mongo ObjectId string. Prisma rejects anything that isn't 24 hex chars
 * with a P2023 ("Malformed ObjectID") that surfaces as an opaque 400, so we
 * check the shape here and return a real field-level message instead.
 */
export const objectId = (label = 'id') => z.string().regex(OBJECT_ID, `Invalid ${label}`);

/**
 * An optional relation id. Selects and blank form fields submit '' for "none",
 * which is *not* a valid ObjectId — normalise it to null before it reaches Prisma.
 */
export const optionalObjectId = (label = 'id') =>
  z.preprocess((v) => (v === '' ? null : v), objectId(label).nullish());

/**
 * A filter id read from the query string. '' and 'null' both mean "no filter",
 * which is what an unset `?brandId=` looks like once the client interpolates an
 * empty value — treat it as absent instead of handing Prisma a broken id.
 */
export const queryObjectId = (label = 'id') =>
  z.preprocess(
    (v) => (v === '' || v === 'null' || v === 'undefined' ? undefined : v),
    objectId(label).optional()
  );

/** `?page` / `?limit`, coerced and bounded. */
export const pageQuery = (defaultLimit = 20, maxLimit = 100) =>
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
  });

/** Trimmed free-text search, collapsed to undefined when blank. */
export const searchQuery = (max = 120) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined), z.string().max(max).optional());

const parsesAsUrl = (v) => {
  try {
    return Boolean(new URL(v));
  } catch {
    return false;
  }
};

/** An http(s) URL. Rejects `javascript:`, `data:` and friends. */
export const httpUrl = (label = 'URL') =>
  z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((v) => /^https?:\/\//i.test(v) && parsesAsUrl(v), `${label} must start with http:// or https://`);

export const POST_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED',
  'REJECTED',
  'ARCHIVED',
];

export const JOB_STATUSES = ['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING', 'CANCELLED'];
