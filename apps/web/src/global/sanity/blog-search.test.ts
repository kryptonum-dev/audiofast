import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock, createClientMock, legacyMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  createClientMock: vi.fn(),
  legacyMock: vi.fn(),
}));
vi.mock('@sanity/client', () => ({ createClient: createClientMock }));
vi.mock('@/src/app/actions/embeddings', () => ({
  fetchEmbeddings: legacyMock,
}));
import { searchBlogArticles } from './blog-search';
import { queryBlogLexicalSearch, queryBlogSemanticSearch } from './query';

const article = (i: number) => ({
  _id: `article-${String(i).padStart(3, '0')}`,
  _type: 'blog-article',
  _createdAt: '2026-01-01T00:00:00Z',
  slug: `/blog/article-${i}/`,
  title: [],
  _score: 0,
});
const articles = (n: number) => Array.from({ length: n }, (_, i) => article(i));

beforeEach(() => {
  vi.stubEnv('SANITY_BLOG_SEARCH_BACKEND', 'dataset');
  vi.stubEnv('SANITY_API_READ_TOKEN', 'reader');
  vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', 'test');
  fetchMock.mockReset();
  legacyMock.mockReset();
  createClientMock.mockReset();
  createClientMock.mockReturnValue({ fetch: fetchMock });
});
afterEach(() => vi.unstubAllEnvs());

describe('bounded blog search', () => {
  it('does not query on blank input', async () => {
    expect((await searchBlogArticles({ search: '   ' })).outcome).toBe(
      'browse',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([1, 12, 13, 50])(
    'pages one population of %i cards',
    async (count) => {
      fetchMock.mockResolvedValue(articles(count));
      const first = await searchBlogArticles({ search: 'audio', page: 1 });
      const second = await searchBlogArticles({ search: 'audio', page: 2 });
      expect(first.totalCount).toBe(count);
      expect(first.articles).toHaveLength(Math.min(12, count));
      expect(second.articles).toEqual(articles(count).slice(12, 24));
      expect(
        new Set([...first.articles, ...second.articles].map((a) => a._id)).size,
      ).toBe(Math.min(24, count));
    },
  );
  it('does not fallback for out-of-range pages', async () => {
    fetchMock.mockResolvedValue(articles(13));
    expect(
      await searchBlogArticles({
        search: 'audio',
        page: Number.MAX_SAFE_INTEGER,
      }),
    ).toMatchObject({ articles: [], totalCount: 13, backend: 'dataset' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('falls back only for genuinely empty candidates', async () => {
    fetchMock.mockResolvedValueOnce([]).mockResolvedValueOnce(articles(1));
    expect(await searchBlogArticles({ search: 'audio' })).toMatchObject({
      totalCount: 1,
      backend: 'lexical',
      outcome: 'empty',
    });
    expect(fetchMock.mock.calls[1]![0]).toBe(queryBlogLexicalSearch);
  });
  it.each([401, 429, 500, 'timeout'])(
    'recovers once from %s with no semantic retry',
    async (failure) => {
      fetchMock
        .mockRejectedValueOnce({ statusCode: failure })
        .mockResolvedValueOnce([]);
      expect(await searchBlogArticles({ search: 'audio' })).toMatchObject({
        totalCount: 0,
        backend: 'lexical',
        outcome: 'unavailable',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(createClientMock).toHaveBeenCalledWith(
        expect.objectContaining({
          useCdn: false,
          perspective: 'published',
          maxRetries: 0,
          token: 'reader',
        }),
      );
      expect(fetchMock.mock.calls[0]![2]).toMatchObject({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      });
      expect(legacyMock).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    {},
    articles(51),
    [article(0), article(0)],
    [{ ...article(0), _id: 'drafts.secret' }],
    [{ ...article(0), title: [{}] }],
    [{ ...article(0), _type: 'product' }],
  ])('recovers from malformed/private response %#', async (response) => {
    fetchMock.mockResolvedValueOnce(response).mockResolvedValueOnce([]);
    expect((await searchBlogArticles({ search: 'audio' })).outcome).toBe(
      'unavailable',
    );
  });
  it('keeps zero and negative scores instead of inventing a threshold', async () => {
    fetchMock.mockResolvedValue([
      { ...article(0), _score: 0 },
      { ...article(1), _score: -1 },
    ]);
    expect((await searchBlogArticles({ search: 'soup' })).totalCount).toBe(2);
  });
  it('uses lexical mode directly for oversized input', async () => {
    fetchMock.mockResolvedValue([]);
    expect(
      (await searchBlogArticles({ search: 'a'.repeat(300) })).outcome,
    ).toBe('input-limit');
    expect(fetchMock.mock.calls[0]![0]).toBe(queryBlogLexicalSearch);
    expect(fetchMock.mock.calls[0]![1].search).toHaveLength(256);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('reports both failures without exposing an upstream body', async () => {
    fetchMock.mockRejectedValue(new Error('upstream secret'));
    await expect(searchBlogArticles({ search: 'audio' })).rejects.toThrow(
      'Blog search is temporarily unavailable',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('fails safely with missing read configuration', async () => {
    vi.stubEnv('SANITY_API_READ_TOKEN', undefined);
    await expect(searchBlogArticles({ search: 'audio' })).rejects.toThrow(
      'temporarily unavailable',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('supports explicit legacy rollback and keeps post-filter empty results', async () => {
    vi.stubEnv('SANITY_BLOG_SEARCH_BACKEND', 'legacy');
    legacyMock.mockResolvedValue([
      { score: 1, value: { documentId: 'article-000', type: 'blog-article' } },
    ]);
    fetchMock.mockResolvedValue({ articles: [] });
    expect(await searchBlogArticles({ search: 'audio' })).toMatchObject({
      backend: 'legacy',
      totalCount: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('makes eligibility and deterministic ordering precede the bounded projection', () => {
    const score = queryBlogSemanticSearch.indexOf('| score(');
    const slice = queryBlogSemanticSearch.indexOf('[0...50]');
    expect(
      queryBlogSemanticSearch.indexOf('hideFromList == false'),
    ).toBeLessThan(score);
    expect(queryBlogSemanticSearch.indexOf('$category')).toBeLessThan(score);
    expect(queryBlogSemanticSearch.indexOf('$year')).toBeLessThan(score);
    expect(
      queryBlogSemanticSearch.indexOf('order(_score desc, _id asc)'),
    ).toBeLessThan(slice);
    expect(queryBlogSemanticSearch).not.toMatch(/_score\s*[><=]/);
  });
});

it('filters a >50 corpus before slicing, excluding hidden, missing-slug and unpublished documents', async () => {
  const { parse, evaluate } = await import('groq-js');
  const dataset = [
    {
      _id: 'category',
      _type: 'blog-category',
      slug: { current: '/selected/' },
    },
    ...Array.from({ length: 70 }, (_, i) => ({
      ...article(i),
      name: 'audio',
      slug: { current: `/blog/${i}/` },
      hideFromList: false,
      category: { _ref: 'category' },
      publishedDate: '2025-01-01',
    })),
    {
      ...article(71),
      name: 'audio',
      slug: { current: '/hidden/' },
      hideFromList: true,
      category: { _ref: 'category' },
      publishedDate: '2025-01-01',
    },
    {
      ...article(72),
      name: 'audio',
      slug: null,
      hideFromList: false,
      category: { _ref: 'category' },
      publishedDate: '2025-01-01',
    },
    {
      ...article(73),
      _id: 'drafts.article',
      name: 'audio',
      slug: { current: '/draft/' },
      hideFromList: false,
      category: { _ref: 'category' },
      publishedDate: '2025-01-01',
    },
  ];
  // groq-js has no embeddings model. Equal fixed scores test the real filter/order/slice pipeline.
  const query = queryBlogSemanticSearch.replace(
    'text::semanticSimilarity($search)',
    'boost(true, 1)',
  );
  const result = await (
    await evaluate(parse(query), {
      dataset,
      params: { search: 'audio', category: '/selected/', year: '2025' },
    })
  ).get();
  expect(result).toHaveLength(50);
  expect(result.map((a: { _id: string }) => a._id)).toEqual(
    articles(50).map((a) => a._id),
  );
  const wrongYear = await (
    await evaluate(parse(query), {
      dataset,
      params: { search: 'audio', category: '/selected/', year: '2024' },
    })
  ).get();
  expect(wrongYear).toEqual([]);
});
