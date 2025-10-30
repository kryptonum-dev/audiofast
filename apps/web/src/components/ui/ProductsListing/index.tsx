import { notFound } from 'next/navigation';

import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import { getProductsListingQuery } from '@/src/global/sanity/query';
import type { QueryProductsListingResult } from '@/src/global/sanity/sanity.types';
import { slugifyFilterName } from '@/src/global/utils';

import Pagination from '../Pagination';
import EmptyState from './EmptyState';
import styles from './styles.module.scss';

type ProductsListingProps = {
  currentPage: number;
  itemsPerPage: number;
  searchTerm?: string;
  category?: string;
  sortBy?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  customFilters?: Array<{ filterName: string; value: string }>;
  basePath: string;
};

export default async function ProductsListing({
  currentPage,
  itemsPerPage,
  searchTerm = '',
  category = '',
  sortBy = 'newest',
  brands = [],
  minPrice = 0,
  maxPrice = 999999999,
  customFilters = [],
  basePath,
}: ProductsListingProps) {
  const offset = (currentPage - 1) * itemsPerPage;
  const limit = offset + itemsPerPage;

  // Get the appropriate query based on sortBy parameter
  const query = getProductsListingQuery(sortBy);

  const productsData = await sanityFetch<QueryProductsListingResult>({
    query,
    params: {
      category: category || '',
      search: searchTerm || '',
      offset,
      limit,
      brands,
      minPrice,
      maxPrice,
      customFilters,
    },
    tags: ['product'],
  });

  if (!productsData) {
    logWarn('Products data not found');
    notFound();
  }

  const hasProducts = productsData.products && productsData.products.length > 0;

  // Create URLSearchParams for Pagination
  const urlSearchParams = new URLSearchParams();
  if (searchTerm) urlSearchParams.set('search', searchTerm);
  if (sortBy && sortBy !== 'newest') urlSearchParams.set('sortBy', sortBy);
  if (brands.length > 0) {
    brands.forEach((brand) => urlSearchParams.append('brands', brand));
  }
  if (minPrice > 0) urlSearchParams.set('minPrice', minPrice.toString());
  if (maxPrice < 999999999)
    urlSearchParams.set('maxPrice', maxPrice.toString());
  // Add custom filters to pagination params (slugified)
  if (customFilters.length > 0) {
    customFilters.forEach(({ filterName, value }) => {
      const slugifiedFilterName = slugifyFilterName(filterName);
      urlSearchParams.set(slugifiedFilterName, value);
    });
  }

  return (
    <>
      {!hasProducts ? (
        <EmptyState searchTerm={searchTerm} category={category} />
      ) : (
        <div className={styles.productsGrid}>Products</div>
      )}
    </>
  );
}
