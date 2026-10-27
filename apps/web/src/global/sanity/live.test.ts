import { beforeEach, describe, expect, it, vi } from 'vitest';

const { draftModeMock, cookiesMock, resolvePerspectiveMock, liveFetchMock } =
  vi.hoisted(() => ({
    draftModeMock: vi.fn(),
    cookiesMock: vi.fn(),
    resolvePerspectiveMock: vi.fn(),
    liveFetchMock: vi.fn(),
  }));

vi.mock('next/headers', () => ({
  draftMode: draftModeMock,
  cookies: cookiesMock,
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('next-sanity/live', () => ({
  defineLive: vi.fn(() => ({
    sanityFetch: liveFetchMock,
    SanityLive: () => null,
  })),
  resolvePerspectiveFromCookies: resolvePerspectiveMock,
}));

vi.mock('./client', () => ({
  client: {},
  readToken: 'viewer-token',
}));

import { getDynamicFetchOptions, sanityFetch } from './live';

describe('getDynamicFetchOptions', () => {
  beforeEach(() => {
    draftModeMock.mockReset();
    cookiesMock.mockReset();
    resolvePerspectiveMock.mockReset();
  });

  it('returns published + stega off when draft mode is disabled', async () => {
    draftModeMock.mockResolvedValue({ isEnabled: false });

    await expect(getDynamicFetchOptions()).resolves.toEqual({
      perspective: 'published',
      stega: false,
    });
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(resolvePerspectiveMock).not.toHaveBeenCalled();
  });

  it('returns the cookie perspective with stega on in draft mode', async () => {
    const jar = { get: vi.fn() };
    draftModeMock.mockResolvedValue({ isEnabled: true });
    cookiesMock.mockResolvedValue(jar);
    resolvePerspectiveMock.mockResolvedValue(['rABC123', 'drafts']);

    await expect(getDynamicFetchOptions()).resolves.toEqual({
      perspective: ['rABC123', 'drafts'],
      stega: true,
    });
    expect(resolvePerspectiveMock).toHaveBeenCalledWith({ cookies: jar });
  });

  it('falls back to drafts when the perspective cookie is missing', async () => {
    draftModeMock.mockResolvedValue({ isEnabled: true });
    cookiesMock.mockResolvedValue({ get: vi.fn() });
    resolvePerspectiveMock.mockResolvedValue(undefined);

    await expect(getDynamicFetchOptions()).resolves.toEqual({
      perspective: 'drafts',
      stega: true,
    });
  });
});

describe('sanityFetch', () => {
  beforeEach(() => {
    liveFetchMock.mockReset();
  });

  it('minifies the query and passes tags and requestTag through', async () => {
    liveFetchMock.mockResolvedValue({
      data: { title: 'x' },
      sourceMap: null,
      tags: ['product:a', 'sanity:s1:abc'],
    });

    const result = await sanityFetch<{ title: string }>({
      query: `*[_type == "product" && slug.current == $slug][0]{
        title
      }`,
      params: { slug: '/produkty/a/' },
      perspective: 'published',
      stega: false,
      tags: ['product:a'],
      requestTag: 'product.page',
    });

    expect(liveFetchMock).toHaveBeenCalledWith({
      query: '*[_type=="product"&&slug.current==$slug][0]{title}',
      params: { slug: '/produkty/a/' },
      perspective: 'published',
      stega: false,
      tags: ['product:a'],
      requestTag: 'product.page',
    });
    expect(result).toEqual({
      data: { title: 'x' },
      sourceMap: null,
      tags: ['product:a', 'sanity:s1:abc'],
    });
  });
});
