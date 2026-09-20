import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const { search, browse } = vi.hoisted(() => ({
  search: vi.fn(),
  browse: vi.fn(),
}));
vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/src/global/sanity/blog-search', () => ({
  searchBlogArticles: search,
}));
vi.mock('@/src/global/sanity/fetch', () => ({ sanityFetch: browse }));
vi.mock('../../ui/PublicationCard', () => ({
  default: ({ publication }: { publication: { _id: string } }) => (
    <article>{publication._id}</article>
  ),
}));
vi.mock('../../ui/Pagination', () => ({
  default: ({
    totalItems,
    currentPage,
  }: {
    totalItems: number;
    currentPage: number;
  }) => (
    <nav>
      {totalItems}:{currentPage}
    </nav>
  ),
}));
vi.mock('../../ui/EmptyState', () => ({ default: () => <p>Empty</p> }));
import BlogListing from './index';

beforeEach(() => {
  search.mockReset();
  browse.mockReset();
});
it('keeps whitespace on the cached browse path and normalizes page', async () => {
  browse.mockResolvedValue({ articles: [], totalCount: 0 });
  render(
    await BlogListing({
      searchParams: Promise.resolve({ search: '   ', page: '-2' }),
      basePath: '/blog/',
    }),
  );
  expect(search).not.toHaveBeenCalled();
  expect(browse).toHaveBeenCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({ search: '', offset: 0, limit: 12 }),
    }),
  );
  expect(screen.getByText('Empty')).toBeInTheDocument();
});
it('renders the search population and uses its total', async () => {
  search.mockResolvedValue({
    articles: [{ _id: 'result' }],
    totalCount: 13,
    backend: 'dataset',
    outcome: 'success',
  });
  render(
    await BlogListing({
      searchParams: Promise.resolve({
        search: 'audio',
        page: '2',
        year: '2025',
      }),
      category: '/blog/kategoria/porady/',
      basePath: '/blog/',
    }),
  );
  expect(search).toHaveBeenCalledWith({
    search: 'audio',
    page: 2,
    year: '2025',
    category: '/blog/kategoria/porady/',
  });
  expect(browse).not.toHaveBeenCalled();
  expect(screen.getByRole('navigation')).toHaveTextContent('13:2');
  expect(screen.queryByText('dataset')).not.toBeInTheDocument();
});
