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

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    year?: string;
  }>;
};

// Manually defined type for category content to resolve typegen issues
// We reuse types from defaultContent which shares the same structure
type DefaultContent = NonNullable<QueryBlogPageContentResult['defaultContent']>;

type CategoryContent = {
  _id: string;
  name: string | null;
  slug: string | null;
  title: DefaultContent['title'];
  description: DefaultContent['description'];
  seo: DefaultContent['seo'];
  openGraph: DefaultContent['openGraph'];
  heroImage?: DefaultContent['heroImage'];
};

// Cached static data fetcher for main blog data
async function getStaticBlogData() {
  'use cache';
  cacheTag('blog');
  cacheLife('hours');

  return sanityFetch<QueryBlogPageContentResult>({
    query: queryBlogPageContent,
    params: { category: '' },
    tags: ['blog'],
  });
}

// Cached page content fetcher (handles category-specific content)
async function getPageContent(categorySlug: string) {
  'use cache';
  cacheTag('blog', 'blog-category');
  cacheLife('hours');

  return sanityFetch<QueryBlogPageContentResult>({
    query: queryBlogPageContent,
    params: { category: `/blog/kategoria/${categorySlug}/` },
    tags: ['blog', 'blog-category'],
  });
}

export async function generateStaticParams() {
  const blogData = await getStaticBlogData();

  return (
    blogData?.categories
      ?.filter((cat) => cat.count > 0)
      .map((cat) => ({
        category:
          cat.slug?.replace('/blog/kategoria/', '').replace('/', '') || '',
      })) || []
  );
}

export async function generateMetadata(props: CategoryPageProps) {
  const { category: categorySlug } = await props.params;
  const contentData = await getPageContent(categorySlug);

  // Cast the category content to our manual type
  const categoryContent =
    contentData?.categoryContent as unknown as CategoryContent | null;

  if (!contentData || !categoryContent) {
    logWarn(`Category not found: ${categorySlug}`);
    return getSEOMetadata();
  }

  // Check if category has any articles
  const categoryInfo = contentData.categories?.find(
    (cat) =>
      cat.slug?.replace('/blog/kategoria/', '').replace('/', '') ===
      categorySlug,
  );

  if (!categoryInfo || categoryInfo.count === 0) {
    logWarn(`Category "${categorySlug}" has no articles`);
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: categoryContent.seo,
    slug: categoryContent.slug,
    openGraph: categoryContent.openGraph,
  });
}

export default async function CategoryPage(props: CategoryPageProps) {
  const { category: categorySlug } = await props.params;

  // Fetch all cached static data in parallel
  const [blogData, contentData] = await Promise.all([
    getStaticBlogData(),
    getPageContent(categorySlug),
  ]);

  const defaultContent = blogData?.defaultContent;
  // Cast the category content to our manual type
  const categoryContent =
    contentData?.categoryContent as unknown as CategoryContent | null;

  if (!defaultContent || !blogData) {
    logWarn(`Blog page data not found`);
    notFound();
  }

  if (!categoryContent) {
    logWarn(`Category page data not found for: ${categorySlug}`);
    notFound();
  }

  // Check if category exists and has articles
  const categoryInfo = blogData.categories?.find(
    (cat) =>
      cat.slug?.replace('/blog/kategoria/', '').replace('/', '') ===
      categorySlug,
  );

  if (!categoryInfo || categoryInfo.count === 0) {
    logWarn(`Category "${categorySlug}" not found or has no articles`);
    notFound();
  }

  const breadcrumbsData = [
    {
      name: defaultContent.name || 'Blog',
      path: '/blog/',
    },
    {
      name: categoryContent.name || categorySlug,
      path: categoryContent.slug || `/blog/kategoria/${categorySlug}/`,
    },
  ];

  // Use category's custom title/description if available
  const heroTitle = categoryContent.title || defaultContent.title;
  const heroDescription =
    categoryContent.description || defaultContent.description;
  const heroImage = defaultContent.heroImage;

  return (
    <>
      <CollectionPageSchema
        name={categoryContent.name || categorySlug}
        url={`/blog/kategoria/${categorySlug}/`}
        description={categoryContent.description || defaultContent.description}
      />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={heroTitle!}
        description={heroDescription!}
        image={heroImage}
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
          categories={blogData.categories || []}
          totalCount={blogData.totalCount || 0}
          availableYears={(blogData.availableYears || []).filter(
            (y): y is string => y !== null,
          )}
          basePath={`/blog/kategoria/${categorySlug}/`}
          currentCategory={categorySlug}
        />

        {/* Blog listing in Suspense */}
        <Suspense fallback={<BlogListingSkeleton />}>
          <BlogListing
            searchParams={props.searchParams}
            basePath={`/blog/kategoria/${categorySlug}/`}
            category={`/blog/kategoria/${categorySlug}/`}
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={defaultContent.pageBuilder || []} />
    </>
  );
}
