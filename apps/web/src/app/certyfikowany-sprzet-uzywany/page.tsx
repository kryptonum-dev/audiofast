import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import CpoProductsListingInner from '@/src/components/pageBuilder/CpoProductsListing/CpoProductsListingInner';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
} from '@/src/global/sanity/live';
import { queryCpoPage } from '@/src/global/sanity/query';
import type { QueryCpoPageResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

const CPO_BASE_PATH = '/certyfikowany-sprzet-uzywany/';

type CpoSearchParams = {
  page?: string;
  category?: string;
  sortBy?: string | string[];
  search?: string;
  brands?: string | string[];
  minPrice?: string;
  maxPrice?: string;
};

// Shared cached data function: the published page render and the metadata
// read the same entry.
function getCpoPageData(options: DynamicFetchOptions) {
  return sanityFetchCached<QueryCpoPageResult>({
    requestTag: 'cpo.page.content',
    query: queryCpoPage,
    ...options,
  });
}

export async function generateMetadata() {
  const pageData = await getCpoPageData(PUBLISHED);

  if (!pageData) return getSEOMetadata();

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
    noNotIndex: pageData.doNotIndex,
  });
}

export default async function CpoPage({
  searchParams,
}: {
  searchParams: Promise<CpoSearchParams>;
}) {
  // The listing is the only request-time part. It is built here, outside every
  // cache scope, and passed through the cached page as a slot, so the page
  // shell (hero, aside, filter metadata) prerenders.
  const cpoListing = (
    <Suspense fallback={<ProductsListingSkeleton />}>
      <CpoProductsListingInner
        searchParams={searchParams}
        basePath={CPO_BASE_PATH}
        defaultSortBy="newest"
        scrollTargetId="cpo-listing"
      />
    </Suspense>
  );

  return renderDraftAware(CachedCpoPage, { cpoListing });
}

async function CachedCpoPage({
  perspective,
  stega,
  cpoListing,
  isDraft,
}: CachedProps & { cpoListing: ReactNode }) {
  'use cache';
  cacheLife('sanity');
  const pageData = await getCpoPageData({ perspective, stega });

  if (!pageData) {
    notFound();
  }

  const breadcrumbsData = [
    {
      name: pageData.name || 'CPO - Certyfikowany sprzęt używany',
      path: pageData.slug || CPO_BASE_PATH,
    },
  ];

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs
        data={breadcrumbsData}
        firstItemType={pageData.firstBlockType || undefined}
      />
      <PageBuilder
        basePath={pageData.slug || CPO_BASE_PATH}
        pageBuilder={pageData.pageBuilder || []}
        fetchOptions={{ perspective, stega }}
        documentId={pageData._id}
        documentType={pageData._type}
        isDraft={isDraft}
        slots={{ cpoListing }}
      />
    </main>
  );
}
