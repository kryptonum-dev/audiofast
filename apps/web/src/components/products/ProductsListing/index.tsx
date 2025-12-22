import { notFound } from 'next/navigation';

import { fetchEmbeddings } from '@/src/app/actions/embeddings';
import { PRODUCTS_ITEMS_PER_PAGE } from '@/src/global/constants';
import type { CustomFilterDefinition } from '@/src/global/filters';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { getProductsListingQuery } from '@/src/global/sanity/query';
import type { QueryProductsListingNewestResult } from '@/src/global/sanity/sanity.types';
import type { ProductType } from '@/src/global/types';
import {
  parseBrands,
  parsePrice,
  parseRangeFilters,
  slugifyFilterName,
} from '@/src/global/utils';

import EmptyState from '../../ui/EmptyState';
import Pagination from '../../ui/Pagination';
import ProductCard from '../../ui/ProductCard';
import styles from './styles.module.scss';

// Search params type
type SearchParamsType = {
  page?: string;
  search?: string;
  sortBy?: string;
  brands?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  [key: string]: string | string[] | undefined;
};

type ProductsListingProps = {
  // Search params (awaited in component)
  searchParams: Promise<SearchParamsType>;

  // Page configuration
  basePath: string;
  category?: string;
  brandSlug?: string; // For brand pages - filter by this brand
  isCPO?: boolean; // Filter for CPO products only

  // Custom filters configuration
  availableCustomFilters?: string[]; // Dropdown filter names for parsing
  filterDefinitions?: CustomFilterDefinition[]; // All filter definitions (for range filters)
  defaultSortBy?: string; // Default sort order when no search
};

export default async function ProductsListing({
  searchParams,
  basePath,
  category = '',
  brandSlug,
  isCPO = false,
  availableCustomFilters = [],
  filterDefinitions = [],
  defaultSortBy = 'orderRank',
}: ProductsListingProps) {
  // Await and parse searchParams
  const params = await searchParams;

  const currentPage = Number(params.page) || 1;
  const itemsPerPage = PRODUCTS_ITEMS_PER_PAGE;
  const searchTerm = params.search || '';
  const hasSearchQuery = Boolean(searchTerm);

  // Category can come from prop OR from URL search params (for brand pages)
  // Normalize to full path format: /kategoria/slug/
  const categoryFromUrl = params.category as string | undefined;
  const effectiveCategory =
    category ||
    (categoryFromUrl
      ? categoryFromUrl.startsWith('/kategoria/')
        ? categoryFromUrl
        : `/kategoria/${categoryFromUrl}/`
      : '');

  // Fetch embeddings if search exists
  const embeddingResults = hasSearchQuery
    ? (await fetchEmbeddings(searchTerm, 'products')) || []
    : [];

  // Determine sort order
  const sortBy = hasSearchQuery
    ? params.sortBy || 'relevance'
    : params.sortBy || defaultSortBy;

  // Parse filters from URL
  const brands = parseBrands(params.brands);
  const minPrice = parsePrice(params.minPrice, 0);
  const maxPrice = parsePrice(params.maxPrice, 999999999, 999999999);

  // Parse dropdown custom filters
  const customFilters = availableCustomFilters
    .map((filterName) => {
      const slugified = slugifyFilterName(filterName);
      const value = params[slugified];
      if (typeof value === 'string' && value) {
        return { filterName, value };
      }
      return null;
    })
    .filter((f): f is { filterName: string; value: string } => f !== null);

  // Parse range filters from URL (format: {slug}-min, {slug}-max)
  const urlSearchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      const stringValue = Array.isArray(value) ? value[0] : value;
      if (stringValue) {
        urlSearchParams.set(key, stringValue);
      }
    }
  });
  const activeRangeFilters = parseRangeFilters(urlSearchParams, filterDefinitions);

  // Convert range filters to GROQ format (null for undefined values)
  const rangeFilters = activeRangeFilters.map((rf) => ({
    filterName: rf.filterName,
    minValue: rf.minValue ?? null,
    maxValue: rf.maxValue ?? null,
  }));

  // Calculate offset/limit
  const offset = (currentPage - 1) * itemsPerPage;
  const limit = offset + itemsPerPage;

  // If brandSlug is provided, use it for filtering (override brands array)
  const effectiveBrands = brandSlug ? [brandSlug] : brands;

  // Get the appropriate query based on sortBy parameter
  const query = getProductsListingQuery(sortBy);

  const productsData = await sanityFetch<QueryProductsListingNewestResult>({
    query,
    params: {
      category: effectiveCategory,
      search: searchTerm || '',
      offset,
      limit,
      brands: effectiveBrands,
      minPrice,
      maxPrice,
      customFilters, // Original format: [{filterName, value}]
      rangeFilters,
      isCPO,
      embeddingResults: embeddingResults || [],
    },
    tags: ['product'],
  });

  if (!productsData) {
    logWarn('Products data not found');
    notFound();
  }

  const hasProducts = productsData.products && productsData.products.length > 0;

  // Create URLSearchParams for Pagination
  const paginationSearchParams = new URLSearchParams();
  if (searchTerm) paginationSearchParams.set('search', searchTerm);
  if (sortBy && sortBy !== defaultSortBy) paginationSearchParams.set('sortBy', sortBy);
  if (!brandSlug && brands.length > 0) {
    paginationSearchParams.set('brands', brands.join(','));
  }
  // Preserve category from URL params (for brand pages)
  if (categoryFromUrl) paginationSearchParams.set('category', categoryFromUrl);
  if (minPrice > 0) paginationSearchParams.set('minPrice', minPrice.toString());
  if (maxPrice < 999999999) {
    paginationSearchParams.set('maxPrice', maxPrice.toString());
  }
  if (customFilters.length > 0) {
    customFilters.forEach(({ filterName, value }) => {
      const slugifiedFilterName = slugifyFilterName(filterName);
      paginationSearchParams.set(slugifiedFilterName, value);
    });
  }

  // Preserve range filters in pagination URL
  if (activeRangeFilters.length > 0) {
    activeRangeFilters.forEach((rf) => {
      const slugifiedFilterName = slugifyFilterName(rf.filterName);
      if (rf.minValue !== undefined) {
        paginationSearchParams.set(`${slugifiedFilterName}-min`, rf.minValue.toString());
      }
      if (rf.maxValue !== undefined) {
        paginationSearchParams.set(`${slugifiedFilterName}-max`, rf.maxValue.toString());
      }
    });
  }

  const ITEMS_PER_ROW = 3;
  const ROW_DELAY = 80;

  return (
    <>
      {!hasProducts ? (
        <EmptyState
          searchTerm={searchTerm}
          category={effectiveCategory}
          type="products"
        />
      ) : (
        <>
          <Pagination
            totalItems={productsData.totalCount || 0}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            basePath={basePath}
            searchParams={paginationSearchParams}
          />
          <ul className={styles.productsGrid}>
            {productsData.products!.map((product: ProductType, index) => {
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
            searchParams={paginationSearchParams}
          />
        </>
      )}
    </>
  );
}
