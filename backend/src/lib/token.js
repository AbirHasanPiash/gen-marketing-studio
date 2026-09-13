import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Session token. Deliberately carries no `purpose` claim — `authenticate`
 * rejects anything that does, so a single-purpose token (see below) can never
 * be replayed as a login.
 */
export const signToken = (payload) =>
  jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwt.secret);

/**
 * Short-lived, single-purpose token — currently the Meta OAuth `state`.
 *
 * That value travels through Meta's servers and ends up in redirect URLs,
 * browser history and referrer headers, so it must not be usable as a bearer
 * token. Tagging it with `purpose` does that: `authenticate` refuses purposed
 * tokens, and `verifyPurposeToken` refuses anything tagged differently.
 */
export const signPurposeToken = (purpose, payload, expiresIn = '15m') =>
  jwt.sign({ ...payload, purpose }, env.jwt.secret, { expiresIn });

export function verifyPurposeToken(purpose, token) {
  const payload = jwt.verify(token, env.jwt.secret);
  if (payload.purpose !== purpose) throw new Error(`Expected a ${purpose} token`);
  return payload;
}
