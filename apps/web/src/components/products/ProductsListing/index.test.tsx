import { beforeEach, expect, it, vi } from 'vitest';

const { fetchMock, legacyMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  legacyMock: vi.fn(),
}));
vi.mock('@/src/global/sanity/fetch', () => ({ sanityFetch: fetchMock }));
vi.mock('@/src/app/actions/embeddings', () => ({
  fetchEmbeddings: legacyMock,
}));
vi.mock('../../ui/ProductCard', () => ({ default: () => null }));
vi.mock('../../ui/Pagination', () => ({ default: () => null }));
vi.mock('../../ui/EmptyState', () => ({ default: () => null }));
import ProductsListing from './index';

beforeEach(() => {
  fetchMock.mockReset();
  legacyMock.mockReset();
});
it('keeps product search lexical with the same filters and no embedding candidates', async () => {
  fetchMock.mockResolvedValue({ products: [], totalCount: 0 });
  await ProductsListing({
    searchParams: Promise.resolve({
      search: 'Wilson',
      brands: 'wilson',
      minPrice: '100',
    }),
    basePath: '/produkty/',
  });
  expect(legacyMock).not.toHaveBeenCalled();
  const request = fetchMock.mock.calls[0]![0];
  expect(request.params).toMatchObject({
    search: 'Wilson',
    brands: ['wilson'],
    minPrice: 100,
    embeddingResults: [],
  });
  expect(request.query).toContain('name match');
  expect(request.query).not.toContain('semanticSimilarity');
});
