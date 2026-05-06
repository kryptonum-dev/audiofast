import { describe, expect, it } from 'vitest';

import { parseAdminPagination } from './pagination';

describe('parseAdminPagination', () => {
  it('returns default pagination when no params are set', () => {
    expect(parseAdminPagination(new URLSearchParams())).toEqual({
      cursor: null,
      limit: 25,
    });
  });

  it('parses cursor and limit params', () => {
    expect(
      parseAdminPagination(new URLSearchParams('cursor=next-page&limit=50')),
    ).toEqual({
      cursor: 'next-page',
      limit: 50,
    });
  });

  it('clamps invalid and out-of-range limits', () => {
    expect(parseAdminPagination(new URLSearchParams('limit=0')).limit).toBe(1);
    expect(parseAdminPagination(new URLSearchParams('limit=500')).limit).toBe(
      100,
    );
    expect(parseAdminPagination(new URLSearchParams('limit=abc')).limit).toBe(
      25,
    );
  });
});
