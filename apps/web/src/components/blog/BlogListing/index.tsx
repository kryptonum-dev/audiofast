import { notFound } from 'next/navigation';

import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import { getBlogArticlesQuery } from '@/src/global/sanity/query';
import type { QueryBlogArticlesNewestResult } from '@/src/global/sanity/sanity.types';

import EmptyState from '../../ui/EmptyState';
import Pagination from '../../ui/Pagination';
import PublicationCard from '../../ui/PublicationCard';
import styles from './styles.module.scss';

type BlogListingProps = {
  currentPage: number;
  itemsPerPage: number;
  searchTerm?: string;
  category?: string;
  basePath: string;
  embeddingResults?: Array<{
    score: number;
    value: { documentId: string; type: string };
  }> | null; // Embeddings for semantic search
  sortBy?: string;
};

export default async function BlogListing({
  currentPage,
  itemsPerPage,
  searchTerm = '',
  category = '',
  basePath,
  embeddingResults,
  sortBy = 'newest',
}: BlogListingProps) {
  const offset = (currentPage - 1) * itemsPerPage;
  const limit = offset + itemsPerPage;

  // Get the correct query based on sortBy parameter
  const query = getBlogArticlesQuery(sortBy);

  const articlesData = await sanityFetch<QueryBlogArticlesNewestResult>({
    query,
    params: {
      category: category || '',
      search: searchTerm || '',
      offset,
      limit,
      embeddingResults, // Pass embeddings for filtering
    },
    tags: ['blog-article'],
  });

  if (!articlesData) {
    logWarn('Blog articles data not found');
    notFound();
  }

  const hasArticles = articlesData.articles && articlesData.articles.length > 0;

  // Create URLSearchParams for Pagination
  const urlSearchParams = new URLSearchParams();
  if (searchTerm) urlSearchParams.set('search', searchTerm);

  const ITEMS_PER_ROW = 2;
  const ROW_DELAY = 80; // delay between rows in ms

  return (
    <>
      {!hasArticles ? (
        <EmptyState searchTerm={searchTerm} category={category} type="blog" />
      ) : (
        <>
          <div className={styles.articlesGrid}>
            {articlesData.articles!.map((article, index) => {
              const row = Math.floor(index / ITEMS_PER_ROW);
              const delay = row * ROW_DELAY;

              return (
                <div
                  key={article._id}
                  className={styles.articleItem}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <PublicationCard
                    publication={article}
                    layout="vertical"
                    imageSizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 440px"
                    priority={index === 0}
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </div>
              );
            })}
          </div>
          <Pagination
            totalItems={articlesData.totalCount || 0}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            basePath={basePath}
            searchParams={urlSearchParams}
          />
        </>
      )}
    </>
  );
}
