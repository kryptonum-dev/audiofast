import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import BlogAside from '@/src/components/ui/BlogAside';
import BlogListing from '@/src/components/ui/BlogListing';
import BlogListingSkeleton from '@/src/components/ui/BlogListing/BlogListingSkeleton';
import styles from '@/src/components/ui/BlogListing/styles.module.scss';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { BLOG_ITEMS_PER_PAGE } from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import { queryBlogPageData } from '@/src/global/sanity/query';
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

  const blogData = await sanityFetch<QueryBlogPageDataResult>({
    query: queryBlogPageData,
    params: { category: '' },
    tags: ['blog', 'blog-category'],
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
        />
        <Suspense
          key={`page-${currentPage}-search-${searchTerm}`}
          fallback={<BlogListingSkeleton />}
        >
          <BlogListing
            currentPage={currentPage}
            itemsPerPage={BLOG_ITEMS_PER_PAGE}
            searchTerm={searchTerm}
            basePath="/blog/"
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={blogData.pageBuilder || []} />
    </>
  );
}
