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
