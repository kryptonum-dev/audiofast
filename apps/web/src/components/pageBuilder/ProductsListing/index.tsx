import { cacheLife } from 'next/cache';
import { Suspense } from 'react';

import type { PageBuilderBlock } from '@/src/components/shared/PageBuilder';
import { PRODUCT_SORT_OPTIONS } from '@/src/global/constants';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryAllProductsFilterMetadata } from '@/src/global/sanity/query';
import type { QueryAllProductsFilterMetadataResult } from '@/src/global/sanity/sanity.types';

import ProductsAside from '../../products/ProductsAside';
import ProductsListingComponent from '../../products/ProductsListing';
import ProductsListingSkeleton from '../../products/ProductsListing/ProductsListingSkeleton';
import styles from '../../products/ProductsListing/styles.module.scss';
import SortDropdown from '../../products/SortDropdown';

type ProductsListingBlockType = Extract<
  PageBuilderBlock,
  { _type: 'productsListing' }
>;

type ProductsListingProps = ProductsListingBlockType & {
  index: number;
  searchParams?: {
    page?: string;
    category?: string;
    sortBy?: string | string[];
  };
  basePath?: string;
};

// ----------------------------------------
// Cached Static Data Fetcher
// ----------------------------------------
async function getStaticFilterMetadata() {
  'use cache';
  cacheLife('weeks');

  return sanityFetch<QueryAllProductsFilterMetadataResult>({
    query: queryAllProductsFilterMetadata,
    tags: ['products'],
  });
}

export default async function ProductsListing(props: ProductsListingProps) {
  const { heading, cpoOnly, searchParams, basePath = '/' } = props;

  // Fetch filter metadata (cached)
  const filterMetadata = await getStaticFilterMetadata();

  if (!filterMetadata) {
    return null;
  }

  // For CPO-only listings, filter products metadata
  const productsMetadata = cpoOnly
    ? filterMetadata.products?.filter((p) => p.isCPO === true) || []
    : filterMetadata.products || [];

  // Don't render if no products available
  if (productsMetadata.length === 0) {
    return null;
  }

  // Calculate max price from filtered products
  const prices = productsMetadata
    .map((p) => p.basePriceCents)
    .filter((p): p is number => p !== null && p !== undefined);
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 100000;

  // Convert searchParams to Promise for ProductsListingComponent
  // (PageBuilder already awaited it, so we wrap it back)
  // Normalize sortBy to string (it can be string[] from Next.js)
  const normalizedParams = {
    ...searchParams,
    sortBy: Array.isArray(searchParams?.sortBy)
      ? searchParams.sortBy[0]
      : searchParams?.sortBy,
  };
  const searchParamsPromise = Promise.resolve(normalizedParams);

  return (
    <section className={`${styles.productsListing} max-width`}>
      {/* Client-side computed sidebar */}
      <ProductsAside
        allProductsMetadata={productsMetadata}
        allCategories={filterMetadata.categories || []}
        allBrands={filterMetadata.brands || []}
        globalMaxPrice={maxPrice}
        basePath={basePath}
        heading={heading}
        visibleFilters={{
          search: false,
          categories: true,
          brands: false,
          priceRange: false,
        }}
        headingLevel="h3"
      />

      <SortDropdown
        options={PRODUCT_SORT_OPTIONS}
        basePath={basePath}
        defaultValue="newest"
      />

      {/* Products listing in Suspense */}
      <Suspense fallback={<ProductsListingSkeleton />}>
        <ProductsListingComponent
          searchParams={searchParamsPromise}
          basePath={basePath}
          isCPO={cpoOnly}
          defaultSortBy="newest"
        />
      </Suspense>
    </section>
  );
}
