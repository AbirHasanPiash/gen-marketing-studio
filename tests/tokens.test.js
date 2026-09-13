import { describe, expect, it } from 'vitest';
import {
  signPurposeToken,
  signToken,
  verifyPurposeToken,
  verifyToken,
} from '../backend/src/lib/token.js';

describe('session tokens', () => {
  it('round-trips the subject', () => {
    const token = signToken({ sub: 'user-1', tenantId: 't-1', role: 'OWNER' });
    expect(verifyToken(token)).toMatchObject({ sub: 'user-1', tenantId: 't-1', role: 'OWNER' });
  });

  it('carries no purpose claim, which is what marks it as a credential', () => {
    expect(verifyToken(signToken({ sub: 'user-1' })).purpose).toBeUndefined();
  });

  it('rejects a tampered signature', () => {
    const token = signToken({ sub: 'user-1' });
    expect(() => verifyToken(`${token}x`)).toThrow();
  });
});

describe('single-purpose tokens', () => {
  it('round-trips its payload for the purpose it was issued for', () => {
    const state = signPurposeToken('meta_oauth', { tenantId: 't-1', brandId: 'b-1' });
    expect(verifyPurposeToken('meta_oauth', state)).toMatchObject({ tenantId: 't-1', brandId: 'b-1' });
  });

  it('will not verify under a different purpose', () => {
    const state = signPurposeToken('meta_oauth', { tenantId: 't-1' });
    expect(() => verifyPurposeToken('password_reset', state)).toThrow();
  });

  /*
   * The OAuth `state` travels through Meta's servers and lands in redirect URLs,
   * browser history and referrer headers. `authenticate` refuses any token
   * carrying a `purpose`, so leaking one does not leak a session.
   */
  it('is distinguishable from a session token by the purpose claim alone', () => {
    const state = signPurposeToken('meta_oauth', { tenantId: 't-1', userId: 'user-1' });
    expect(verifyToken(state).purpose).toBe('meta_oauth');
  });

  it('expires quickly by default', () => {
    const { exp, iat } = verifyPurposeToken('meta_oauth', signPurposeToken('meta_oauth', {}));
    expect(exp - iat).toBeLessThanOrEqual(15 * 60);
  });

  it('refuses one that has already expired', () => {
    const expired = signPurposeToken('meta_oauth', {}, '-1s');
    expect(() => verifyPurposeToken('meta_oauth', expired)).toThrow();
  });
});
