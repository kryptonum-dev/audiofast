import { notFound } from 'next/navigation';

import { PRODUCTS_ITEMS_PER_PAGE } from '@/src/global/constants';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  getCpoProductsListingQuery,
  queryCpoProductsListingCount,
} from '@/src/global/sanity/query';
import type {
  QueryCpoProductsListingCountResult,
  QueryCpoProductsListingNewestResult,
} from '@/src/global/sanity/sanity.types';
import { parseBrands, parsePrice } from '@/src/global/utils';

import styles from '../../products/ProductsListing/styles.module.scss';
import CpoProductCard from '../../ui/CpoProductCard';
import EmptyState from '../../ui/EmptyState';
import Pagination from '../../ui/Pagination';

type SearchParamsType = {
  page?: string;
  search?: string;
  sortBy?: string;
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
  const params = await searchParams;

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

  const [products, totalCount] = await Promise.all([
    sanityFetch<QueryCpoProductsListingNewestResult>({
      query: listingQuery,
      params: queryParams,
      tags: ['cpoProduct'],
    }),
    sanityFetch<QueryCpoProductsListingCountResult>({
      query: queryCpoProductsListingCount,
      params: queryParams,
      tags: ['cpoProduct'],
    }),
  ]);

  if (products === null) {
    notFound();
  }

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
