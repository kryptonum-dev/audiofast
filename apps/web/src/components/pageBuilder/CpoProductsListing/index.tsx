import { cacheLife, cacheTag } from 'next/cache';
import { Suspense } from 'react';

import type { PageBuilderBlock } from '@/src/components/shared/PageBuilder';
import { PRODUCT_SORT_OPTIONS } from '@/src/global/constants';
import type {
  BrandMetadata,
  ProductFilterMetadata,
} from '@/src/global/filters';
import { sanityFetchPublished } from '@/src/global/sanity/live';
import { queryCpoProductsFilterMetadata } from '@/src/global/sanity/query';
import type { QueryCpoProductsFilterMetadataResult } from '@/src/global/sanity/sanity.types';

import ProductsAside from '../../products/ProductsAside';
import ProductsListingSkeleton from '../../products/ProductsListing/ProductsListingSkeleton';
import styles from '../../products/ProductsListing/styles.module.scss';
import ProductsListingContainer from '../../products/ProductsListingContainer';
import { ProductsLoadingProvider } from '../../products/ProductsLoadingContext';
import SortDropdown from '../../products/SortDropdown';
import CpoProductsListingInner from './CpoProductsListingInner';

type CpoProductsListingBlockType = Extract<
  PageBuilderBlock,
  { _type: 'cpoProductsListing' }
>;

type CpoProductsListingProps = CpoProductsListingBlockType & {
  index: number;
  searchParams?: {
    page?: string;
    category?: string;
    sortBy?: string | string[];
    search?: string;
    brands?: string | string[];
    minPrice?: string;
    maxPrice?: string;
  };
  basePath?: string;
};

// ----------------------------------------
// Cached Static Data Fetcher
// ----------------------------------------
async function getCpoFilterMetadata() {
  'use cache';
  cacheTag('cpoProduct');
  cacheLife('sanity');

  return sanityFetchPublished<QueryCpoProductsFilterMetadataResult>({
    requestTag: 'cpo.listing.filter-metadata',
    query: queryCpoProductsFilterMetadata,
    tags: ['cpoProduct'],
  });
}

export default async function CpoProductsListing(
  props: CpoProductsListingProps,
) {
  const { heading, searchParams, basePath = '/' } = props;

  const filterMetadata = await getCpoFilterMetadata();

  if (!filterMetadata || !filterMetadata.products?.length) {
    return null;
  }

  const prices = filterMetadata.products
    .map((p) => p.basePriceCents)
    .filter((p): p is number => p !== null && p !== undefined);
  const maxPrice =
    prices.length > 0
      ? Math.max(...prices)
      : filterMetadata.globalMaxPrice || 100000;

  const normalizedParams = {
    ...searchParams,
    sortBy: Array.isArray(searchParams?.sortBy)
      ? searchParams.sortBy[0]
      : searchParams?.sortBy,
  };
  const searchParamsPromise = Promise.resolve(normalizedParams);

  // The CPO listing query (cpoFilterConditions) still searches the product
  // name only, so the sidebar must not match brand names either — otherwise
  // its counts would promise CPO products the listing never returns.
  const cpoSearchMetadata = filterMetadata.products.map((product) => ({
    ...product,
    brandName: null,
  })) as unknown as ProductFilterMetadata[];

  return (
    <ProductsLoadingProvider>
      <section
        id="cpo-listing"
        className={`${styles.productsListing} max-width`}
      >
        <ProductsAside
          allProductsMetadata={cpoSearchMetadata}
          allCategories={[]}
          allBrands={filterMetadata.brands as unknown as BrandMetadata[]}
          globalMaxPrice={maxPrice}
          basePath={basePath}
          heading={heading}
          visibleFilters={{
            search: true,
            categories: false,
            brands: true,
            priceRange: true,
          }}
          headingLevel="h3"
          searchPlaceholder="Szukaj"
        />

        <SortDropdown
          options={PRODUCT_SORT_OPTIONS}
          basePath={basePath}
          defaultValue="newest"
        />

        <ProductsListingContainer>
          <Suspense fallback={<ProductsListingSkeleton />}>
            <CpoProductsListingInner
              searchParams={searchParamsPromise}
              basePath={basePath}
              defaultSortBy="newest"
              scrollTargetId="cpo-listing"
            />
          </Suspense>
        </ProductsListingContainer>
      </section>
    </ProductsLoadingProvider>
  );
}
