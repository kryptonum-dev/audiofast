import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import BlogListing from '@/src/components/blog/BlogListing';
import BlogListingSkeleton from '@/src/components/blog/BlogListing/BlogListingSkeleton';
import styles from '@/src/components/blog/BlogListing/styles.module.scss';
import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import BlogAside from '@/src/components/ui/BlogAside';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryBlogPageContent } from '@/src/global/sanity/query';
import type { QueryBlogPageContentResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type BlogPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    year?: string;
  }>;
};

// Cached static data fetcher
async function getStaticPageData() {
  'use cache';
  cacheTag('blog');
  cacheLife('weeks');

  return sanityFetch<QueryBlogPageContentResult>({
    query: queryBlogPageContent,
    params: { category: '' },
    tags: ['blog'],
  });
}

export async function generateMetadata() {
  const contentData = await getStaticPageData();
  const pageData = contentData?.defaultContent;

  if (!pageData) {
    logWarn('Blog page data not found');
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  // Fetch cached static data (instant after first load)
  const contentData = await getStaticPageData();
  const pageData = contentData?.defaultContent;

  if (!pageData || !contentData) {
    logWarn('Blog page data not found');
    notFound();
  }

  const breadcrumbsData = [
    {
      name: pageData.name || 'Blog',
      path: '/blog/',
    },
  ];

  return (
    <>
      <CollectionPageSchema
        name={pageData.name || 'Blog'}
        url="/blog/"
        description={pageData.description}
      />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={pageData.title!}
        description={pageData.description!}
        image={pageData.heroImage!}
        showBlocks={false}
        blocksHeading={null}
        blocks={[]}
        index={0}
        _key={''}
        _type={'heroStatic'}
        button={null}
      />
      <section className={`${styles.blogListing} max-width`}>
        {/* Static sidebar with year filter */}
        <BlogAside
          categories={contentData.categories || []}
          totalCount={contentData.totalCount || 0}
          availableYears={(contentData.availableYears || []).filter(
            (y): y is string => y !== null,
          )}
          basePath="/blog/"
          currentCategory={null}
        />

        {/* Blog listing in Suspense - only this shows skeleton */}
        <Suspense fallback={<BlogListingSkeleton />}>
          <BlogListing searchParams={searchParams} basePath="/blog/" />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={pageData.pageBuilder || []} />
    </>
  );
}
