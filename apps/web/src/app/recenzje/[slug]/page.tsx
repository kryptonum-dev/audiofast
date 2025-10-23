import { notFound } from 'next/navigation';

import { ArticleBody } from '@/src/components/shared/ArticleBody';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import ProductGallery from '@/src/components/ui/ProductGallery';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
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

async function fetchReviewData(slug: string) {
  return await sanityFetch<QueryReviewBySlugResult>({
    query: queryReviewBySlug,
    params: { slug: `/recenzje/${slug}/` },
    tags: ['review', slug],
  });
}

export async function generateStaticParams() {
  const reviews = await sanityFetch<QueryAllReviewSlugsResult>({
    query: queryAllReviewSlugs,
    tags: ['review'],
  });

  return reviews.map((review) => ({
    slug: review.slug!.replace('/recenzje/', '').replace(/\/$/, ''),
  }));
}

export async function generateMetadata(props: ReviewPageProps) {
  const { slug } = await props.params;
  const pageData = await fetchReviewData(slug);

  if (!pageData) {
    logWarn(`Review data not found for slug: ${slug}`);
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

export default async function ReviewPage(props: ReviewPageProps) {
  const { slug } = await props.params;

  const pageData = await fetchReviewData(slug);

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
      <Breadcrumbs data={breadcrumbsData} />
      <ArticleBody {...pageData} />
      {pageData.gallery && pageData.gallery.length >= 4 && (
        <ProductGallery
          images={pageData.gallery}
          className="max-width margin-bottom-sm"
        />
      )}
      {pageData.pageBuilder && pageData.pageBuilder.length > 0 && (
        <PageBuilder pageBuilder={pageData.pageBuilder} />
      )}
    </main>
  );
}
