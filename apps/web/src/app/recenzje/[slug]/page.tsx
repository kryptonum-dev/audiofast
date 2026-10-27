import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';

import { ArticleBody } from '@/src/components/blog/ArticleBody';
import ArticleSchema from '@/src/components/schema/ArticleSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import ProductGallery from '@/src/components/ui/ProductGallery';
import { limitBuildTimeStaticParams } from '@/src/global/build';
import { logWarn } from '@/src/global/logger';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
  sanityFetchStaticParams,
} from '@/src/global/sanity/live';
import {
  queryAllReviewSlugs,
  queryReviewBySlug,
} from '@/src/global/sanity/query';
import type {
  QueryAllReviewSlugsResult,
  QueryReviewBySlugResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type ReviewPageProps = {
  params: Promise<{ slug: string }>;
};

// Shared cached data function: metadata (PUBLISHED) and the published page
// render read the same entry, so the old SEO-only query is gone.
function getReviewData(slug: string, options: DynamicFetchOptions) {
  return sanityFetchCached<QueryReviewBySlugResult>({
    requestTag: 'review.page',
    query: queryReviewBySlug,
    params: { slug: `/recenzje/${slug}/` },
    ...options,
    // Specific tag for this review + broad tag for type
    tags: ['review', `review:${slug}`],
  });
}

export async function generateStaticParams() {
  const reviews = await sanityFetchStaticParams<QueryAllReviewSlugsResult>({
    requestTag: 'review.static-params',
    query: queryAllReviewSlugs,
    tags: ['review'],
  });

  return limitBuildTimeStaticParams(
    reviews
      .filter((review) => review.slug)
      .map((review) => ({
        slug: review.slug!.replace('/recenzje/', '').replace(/\/$/, ''),
      })),
    { slug: '__placeholder__' },
  );
}

export async function generateMetadata(props: ReviewPageProps) {
  const { slug } = await props.params;
  const pageData = await getReviewData(slug, PUBLISHED);

  if (!pageData) {
    logWarn(`Review SEO data not found for slug: ${slug}`);
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
    noNotIndex: pageData.doNotIndex,
  });
}

export default async function ReviewPage(props: ReviewPageProps) {
  const { slug } = await props.params;
  return renderDraftAware(CachedReview, { slug });
}

async function CachedReview({
  slug,
  perspective,
  stega,
}: CachedProps & { slug: string }) {
  'use cache';
  cacheLife('sanity');
  const pageData = await getReviewData(slug, { perspective, stega });

  if (!pageData) {
    logWarn(`Review data not found for slug: ${slug}, returning 404`);
    notFound();
  }

  const breadcrumbsData = [
    {
      name: 'Recenzje',
      path: '/recenzje',
    },
    {
      name: pageData.name!,
      path: pageData.slug!,
    },
  ];

  return (
    <main id="main" className="page-transition">
      <ArticleSchema review={pageData} />
      <Breadcrumbs data={breadcrumbsData} />
      <ArticleBody {...pageData} />
      {pageData.gallery && pageData.gallery.length >= 4 && (
        <ProductGallery
          images={pageData.gallery}
          className="max-width margin-bottom-sm"
        />
      )}
      {pageData.pageBuilder && pageData.pageBuilder.length > 0 && (
        <PageBuilder
          pageBuilder={pageData.pageBuilder}
          indexOffset={1}
          fetchOptions={{ perspective, stega }}
        />
      )}
    </main>
  );
}
