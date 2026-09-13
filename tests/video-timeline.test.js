import { describe, expect, it } from 'vitest';
import {
  alignDurations,
  resolveDurations,
  sceneKey,
  validateDurations,
} from '../backend/src/modules/video/video.service.js';

describe('resolveDurations', () => {
  it('uses the stored per-scene timings when they are complete', () => {
    expect(resolveDurations({ images: ['a', 'b'], durations: [3, 7], durationS: 10 })).toEqual([3, 7]);
  });

  it('falls back to an even split for reels saved before per-scene timings existed', () => {
    expect(resolveDurations({ images: ['a', 'b', 'c'], durations: [], durationS: 9 })).toEqual([3, 3, 3]);
  });

  it('ignores a partial or invalid timing array rather than rendering a broken reel', () => {
    expect(resolveDurations({ images: ['a', 'b'], durations: [5], durationS: 10 })).toEqual([5, 5]);
    expect(resolveDurations({ images: ['a', 'b'], durations: [0.1, 9.9], durationS: 10 })).toEqual([5, 5]);
  });

  it('returns nothing for a reel with no scenes', () => {
    expect(resolveDurations({ images: [], durationS: 10 })).toEqual([]);
  });
});

describe('validateDurations', () => {
  it('accepts a float split that cannot sum exactly', () => {
    const thirds = resolveDurations({ images: ['a', 'b', 'c'], durations: [], durationS: 10 });
    expect(validateDurations(thirds, 10).valid).toBe(true);
  });

  it('rejects a timeline that misses the target runtime', () => {
    const check = validateDurations([2, 2], 10);
    expect(check.valid).toBe(false);
    expect(check.delta).toBe(-6);
  });

  it('rejects a scene too short to see', () => {
    const check = validateDurations([9.8, 0.2], 10);
    expect(check.valid).toBe(false);
    expect(check.tooShort).toBe(1);
  });
});

describe('alignDurations', () => {
  it('drops timings for scenes that were removed', () => {
    expect(alignDurations([2, 3, 5], 2, 10)).toEqual([2, 3]);
  });

  it('shares the remaining runtime between newly added scenes', () => {
    expect(alignDurations([6], 2, 10)).toEqual([6, 4]);
  });

  it('never produces a scene below the minimum, even when the reel is over-committed', () => {
    const [, added] = alignDurations([12], 2, 10);
    expect(added).toBeGreaterThanOrEqual(0.5);
  });
});

describe('sceneKey (segment cache address)', () => {
  const scene = { image: 'a.jpg', caption: 'hi', duration: 3, w: 1080, h: 1920, strategy: 'drawtext' };

  it('is stable for an unchanged scene, so the segment is reused', () => {
    expect(sceneKey(scene)).toBe(sceneKey({ ...scene }));
  });

  it.each([
    ['image', { image: 'b.jpg' }],
    ['caption', { caption: 'bye' }],
    ['duration', { duration: 4 }],
    ['frame size', { w: 1080, h: 1080 }],
    ['caption strategy', { strategy: 'cloudinary' }],
  ])('changes when the %s changes, forcing a re-encode', (_label, patch) => {
    expect(sceneKey({ ...scene, ...patch })).not.toBe(sceneKey(scene));
  });
});
