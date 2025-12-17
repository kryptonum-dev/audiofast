import type { QueryAllProductsFilterMetadataResult } from '../sanity/sanity.types';

// ----------------------------------------
// Filter Metadata Types (from Sanity query)
// ----------------------------------------

/**
 * Single product's filter-relevant metadata
 * Lightweight structure for client-side filter computation
 */
export type ProductFilterMetadata = NonNullable<
  QueryAllProductsFilterMetadataResult['products']
>[number];

/**
 * Category metadata for filter sidebar
 */
export type CategoryMetadata = NonNullable<
  QueryAllProductsFilterMetadataResult['categories']
>[number];

/**
 * Brand metadata for filter sidebar
 */
export type BrandMetadata = NonNullable<
  QueryAllProductsFilterMetadataResult['brands']
>[number];

// ----------------------------------------
// Active Filter State Types
// ----------------------------------------

/**
 * Custom filter value (for category-specific filters)
 */
export type CustomFilterValue = {
  filterName: string;
  value?: string;
  numericValue?: number;
};

/**
 * Active range filter
 */
export type ActiveRangeFilter = {
  filterName: string;
  minValue?: number;
  maxValue?: number;
};

/**
 * Currently active filters parsed from URL
 * Used as input for filter computation
 */
export type ActiveFilters = {
  /** Search term (used for sorting, not filtering in sidebar) */
  search: string;
  /** Array of brand slugs (without /marki/ prefix) */
  brands: string[];
  /** Minimum price in cents */
  minPrice: number;
  /** Maximum price in cents (Infinity for no max) */
  maxPrice: number;
  /** Current category slug (e.g., "/kategoria/streamery/") or null for all products */
  category: string | null;
  /** Category-specific custom filters */
  customFilters: CustomFilterValue[];
  /** Category-specific range filters */
  rangeFilters: ActiveRangeFilter[];
  /** CPO (Certified Pre-Owned) filter */
  isCPO: boolean;
};

/**
 * Filter definition from sub-category
 */
export type CustomFilterDefinition = {
  _key: string;
  name: string;
  filterType: 'dropdown' | 'range';
  unit?: string;
};

// ----------------------------------------
// Computed Filter Results Types
// ----------------------------------------

/**
 * Result of client-side filter computation
 * Contains available options with counts based on current filters
 */
export type ComputedFilters = {
  /** Brand slug → count of matching products */
  brandCounts: Map<string, number>;
  /** Category slug → count of matching products */
  categoryCounts: Map<string, number>;
  /** Price range from filtered products */
  priceRange: {
    min: number;
    max: number;
  };
  /** Total number of products matching ALL filters (including category) */
  totalCount: number;
  /** Count for "All products" - filtered by brand/price but NOT by category */
  allProductsCount: number;
  /** Available custom filter values → array of possible values */
  customFilterValues: Map<string, string[]>;
  /** Available range filter bounds → min/max values and product count */
  rangeFilterBounds: Map<
    string,
    { min: number; max: number; productCount: number }
  >;
};

// ----------------------------------------
// Component Props Types
// ----------------------------------------

/**
 * Category with computed count for sidebar display
 */
export type CategoryWithCount = CategoryMetadata & {
  count: number;
};

/**
 * Brand with computed count for sidebar display
 */
export type BrandWithCount = BrandMetadata & {
  count: number;
};
