import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { searchBlogArticles } from '@/src/global/sanity/blog-search';
import { normalizeBlogSearch } from '@/src/global/sanity/blog-search-config';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { getBlogArticlesQuery } from '@/src/global/sanity/query';
import type { QueryBlogArticlesNewestResult } from '@/src/global/sanity/sanity.types';
import { BLOG_ITEMS_PER_PAGE } from '@/src/global/constants';

import EmptyState from '../../ui/EmptyState';
import Pagination from '../../ui/Pagination';
import PublicationCard from '../../ui/PublicationCard';
import styles from './styles.module.scss';

type SearchParamsType = {
  page?: string;
  search?: string;
  year?: string;
};

type BlogListingProps = {
  searchParams: Promise<SearchParamsType>;
  basePath: string;
  category?: string;
};

export default async function BlogListing({
  searchParams,
  basePath,
  category = '',
}: BlogListingProps) {
  const params = await searchParams;

  const normalized = normalizeBlogSearch(params.search, params.page);
  const currentPage = normalized.page;
  const itemsPerPage = BLOG_ITEMS_PER_PAGE;
  const searchTerm = params.search || '';
  const year = params.year || '';
  const offset = (currentPage - 1) * itemsPerPage;

  // Prevent prerender probes from entering the timed remote-search/fallback path.
  if (normalized.search) await connection();

  const articlesData = normalized.search
    ? await searchBlogArticles({
        search: searchTerm,
        page: currentPage,
        category,
        year,
      })
    : await sanityFetch<QueryBlogArticlesNewestResult>({
        query: getBlogArticlesQuery('newest'),
        params: {
          category,
          search: '',
          year,
          offset,
          limit: offset + itemsPerPage,
          embeddingResults: [],
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
  if (year) urlSearchParams.set('year', year);

  const ITEMS_PER_ROW = 2;
  const ROW_DELAY = 80; // delay between rows in ms

  return (
    <>
      {!hasArticles ? (
        <EmptyState
          searchTerm={searchTerm}
          category={category}
          year={year}
          type="blog"
        />
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
                    headingLevel="h2"
                    publication={article}
                    layout="vertical"
                    imageFit="contain"
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
