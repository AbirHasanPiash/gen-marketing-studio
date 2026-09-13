import { describe, expect, it } from 'vitest';
import { TRANSITIONS, adaptForPlatforms, toWhatsApp } from '../backend/src/modules/post/post.service.js';

describe('post lifecycle state machine', () => {
  it('only lets an owner approve, reject or publish', () => {
    for (const action of ['approve', 'reject', 'schedule', 'unschedule', 'publish']) {
      expect(TRANSITIONS[action].roles).toEqual(['OWNER']);
    }
  });

  it('lets a creator submit their own work and archive it', () => {
    expect(TRANSITIONS.submit.roles).toContain('CREATOR');
    expect(TRANSITIONS.archive.roles).toContain('CREATOR');
  });

  it('allows a rejected post to be resubmitted', () => {
    expect(TRANSITIONS.submit.from).toContain('REJECTED');
  });

  it('never allows publishing straight from a draft', () => {
    expect(TRANSITIONS.publish.from).not.toContain('DRAFT');
    expect(TRANSITIONS.publish.from).toEqual(expect.arrayContaining(['APPROVED', 'SCHEDULED']));
  });

  it('cannot archive something mid-publish', () => {
    expect(TRANSITIONS.archive.from).not.toContain('PUBLISHING');
  });

  it('every transition names a reachable target state', () => {
    const states = new Set(Object.values(TRANSITIONS).flatMap((t) => [...t.from, t.to]));
    for (const { to } of Object.values(TRANSITIONS)) expect(states.has(to)).toBe(true);
  });
});

describe('multi-platform adaptation', () => {
  const post = {
    title: 'Three weeks on the loom',
    body: 'Every saree takes two weavers three weeks. #Jamdani #Handloom\n\nBack in stock today.',
    hashtags: ['NokshiThreads'],
    mediaUrls: ['https://example.com/saree.jpg'],
  };

  it('lifts inline hashtags out of the body and merges them with the stored ones', () => {
    const { FACEBOOK, INSTAGRAM } = adaptForPlatforms(post);
    expect(FACEBOOK).not.toContain('#Jamdani\n');
    expect(INSTAGRAM).toContain('#Jamdani');
    expect(INSTAGRAM).toContain('#NokshiThreads');
  });

  it('keeps Facebook to a short hashtag set and gives Instagram the long tail', () => {
    const many = { ...post, hashtags: Array.from({ length: 20 }, (_, i) => `tag${i}`) };
    const { FACEBOOK, INSTAGRAM } = adaptForPlatforms(many);
    expect(FACEBOOK.match(/#tag\d+/g) ?? []).toHaveLength(3);
    expect((INSTAGRAM.match(/#\w+/g) ?? []).length).toBeGreaterThan(3);
  });

  it('survives a post with no body at all', () => {
    expect(() => adaptForPlatforms({ body: '', hashtags: [] })).not.toThrow();
  });
});

describe('WhatsApp export', () => {
  it('bolds the title and produces a shareable wa.me link', () => {
    const { text, waLink } = toWhatsApp({ title: 'Eid drop', body: 'Live now', hashtags: ['Eid'] });
    expect(text).toContain('*Eid drop*');
    expect(waLink.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(waLink.split('text=')[1])).toBe(text);
  });

  it('appends the first image so the recipient gets the visual too', () => {
    const { text } = toWhatsApp({ body: 'hi', mediaUrls: ['https://cdn.example/a.jpg'] });
    expect(text).toContain('https://cdn.example/a.jpg');
  });
});
