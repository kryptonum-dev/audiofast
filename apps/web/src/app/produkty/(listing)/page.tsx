import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import ProductsAside from '@/src/components/products/ProductsAside';
import ProductsListing from '@/src/components/products/ProductsListing';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/products/ProductsListing/styles.module.scss';
import ProductsListingContainer from '@/src/components/products/ProductsListingContainer';
import { ProductsLoadingProvider } from '@/src/components/products/ProductsLoadingContext';
import SortDropdown from '@/src/components/products/SortDropdown';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import {
  PRODUCT_SORT_OPTIONS,
  RELEVANCE_SORT_OPTION,
} from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { getProductsFilterMetadata } from '@/src/global/products/filter-metadata';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
} from '@/src/global/sanity/live';
import { queryProductsPageContent } from '@/src/global/sanity/query';
import type { QueryProductsPageContentResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type ProductsPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    brands?: string | string[];
    minPrice?: string;
    maxPrice?: string;
  }>;
};

// ----------------------------------------
// Shared cached data function
// ----------------------------------------
// The editorial page content only; the shared filter sidebar data
// (`getProductsFilterMetadata`) is its own cache entry. Metadata reads the
// content with PUBLISHED only, so it no longer pulls the filter metadata along.
function getProductsPageContent(options: DynamicFetchOptions) {
  return sanityFetchCached<QueryProductsPageContentResult>({
    requestTag: 'products.listing.content',
    query: queryProductsPageContent,
    params: { category: '' },
    ...options,
  });
}

// ----------------------------------------
// Metadata Generation
// ----------------------------------------
export async function generateMetadata() {
  const contentData = await getProductsPageContent(PUBLISHED);
  const pageData = contentData?.defaultContent;

  if (!pageData) {
    logWarn('Products page data not found');
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

// ----------------------------------------
// Page Component
// ----------------------------------------
export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  // Pass-through slot (shape B): the searchParams-driven listing is built here,
  // outside every cache scope, and handed to the cached shell untouched, so
  // the shell (hero, sidebar, filter metadata, PageBuilder) prerenders.
  const listing = (
    <Suspense fallback={<ProductsListingSkeleton />}>
      <ProductsListing
        searchParams={searchParams}
        basePath="/produkty/"
        defaultSortBy="priceAsc"
        scrollTargetId="products-listing"
      />
    </Suspense>
  );

  return renderDraftAware(CachedProductsShell, { listing });
}

async function CachedProductsShell({
  perspective,
  stega,
  listing,
  isDraft,
}: CachedProps & { listing: ReactNode }) {
  'use cache';
  cacheLife('sanity');
  const [contentData, filterMetadata] = await Promise.all([
    getProductsPageContent({ perspective, stega }),
    getProductsFilterMetadata(perspective),
  ]);
  const pageData = contentData?.defaultContent;

  if (!pageData || !filterMetadata) {
    logWarn('Products page data not found');
    notFound();
  }

  const breadcrumbsData = [
    {
      name: pageData.name || 'Produkty',
      path: '/produkty/',
    },
  ];

  return (
    <>
      <CollectionPageSchema
        name={pageData.name || 'Produkty'}
        url="/produkty/"
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
        _key=""
        _type="heroStatic"
        button={null}
      />

      <ProductsLoadingProvider>
        <section
          id="products-listing"
          className={`${styles.productsListing} max-width`}
        >
          {/* Client-side computed sidebar - instant filter updates */}
          <ProductsAside
            allProductsMetadata={filterMetadata.products || []}
            allCategories={filterMetadata.categories || []}
            allBrands={filterMetadata.brands || []}
            globalMaxPrice={filterMetadata.globalMaxPrice || 100000}
            basePath="/produkty/"
            currentCategory={null}
            headingLevel="h2"
          />

          {/* Sort dropdown - reads from URL client-side */}
          <SortDropdown
            options={[RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]}
            basePath="/produkty/"
            defaultValue="priceAsc"
          />

          {/* Products listing - container shows overlay skeleton on filter changes */}
          <ProductsListingContainer>{listing}</ProductsListingContainer>
        </section>
      </ProductsLoadingProvider>

      <PageBuilder
        pageBuilder={pageData.pageBuilder || []}
        fetchOptions={{ perspective, stega }}
        documentId={pageData._id}
        documentType={pageData._type}
        isDraft={isDraft}
      />
    </>
  );
}
