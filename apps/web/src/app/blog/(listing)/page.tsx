import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { fetchEmbeddings } from '@/src/app/actions/embeddings';
import BlogListing from '@/src/components/blog/BlogListing';
import BlogListingSkeleton from '@/src/components/blog/BlogListing/BlogListingSkeleton';
import styles from '@/src/components/blog/BlogListing/styles.module.scss';
import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import BlogAside from '@/src/components/ui/BlogAside';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { BLOG_ITEMS_PER_PAGE } from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  getBlogArticlesQuery,
  queryBlogPageData,
} from '@/src/global/sanity/query';
import type { QueryBlogPageDataResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type BlogPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
};

export async function generateMetadata() {
  const blogData = await sanityFetch<QueryBlogPageDataResult>({
    query: queryBlogPageData,
    params: { category: '' },
    tags: ['blog'],
  });

  if (!blogData) {
    logWarn('Blog page data not found');
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: blogData.seo,
    slug: blogData.slug,
    openGraph: blogData.openGraph,
  });
}

export default async function BlogPage(props: BlogPageProps) {
  const searchParams = await props.searchParams;
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || '';
  const hasSearchQuery = Boolean(searchTerm);

  // Fetch embeddings if search query exists (for semantic search)
  // Always return an array (empty if no search) to satisfy GROQ parameter requirements
  const embeddingResults = hasSearchQuery
    ? (await fetchEmbeddings(searchTerm, 'blog')) || []
    : [];

  // Sort by relevance if search is active, otherwise by newest
  const sortBy = hasSearchQuery ? 'relevance' : 'newest';

  const blogData = await sanityFetch<QueryBlogPageDataResult>({
    query: queryBlogPageData,
    params: { category: '', embeddingResults },
    tags: ['blog'],
  });

  if (!blogData) {
    logWarn('Blog layout data not found');
    notFound();
  }

  const breadcrumbsData = [
    {
      name: blogData.name || 'Blog',
      path: '/blog/',
    },
  ];

  return (
    <>
      <CollectionPageSchema
        name={blogData.name || 'Blog'}
        url="/blog/"
        description={blogData.description}
      />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={blogData.title!}
        description={blogData.description!}
        image={blogData.heroImage!}
        showBlocks={false}
        blocksHeading={null}
        blocks={[]}
        index={0}
        _key={''}
        _type={'heroStatic'}
        button={null}
      />
      <section className={`${styles.blogListing} max-width`}>
        <BlogAside
          categories={blogData.categories || []}
          totalCount={blogData.totalCount || 0}
          basePath="/blog/"
          currentCategory={null}
          initialSearch={searchTerm}
        />

        <Suspense
          key={`page-${currentPage}-search-${searchTerm}-sort-${sortBy}`}
          fallback={<BlogListingSkeleton />}
        >
          <BlogListing
            currentPage={currentPage}
            itemsPerPage={BLOG_ITEMS_PER_PAGE}
            searchTerm={searchTerm}
            basePath="/blog/"
            embeddingResults={embeddingResults}
            sortBy={sortBy}
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={blogData.pageBuilder || []} />
    </>
  );
}
