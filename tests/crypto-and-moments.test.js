import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../backend/src/lib/crypto.js';
import { normalizePrompt, sha256 } from '../backend/src/utils/hash.js';
import { LOCAL_MOMENTS, getMoment, nextOccurrence, upcomingMoments } from '../backend/src/data/localMoments.js';
import { toSlug } from '../backend/src/utils/slug.js';

describe('token encryption at rest', () => {
  it('round-trips a Meta access token', () => {
    const token = 'EAAG-some-long-page-token';
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'));
  });

  it('leaves an unencrypted legacy value readable instead of destroying it', () => {
    expect(decrypt('plain-legacy-token')).toBe('plain-legacy-token');
  });

  it('passes null through unchanged', () => {
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });
});

describe('prompt cache key', () => {
  it('ignores case and whitespace so near-identical prompts share a cache entry', () => {
    expect(sha256(normalizePrompt('A  Red   Saree '))).toBe(sha256(normalizePrompt('a red saree')));
  });

  it('still separates genuinely different prompts', () => {
    expect(sha256(normalizePrompt('a red saree'))).not.toBe(sha256(normalizePrompt('a blue saree')));
  });
});

describe('local moments dataset', () => {
  it('has a unique key per moment', () => {
    const keys = LOCAL_MOMENTS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every moment the fields the suggester reads', () => {
    for (const m of LOCAL_MOMENTS) {
      expect(m).toMatchObject({
        key: expect.any(String),
        name: expect.any(String),
        month: expect.any(Number),
        day: expect.any(Number),
        sampleAngle: expect.any(String),
      });
      expect(m.colors.length).toBeGreaterThan(0);
      expect(m.themes.length).toBeGreaterThan(0);
    }
  });

  it('rolls a passed date into next year rather than returning the past', () => {
    const from = new Date('2026-06-01T00:00:00Z');
    expect(nextOccurrence(2, 21, from).getFullYear()).toBe(2027);
    expect(nextOccurrence(12, 16, from).getFullYear()).toBe(2026);
  });

  it('returns upcoming moments nearest-first and inside the window', () => {
    const upcoming = upcomingMoments(new Date('2026-02-01T00:00:00Z'), 30);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.every((m) => m.inDays <= 30)).toBe(true);
    expect([...upcoming].sort((a, b) => a.inDays - b.inDays)).toEqual(upcoming);
  });

  it('looks a moment up by key', () => {
    expect(getMoment('pohela-boishakh')?.name).toBe('Pohela Boishakh');
    expect(getMoment('nope')).toBeUndefined();
  });
});

describe('slugs', () => {
  it('lowercases and strips punctuation', () => {
    expect(toSlug('Nokshi Threads!')).toBe('nokshi-threads');
  });

  it('never returns an empty slug', () => {
    expect(toSlug('   ')).toBe('item');
    expect(toSlug('')).toBe('item');
  });
});
