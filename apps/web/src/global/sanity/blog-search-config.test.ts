import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getBlogSearchBackend,
  getBlogSearchClientConfig,
  normalizeBlogSearch,
} from './blog-search-config';

afterEach(() => vi.unstubAllEnvs());

describe('blog search configuration', () => {
  it('keeps legacy as the rollout default without requiring dataset credentials', () => {
    vi.stubEnv('SANITY_BLOG_SEARCH_BACKEND', undefined);
    vi.stubEnv('SANITY_API_READ_TOKEN', undefined);
    expect(getBlogSearchBackend()).toBe('legacy');
  });
  it.each(['dataset', 'legacy', 'lexical'] as const)(
    'selects %s explicitly',
    (mode) => {
      vi.stubEnv('SANITY_BLOG_SEARCH_BACKEND', mode);
      expect(getBlogSearchBackend()).toBe(mode);
    },
  );
  it('recovers to lexical for invalid configuration', () => {
    vi.stubEnv('SANITY_BLOG_SEARCH_BACKEND', 'invalid');
    expect(getBlogSearchBackend()).toBe('lexical');
  });
  it('never substitutes a management or public-prefixed credential', () => {
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', 'test');
    vi.stubEnv('SANITY_API_READ_TOKEN', undefined);
    vi.stubEnv('SANITY_AUTH_TOKEN', 'management');
    vi.stubEnv('NEXT_PUBLIC_SANITY_API_READ_TOKEN', 'old-token');
    expect(getBlogSearchClientConfig).toThrow('configuration missing');
    vi.stubEnv('SANITY_API_READ_TOKEN', 'reader');
    expect(getBlogSearchClientConfig()).toMatchObject({
      token: 'reader',
      perspective: 'published',
      useCdn: false,
      maxRetries: 0,
    });
  });
  it.each([undefined, '-1', '0', '1.5', 'Infinity', '9007199254740992'])(
    'normalizes invalid page %s',
    (page) => {
      expect(normalizeBlogSearch('  audio  ', page)).toEqual({
        search: 'audio',
        inputLimited: false,
        page: 1,
      });
    },
  );
  it('bounds oversized input and accepts safe pages', () => {
    expect(normalizeBlogSearch('a'.repeat(300), '5')).toEqual({
      search: 'a'.repeat(256),
      inputLimited: true,
      page: 5,
    });
    expect(normalizeBlogSearch('   ', 1).search).toBe('');
  });
});
