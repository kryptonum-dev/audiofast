import { notFound } from 'next/navigation';

import { PRODUCTS_ITEMS_PER_PAGE } from '@/src/global/constants';
import {
  getDynamicFetchOptions,
  sanityFetchCached,
} from '@/src/global/sanity/live';
import { getCpoProductsListingQuery } from '@/src/global/sanity/query';
import type { QueryCpoProductsListingNewestResult } from '@/src/global/sanity/sanity.types';
import { parseBrands, parsePrice } from '@/src/global/utils';

import styles from '../../products/ProductsListing/styles.module.scss';
import CpoProductCard from '../../ui/CpoProductCard';
import EmptyState from '../../ui/EmptyState';
import Pagination from '../../ui/Pagination';

type SearchParamsType = {
  page?: string;
  search?: string;
  sortBy?: string | string[];
  brands?: string | string[];
  minPrice?: string;
  maxPrice?: string;
};

type CpoProductsListingInnerProps = {
  searchParams: Promise<SearchParamsType>;
  basePath: string;
  defaultSortBy?: string;
  scrollTargetId?: string;
};

export default async function CpoProductsListingInner({
  searchParams,
  basePath,
  defaultSortBy = 'newest',
  scrollTargetId,
}: CpoProductsListingInnerProps) {
  // Rendered as a pass-through slot under a request-time Suspense hole, built
  // outside every cache scope: it resolves the request's search params and
  // perspective itself. Listing data is logic data, so stega stays off.
  const [rawParams, { perspective }] = await Promise.all([
    searchParams,
    getDynamicFetchOptions(),
  ]);
  const params = {
    ...rawParams,
    sortBy: Array.isArray(rawParams.sortBy)
      ? rawParams.sortBy[0]
      : rawParams.sortBy,
  };

  const currentPage = Number(params.page) || 1;
  const itemsPerPage = PRODUCTS_ITEMS_PER_PAGE;
  const offset = (currentPage - 1) * itemsPerPage;
  const limit = offset + itemsPerPage;

  const sortBy = params.sortBy || defaultSortBy;
  const searchTerm = params.search || '';
  const brands = parseBrands(params.brands).map((b) => b.toLowerCase());
  const minPrice = parsePrice(params.minPrice, 0);
  const maxPrice = parsePrice(params.maxPrice, 0, 0);

  const queryParams = {
    offset,
    limit,
    search: searchTerm,
    brands,
    minPrice,
    maxPrice,
  };

  const listingQuery = getCpoProductsListingQuery(sortBy);

  // Page of products and total count in one request.
  const listing = await sanityFetchCached<QueryCpoProductsListingNewestResult>({
    requestTag: 'cpo.listing.products',
    query: listingQuery,
    params: queryParams,
    perspective,
    stega: false,
  });

  if (!listing?.products) {
    notFound();
  }

  const { products, totalCount } = listing;

  const listableProducts = products.filter((p) => p.mainImage?.id);
  const hasProducts = listableProducts.length > 0;

  const paginationSearchParams = new URLSearchParams();
  if (searchTerm) paginationSearchParams.set('search', searchTerm);
  if (params.sortBy && params.sortBy !== defaultSortBy)
    paginationSearchParams.set('sortBy', params.sortBy);
  if (brands.length > 0) paginationSearchParams.set('brands', brands.join(','));
  if (minPrice > 0) paginationSearchParams.set('minPrice', minPrice.toString());
  if (maxPrice > 0 && maxPrice < 999999999)
    paginationSearchParams.set('maxPrice', maxPrice.toString());

  const ITEMS_PER_ROW = 3;
  const ROW_DELAY = 80;

  return (
    <>
      {!hasProducts ? (
        <EmptyState searchTerm={searchTerm} type="products" />
      ) : (
        <>
          <Pagination
            totalItems={totalCount || 0}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            basePath={basePath}
            searchParams={paginationSearchParams}
          />
          <ul className={styles.productsGrid}>
            {listableProducts.map((product, index) => {
              const row = Math.floor(index / ITEMS_PER_ROW);
              const delay = row * ROW_DELAY;

              return (
                <li
                  key={product._id}
                  className={styles.productItem}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <CpoProductCard
                    product={product}
                    imageSizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={index < 3}
                    loading={index < 3 ? 'eager' : 'lazy'}
                  />
                </li>
              );
            })}
          </ul>
          <Pagination
            totalItems={totalCount || 0}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            basePath={basePath}
            searchParams={paginationSearchParams}
            scrollTargetId={scrollTargetId}
          />
        </>
      )}
    </>
  );
}
