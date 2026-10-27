import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';

import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { limitBuildTimeStaticParams } from '@/src/global/build';
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
import { queryAllPageSlugs, queryPageBySlug } from '@/src/global/sanity/query';
import type { QueryPageBySlugResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const pages = await sanityFetchStaticParams<{ slug: string | null }[]>({
    requestTag: 'page.static-params',
    query: queryAllPageSlugs,
    tags: ['page'],
  });

  return limitBuildTimeStaticParams(
    pages
      .filter((page): page is { slug: string } => Boolean(page.slug))
      .map((page) => ({
        slug: page.slug.replace(/^\//, '').replace(/\/$/, ''),
      })),
    { slug: '__placeholder__' },
  );
}

// Shared cached data function: metadata (PUBLISHED) and the published page
// render read the same entry, so the old SEO-only query is gone.
function getPageData(slug: string, options: DynamicFetchOptions) {
  const sanitySlug = `/${slug.replace(/^\/+/, '').replace(/\/+$/, '')}/`;

  return sanityFetchCached<QueryPageBySlugResult>({
    requestTag: 'page.content',
    query: queryPageBySlug,
    params: { slug: sanitySlug },
    ...options,
    // Only slug-specific tag — no broad 'page' tag to avoid invalidating all CMS pages
    tags: [`page:${slug}`],
  });
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const pageData = await getPageData(slug, PUBLISHED);

  if (!pageData) return getSEOMetadata();

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
    noNotIndex: pageData.doNotIndex,
  });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return renderDraftAware(CachedPage, { slug });
}

async function CachedPage({
  slug,
  perspective,
  stega,
  isDraft,
}: CachedProps & { slug: string }) {
  'use cache';
  cacheLife('sanity');
  const pageData = await getPageData(slug, { perspective, stega });

  if (!pageData) {
    notFound();
  }

  // Build breadcrumbs data from page data
  const breadcrumbsData = [
    {
      name: pageData.name || 'Strona',
      path: pageData.slug || `/${slug}`,
    },
  ];

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs
        data={breadcrumbsData}
        firstItemType={pageData.firstBlockType || undefined}
      />
      <PageBuilder
        basePath={pageData.slug || '/'}
        pageBuilder={pageData.pageBuilder || []}
        fetchOptions={{ perspective, stega }}
        documentId={pageData._id}
        documentType={pageData._type}
        isDraft={isDraft}
      />
    </main>
  );
}
