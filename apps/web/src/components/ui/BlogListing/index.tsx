import { notFound } from 'next/navigation';

import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import { queryBlogArticles } from '@/src/global/sanity/query';
import type { QueryBlogArticlesResult } from '@/src/global/sanity/sanity.types';

import Pagination from '../Pagination';
import PublicationCard from '../PublicationCard';
import EmptyState from './EmptyState';
import styles from './styles.module.scss';

type BlogListingProps = {
  currentPage: number;
  itemsPerPage: number;
  searchTerm?: string;
  category?: string;
  basePath: string;
};

export default async function BlogListing({
  currentPage,
  itemsPerPage,
  searchTerm = '',
  category = '',
  basePath,
}: BlogListingProps) {
  const offset = (currentPage - 1) * itemsPerPage;
  const limit = offset + itemsPerPage;

  const articlesData = await sanityFetch<QueryBlogArticlesResult>({
    query: queryBlogArticles,
    params: {
      category: category || '',
      search: searchTerm || '',
      offset,
      limit,
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

  return (
    <>
      {!hasArticles ? (
        <EmptyState searchTerm={searchTerm} category={category} />
      ) : (
        <>
          <div className={styles.articlesGrid}>
            {articlesData.articles!.map((article, index) => (
              <div
                key={article._id}
                className={styles.articleItem}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <PublicationCard
                  publication={article}
                  layout="vertical"
                  imageSizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 440px"
                  priority={index === 0}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
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
