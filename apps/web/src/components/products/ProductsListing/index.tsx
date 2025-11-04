import { notFound } from 'next/navigation';

import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/client';
import { getProductsListingQuery } from '@/src/global/sanity/query';
import type { QueryProductsListingNewestResult } from '@/src/global/sanity/sanity.types';
import { slugifyFilterName } from '@/src/global/utils';

import EmptyState from '../../ui/EmptyState';
import Pagination from '../../ui/Pagination';
import ProductCard from '../../ui/ProductCard';
import styles from './styles.module.scss';

type ProductsListingProps = {
  currentPage: number;
  itemsPerPage: number;
  searchTerm?: string;
  category?: string;
  sortBy?: string;
  brands?: string[];
  brandSlug?: string; // Add brand context for brand pages
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
  brandSlug,
  minPrice = 0,
  maxPrice = 999999999,
  customFilters = [],
  basePath,
}: ProductsListingProps) {
  const offset = (currentPage - 1) * itemsPerPage;
  const limit = offset + itemsPerPage;

  // If brandSlug is provided, use it for filtering (override brands array)
  // Otherwise, use the brands array as normal
  const effectiveBrands = brandSlug ? [brandSlug] : brands;

  // Get the appropriate query based on sortBy parameter
  const query = getProductsListingQuery(sortBy);

  const productsData = await sanityFetch<QueryProductsListingNewestResult>({
    query,
    params: {
      category: category || '',
      search: searchTerm || '',
      offset,
      limit,
      brands: effectiveBrands,
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
  // Only add brands to URL params if not using brandSlug (brandSlug is handled via route)
  if (!brandSlug && brands.length > 0) {
    // Set brands as a comma-separated string
    urlSearchParams.set('brands', brands.join(','));
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

  const ITEMS_PER_ROW = 3;
  const ROW_DELAY = 80; // delay between rows in ms

  return (
    <>
      {!hasProducts ? (
        <EmptyState
          searchTerm={searchTerm}
          category={category}
          type="products"
        />
      ) : (
        <>
          <Pagination
            totalItems={productsData.totalCount || 0}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            basePath={basePath}
            searchParams={urlSearchParams}
          />
          <ul className={styles.productsGrid}>
            {productsData.products!.map((product, index) => {
              const row = Math.floor(index / ITEMS_PER_ROW);
              const delay = row * ROW_DELAY;

              return (
                <li
                  key={product._id}
                  className={styles.productItem}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <ProductCard
                    product={product}
                    imageSizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={index < 3}
                    isClient={false}
                    loading={index < 3 ? 'eager' : 'lazy'}
                  />
                </li>
              );
            })}
          </ul>
          <Pagination
            totalItems={productsData.totalCount || 0}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            basePath={basePath}
            searchParams={urlSearchParams}
          />
        </>
      )}
    </>
  );
}
