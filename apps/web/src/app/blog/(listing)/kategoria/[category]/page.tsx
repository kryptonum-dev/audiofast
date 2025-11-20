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
import { queryBlogPageData } from '@/src/global/sanity/query';
import type { QueryBlogPageDataResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
};

export async function generateStaticParams() {
  // Fetch all categories for static generation
  const blogData = await sanityFetch<QueryBlogPageDataResult>({
    query: queryBlogPageData,
    params: { category: '' },
    tags: ['blog-category'],
  });

  // Only generate static pages for categories that have articles
  return (
    blogData?.categories
      ?.filter((cat) => cat.count > 0)
      .map((cat) => ({
        category: cat.slug?.replace('/blog/', '').replace('/', '') || '',
      })) || []
  );
}

export async function generateMetadata(props: CategoryPageProps) {
  const params = await props.params;
  const categorySlug = params.category;

  const blogData = await sanityFetch<QueryBlogPageDataResult>({
    query: queryBlogPageData,
    params: { category: `/blog/${categorySlug}/` },
    tags: ['blog-category'],
  });

  if (!blogData || !blogData.selectedCategory) {
    logWarn(`Category not found: ${categorySlug}`);
    return getSEOMetadata();
  }

  // Check if category has any articles
  const categoryInfo = blogData.categories?.find(
    (cat) => cat.slug?.replace('/blog/', '').replace('/', '') === categorySlug
  );

  if (!categoryInfo || categoryInfo.count === 0) {
    logWarn(`Category "${categorySlug}" has no articles`);
    return getSEOMetadata();
  }

  const category = blogData.selectedCategory;

  return getSEOMetadata({
    seo: category.seo,
    slug: category.slug,
    openGraph: category.openGraph,
  });
}

export default async function CategoryPage(props: CategoryPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const currentPage = Number(searchParams.page) || 1;
  const searchTerm = searchParams.search || '';
  const hasSearchQuery = Boolean(searchTerm);
  const categorySlug = params.category;

  // Fetch embeddings if search query exists (for semantic search)
  // Always return an array (empty if no search) to satisfy GROQ parameter requirements
  const embeddingResults = hasSearchQuery
    ? (await fetchEmbeddings(searchTerm, 'blog')) || []
    : [];

  // Sort by relevance if search is active, otherwise by newest
  const sortBy = hasSearchQuery ? 'relevance' : 'newest';

  const blogData = await sanityFetch<QueryBlogPageDataResult>({
    query: queryBlogPageData,
    params: { category: `/blog/${categorySlug}/`, embeddingResults },
    tags: ['blog-category'],
  });

  if (!blogData || !blogData.selectedCategory) {
    logWarn(`Category page data not found for: ${categorySlug}, returning 404`);
    notFound();
  }

  const category = blogData.selectedCategory;

  // Check if category has any articles
  const categoryInfo = blogData.categories?.find(
    (cat) => cat.slug?.replace('/blog/', '').replace('/', '') === categorySlug
  );

  if (!categoryInfo || categoryInfo.count === 0) {
    logWarn(`Category "${categorySlug}" has no articles, returning 404`);
    notFound();
  }

  const breadcrumbsData = [
    {
      name: blogData.name || 'Blog',
      path: '/blog/',
    },
    {
      name: category.name || categorySlug,
      path: category.slug || `/blog/kategoria/${categorySlug}/`,
    },
  ];

  // Use category's custom title/description if available, otherwise fall back to main blog data
  const heroTitle = category.title || blogData.title;
  const heroDescription = category.description || blogData.description;
  const heroImage = blogData.heroImage;

  return (
    <>
      <CollectionPageSchema
        name={category.name || categorySlug}
        url={`/blog/kategoria/${categorySlug}/`}
        description={category.description || blogData.description}
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
        <BlogAside
          categories={blogData.categories || []}
          totalCount={blogData.totalCount || 0}
          basePath={`/blog/kategoria/${categorySlug}/`}
          currentCategory={categorySlug}
          initialSearch={searchTerm}
        />
        <Suspense
          key={`category-${categorySlug}-page-${currentPage}-search-${searchTerm}-sort-${sortBy}`}
          fallback={<BlogListingSkeleton />}
        >
          <BlogListing
            currentPage={currentPage}
            itemsPerPage={BLOG_ITEMS_PER_PAGE}
            searchTerm={searchTerm}
            category={`/blog/${categorySlug}/`}
            basePath={`/blog/kategoria/${categorySlug}/`}
            embeddingResults={embeddingResults}
            sortBy={sortBy}
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={blogData.pageBuilder || []} />
    </>
  );
}
