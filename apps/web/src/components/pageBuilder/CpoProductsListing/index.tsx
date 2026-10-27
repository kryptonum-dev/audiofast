import type { ReactNode } from 'react';

import type { PageBuilderBlock } from '@/src/components/shared/PageBuilder';
import { PRODUCT_SORT_OPTIONS } from '@/src/global/constants';
import type {
  BrandMetadata,
  ProductFilterMetadata,
} from '@/src/global/filters';
import { deriveCpoFilterMetadata } from '@/src/global/filters/filterMetadata';
import {
  type DynamicFetchOptions,
  sanityFetchCached,
} from '@/src/global/sanity/live';
import { queryCpoProductsFilterMetadata } from '@/src/global/sanity/query';
import type { QueryCpoProductsFilterMetadataResult } from '@/src/global/sanity/sanity.types';

import ProductsAside from '../../products/ProductsAside';
import styles from '../../products/ProductsListing/styles.module.scss';
import ProductsListingContainer from '../../products/ProductsListingContainer';
import { ProductsLoadingProvider } from '../../products/ProductsLoadingContext';
import SortDropdown from '../../products/SortDropdown';

type CpoProductsListingBlockType = Extract<
  PageBuilderBlock,
  { _type: 'cpoProductsListing' }
>;

type CpoProductsListingProps = CpoProductsListingBlockType & {
  index: number;
  basePath?: string;
  /** The page's perspective; filter metadata always runs with stega off. */
  fetchOptions?: DynamicFetchOptions;
  /**
   * The request-time listing (`CpoProductsListingInner` in Suspense), built by
   * the page outside every cache scope and passed through untouched.
   */
  listing?: ReactNode;
};

export default async function CpoProductsListing(
  props: CpoProductsListingProps,
) {
  const { heading, basePath = '/', fetchOptions, listing } = props;

  // Logic data (filter names, brand slugs, prices): never stega-encoded.
  // `cpoProduct` stays as a hand tag: checkout expires it on reserve/sale.
  // One scan of the listable CPO rows; brands and price bounds derive in JS.
  const filterMetadata = deriveCpoFilterMetadata(
    await sanityFetchCached<QueryCpoProductsFilterMetadataResult>({
      requestTag: 'cpo.listing.filter-metadata',
      query: queryCpoProductsFilterMetadata,
      perspective: fetchOptions?.perspective ?? 'published',
      stega: false,
      tags: ['cpoProduct'],
    }),
  );

  if (!filterMetadata.products.length) {
    return null;
  }

  const prices = filterMetadata.products
    .map((p) => p.basePriceCents)
    .filter((p): p is number => p !== null && p !== undefined);
  const maxPrice =
    prices.length > 0
      ? Math.max(...prices)
      : filterMetadata.globalMaxPrice || 100000;

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
          allBrands={filterMetadata.brands satisfies BrandMetadata[]}
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

        <ProductsListingContainer>{listing}</ProductsListingContainer>
      </section>
    </ProductsLoadingProvider>
  );
}
