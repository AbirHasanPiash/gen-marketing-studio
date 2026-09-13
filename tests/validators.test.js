import { describe, expect, it } from 'vitest';
import {
  httpUrl,
  objectId,
  optionalObjectId,
  pageQuery,
  queryObjectId,
  searchQuery,
} from '../backend/src/utils/validators.js';

describe('objectId', () => {
  it('accepts a 24-char hex id', () => {
    expect(objectId().safeParse('6a8dc3d042f423f797e13a20').success).toBe(true);
  });

  it('rejects the shapes Prisma would answer with an opaque 400', () => {
    for (const bad of ['abc', '', '6a8dc3d042f423f797e13a2', 'zzzzzzzzzzzzzzzzzzzzzzzz']) {
      expect(objectId('brandId').safeParse(bad).success).toBe(false);
    }
  });

  it('names the field it rejected', () => {
    const result = objectId('brandId').safeParse('nope');
    expect(result.error.issues[0].message).toBe('Invalid brandId');
  });
});

describe('optionalObjectId', () => {
  it('turns an empty select value into null instead of a malformed id', () => {
    expect(optionalObjectId().parse('')).toBeNull();
  });

  it('passes null and undefined straight through', () => {
    expect(optionalObjectId().parse(null)).toBeNull();
    expect(optionalObjectId().parse(undefined)).toBeUndefined();
  });
});

describe('queryObjectId', () => {
  it.each(['', 'null', 'undefined'])('treats %s as "no filter"', (value) => {
    expect(queryObjectId().parse(value)).toBeUndefined();
  });

  it('still rejects a real but malformed id', () => {
    expect(queryObjectId().safeParse('not-an-id').success).toBe(false);
  });
});

describe('httpUrl', () => {
  it.each(['https://example.com', 'http://localhost:4000/x?y=1'])('accepts %s', (url) => {
    expect(httpUrl().safeParse(url).success).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>', 'ftp://x.com', 'example.com'])(
    'rejects %s',
    (url) => {
      expect(httpUrl().safeParse(url).success).toBe(false);
    }
  );
});

describe('pageQuery', () => {
  it('coerces strings and applies defaults', () => {
    expect(pageQuery(24, 60).parse({})).toEqual({ page: 1, limit: 24 });
    expect(pageQuery(24, 60).parse({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10 });
  });

  it('refuses a limit above the cap rather than letting a client dump the table', () => {
    expect(pageQuery(24, 60).safeParse({ limit: '5000' }).success).toBe(false);
  });

  it('refuses a zero or negative page', () => {
    expect(pageQuery().safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('searchQuery', () => {
  it('collapses blank input to undefined so no filter is applied', () => {
    expect(searchQuery().parse('   ')).toBeUndefined();
    expect(searchQuery().parse(undefined)).toBeUndefined();
  });

  it('trims what it keeps', () => {
    expect(searchQuery().parse('  saree ')).toBe('saree');
  });
});
