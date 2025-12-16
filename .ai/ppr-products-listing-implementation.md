# PPR Products Listing Implementation Plan

## Overview

This document outlines the implementation plan for converting the products listing pages (`/produkty` and `/produkty/kategoria/[category]`) from Server-Side Rendered (SSR) to Partial Pre-rendering (PPR) with client-side filter computation.

## Current State Analysis

### Current Architecture Issues

Both `page.tsx` files currently:

1. **Await `searchParams` at page level** (forces SSR)

   ```typescript
   const searchParams = await props.searchParams; // Line 65
   ```

2. **Fetch all data based on searchParams** before rendering

   ```typescript
   const productsData = await sanityFetch({
     query: queryProductsPageData,
     params: { search, brands, minPrice, maxPrice, ... },
   });
   ```

3. **Pass filtered data to sidebar**
   - Categories with filtered counts
   - Brands with filtered counts
   - Price range from filtered products

**Result**: Every page load requires full server round-trip. No static shell, no instant navigation.

### Current Data Flow

```
URL Change → await searchParams → Fetch from Sanity → Render Page
                     ↓
            ENTIRE PAGE BLOCKED
```

### Files Affected

| File                                                                | Purpose                   |
| ------------------------------------------------------------------- | ------------------------- |
| `apps/web/src/app/produkty/(listing)/page.tsx`                      | Main products listing     |
| `apps/web/src/app/produkty/(listing)/kategoria/[category]/page.tsx` | Category-filtered listing |
| `apps/web/src/components/products/ProductsAside/index.tsx`          | Sidebar filters (client)  |
| `apps/web/src/components/products/ProductsListing/index.tsx`        | Product grid (server)     |
| `apps/web/src/global/sanity/query.ts`                               | Sanity GROQ queries       |

---

## Target Architecture

### PPR with Client-Side Filter Computation

```
┌─────────────────────────────────────────────────────────────────┐
│ ProductsPage (PPR - static shell renders instantly)             │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ STATIC SHELL (cached with "use cache")                      │ │
│ │ • Breadcrumbs                                               │ │
│ │ • HeroStatic (title, description, image)                    │ │
│ │ • allProductsFilterMetadata (~80KB for 551 products)        │ │
│ │ • PageBuilder sections                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ProductsAsideClientComputed (client component)              │ │
│ │                                                             │ │
│ │ • Receives: allProductsFilterMetadata                       │ │
│ │ • Reads: URL params client-side (useSearchParams)           │ │
│ │ • Computes: available filters INSTANTLY via useMemo         │ │
│ │ • No re-fetch ever after initial load                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SortDropdown (client component)                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Suspense fallback={<ProductsListingSkeleton />}             │ │
│ │                                                             │ │
│ │ ProductsListing (server component)                          │ │
│ │ • Awaits: searchParams (inside Suspense)                    │ │
│ │ • Fetches: filtered + sorted products                       │ │
│ │ • Only this shows skeleton on filter changes                │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Static shell prerendered** - Hero, breadcrumbs, sidebar structure load instantly
2. **Client-side filter computation** - No server round-trip for sidebar updates
3. **Only ProductsListing in Suspense** - Minimal loading state
4. **Search only sorts, doesn't filter** - Sidebar computation ignores search term

---

## Implementation Tasks

### Phase 1: New Sanity Queries

#### Task 1.1: Create Unified Page Content Query (Combined Static Data)

Create a single conditional query that fetches either category-specific or default `/produkty` content based on the `$category` parameter.

**File**: `apps/web/src/global/sanity/query.ts`

```typescript
// Query for page content - handles both /produkty and /produkty/kategoria/[category]
// Uses GROQ select() to conditionally fetch category-specific or default content
// Parameters:
// - $category: category slug (e.g., "/kategoria/streamery/") or empty string "" for main page
export const queryProductsPageContent = defineQuery(`
  {
    // Main products page data (always fetched for fallback content)
    "defaultContent": *[_type == "products"][0] {
      _id,
      _type,
      "slug": slug.current,
      name,
      ${portableTextFragment("title")},
      ${portableTextFragment("description")},
      ${imageFragment("heroImage")},
      ${pageBuilderFragment},
      seo,
      openGraph{
        title,
        description,
        "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
      }
    },
    // Category-specific data (null if $category is empty)
    "categoryContent": select(
      $category != "" => *[_type == "productCategorySub" && slug.current == $category][0]{
        _id,
        name,
        "slug": slug.current,
        ${portableTextFragment("title")},
        ${portableTextFragment("description")},
        ${imageFragment("heroImage")},
        customFilters,
        ${pageBuilderFragment},
        seo,
        openGraph{
          title,
          description,
          "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        },
        parentCategory->{
          _id,
          name,
          "slug": slug.current
        }
      },
      null
    )
  }
`);
```

**Usage in page.tsx:**

```typescript
// For /produkty page
const data = await sanityFetch({
  query: queryProductsPageContent,
  params: { category: "" },
});
// data.defaultContent = main page content
// data.categoryContent = null

// For /produkty/kategoria/streamery page
const data = await sanityFetch({
  query: queryProductsPageContent,
  params: { category: "/kategoria/streamery/" },
});
// data.defaultContent = fallback content
// data.categoryContent = streamery-specific content (or null if not found)

// Use categoryContent if available, otherwise defaultContent
const pageContent = data.categoryContent || data.defaultContent;
```

#### Task 1.2: Create Products Filter Metadata Query

Create a lightweight query that returns all products with only filter-relevant fields (~80KB for 551 products).

**File**: `apps/web/src/global/sanity/query.ts`

```typescript
// Query for all products filter metadata (lightweight)
// Used for client-side filter computation
// ~150 bytes per product × 551 products = ~80KB total
export const queryAllProductsFilterMetadata = defineQuery(`
  {
    "products": *[
      _type == "product" 
      && defined(slug.current)
      && isArchived != true
      && count(categories) > 0
    ] {
      _id,
      "brandSlug": string::split(brand->slug.current, "/")[2],
      "brandName": brand->name,
      "categorySlug": categories[0]->slug.current,
      "parentCategorySlug": categories[0]->parentCategory->slug.current,
      "allCategorySlugs": categories[]->slug.current,
      basePriceCents,
      isCPO,
      customFilterValues
    },
    "categories": *[_type == "productCategorySub" && defined(slug.current)] | order(orderRank) {
      _id,
      name,
      "slug": slug.current,
      parentCategory->{
        _id,
        name,
        "slug": slug.current
      }
    },
    "brands": *[_type == "brand" && defined(slug.current)] | order(orderRank) {
      _id,
      name,
      "slug": slug.current,
      ${imageFragment("logo")}
    },
    "globalMaxPrice": math::max(*[
      _type == "product" 
      && defined(slug.current)
      && isArchived != true
      && defined(basePriceCents)
    ].basePriceCents),
    "globalMinPrice": math::min(*[
      _type == "product" 
      && defined(slug.current)
      && isArchived != true
      && defined(basePriceCents)
    ].basePriceCents)
  }
`);
```

---

### Phase 2: Filter Computation Utility

#### Task 2.1: Create Filter Computation Module

**File**: `apps/web/src/global/filters/computeFilters.ts`

```typescript
import type {
  ProductFilterMetadata,
  ComputedFilters,
  ActiveFilters,
} from "./types";

/**
 * Computes available filter options from product metadata
 * This runs client-side and is instant (~1ms for 551 products)
 *
 * @param allProducts - Array of all products with filter-relevant data
 * @param activeFilters - Currently active filter values
 * @returns Computed filter options with counts
 */
export function computeAvailableFilters(
  allProducts: ProductFilterMetadata[],
  activeFilters: ActiveFilters,
): ComputedFilters {
  // Step 1: Filter products based on active filters
  let filtered = allProducts;

  // Apply category filter
  if (activeFilters.category) {
    filtered = filtered.filter(
      (p) =>
        p.allCategorySlugs?.includes(activeFilters.category!) ||
        p.categorySlug === activeFilters.category,
    );
  }

  // Apply brand filter
  if (activeFilters.brands.length > 0) {
    filtered = filtered.filter(
      (p) => p.brandSlug && activeFilters.brands.includes(p.brandSlug),
    );
  }

  // Apply price filter
  if (activeFilters.minPrice > 0) {
    filtered = filtered.filter(
      (p) =>
        p.basePriceCents !== null && p.basePriceCents >= activeFilters.minPrice,
    );
  }
  if (activeFilters.maxPrice < Infinity) {
    filtered = filtered.filter(
      (p) =>
        p.basePriceCents !== null && p.basePriceCents <= activeFilters.maxPrice,
    );
  }

  // Apply custom filters (for category pages)
  if (activeFilters.customFilters && activeFilters.customFilters.length > 0) {
    filtered = filtered.filter((p) => {
      if (!p.customFilterValues) return false;
      return activeFilters.customFilters!.every((activeFilter) =>
        p.customFilterValues?.some(
          (pf) =>
            pf.filterName === activeFilter.filterName &&
            pf.value === activeFilter.value,
        ),
      );
    });
  }

  // Apply CPO filter
  if (activeFilters.isCPO) {
    filtered = filtered.filter((p) => p.isCPO === true);
  }

  // Step 2: Compute available options from filtered products

  // Available brands with counts
  const brandCounts = new Map<string, number>();
  filtered.forEach((p) => {
    if (p.brandSlug) {
      brandCounts.set(p.brandSlug, (brandCounts.get(p.brandSlug) || 0) + 1);
    }
  });

  // Available categories with counts
  const categoryCounts = new Map<string, number>();
  filtered.forEach((p) => {
    if (p.categorySlug) {
      categoryCounts.set(
        p.categorySlug,
        (categoryCounts.get(p.categorySlug) || 0) + 1,
      );
    }
    // Also count parent categories if needed
    p.allCategorySlugs?.forEach((slug) => {
      if (slug !== p.categorySlug) {
        categoryCounts.set(slug, (categoryCounts.get(slug) || 0) + 1);
      }
    });
  });

  // Price range from filtered products
  const prices = filtered
    .map((p) => p.basePriceCents)
    .filter((p): p is number => p !== null && p !== undefined);

  const minAvailablePrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxAvailablePrice = prices.length > 0 ? Math.max(...prices) : 0;

  // Custom filter values (for category pages)
  const customFilterValues = computeCustomFilterValues(
    filtered,
    activeFilters.customFilters || [],
  );

  return {
    brandCounts,
    categoryCounts,
    priceRange: { min: minAvailablePrice, max: maxAvailablePrice },
    totalCount: filtered.length,
    customFilterValues,
  };
}

/**
 * Computes available custom filter values
 * Shows only values that exist in products matching OTHER active filters
 */
function computeCustomFilterValues(
  products: ProductFilterMetadata[],
  activeCustomFilters: Array<{ filterName: string; value: string }>,
): Map<string, string[]> {
  const filterValues = new Map<string, Set<string>>();

  products.forEach((p) => {
    p.customFilterValues?.forEach((fv) => {
      if (!filterValues.has(fv.filterName)) {
        filterValues.set(fv.filterName, new Set());
      }
      if (fv.value) {
        filterValues.get(fv.filterName)!.add(fv.value);
      }
    });
  });

  // Convert Sets to sorted arrays
  const result = new Map<string, string[]>();
  filterValues.forEach((values, filterName) => {
    result.set(filterName, Array.from(values).sort());
  });

  return result;
}
```

#### Task 2.2: Create Types File

**File**: `apps/web/src/global/filters/types.ts`

```typescript
export type ProductFilterMetadata = {
  _id: string;
  brandSlug: string | null;
  brandName: string | null;
  categorySlug: string | null;
  parentCategorySlug: string | null;
  allCategorySlugs: string[] | null;
  basePriceCents: number | null;
  isCPO: boolean | null;
  customFilterValues: Array<{
    filterName: string;
    value: string;
  }> | null;
};

export type ActiveFilters = {
  search: string;
  brands: string[];
  minPrice: number;
  maxPrice: number;
  category: string | null;
  customFilters?: Array<{ filterName: string; value: string }>;
  isCPO?: boolean;
};

export type ComputedFilters = {
  brandCounts: Map<string, number>;
  categoryCounts: Map<string, number>;
  priceRange: { min: number; max: number };
  totalCount: number;
  customFilterValues: Map<string, string[]>;
};

export type CategoryMetadata = {
  _id: string;
  name: string;
  slug: string;
  parentCategory: {
    _id: string;
    name: string;
    slug: string;
  } | null;
};

export type BrandMetadata = {
  _id: string;
  name: string;
  slug: string;
  logo: {
    id: string | null;
    preview: string | null;
    alt: string | null;
    naturalWidth: number | null;
    naturalHeight: number | null;
    hotspot: unknown;
    crop: unknown;
  };
};
```

#### Task 2.3: Create Index Export

**File**: `apps/web/src/global/filters/index.ts`

```typescript
export { computeAvailableFilters } from "./computeFilters";
export type {
  ProductFilterMetadata,
  ActiveFilters,
  ComputedFilters,
  CategoryMetadata,
  BrandMetadata,
} from "./types";
```

---

### Phase 3: New/Updated Components

#### Task 3.1: Create ProductsAsideClientComputed Wrapper

This client component wraps ProductsAside and handles client-side filter computation.

**File**: `apps/web/src/components/products/ProductsAsideClientComputed/index.tsx`

```typescript
'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import {
  computeAvailableFilters,
  type ProductFilterMetadata,
  type CategoryMetadata,
  type BrandMetadata,
} from '@/src/global/filters';
import { parseBrands, parsePrice } from '@/src/global/utils';

import ProductsAside from '../ProductsAside';

type ProductsAsideClientComputedProps = {
  // Static data (never changes)
  allProductsMetadata: ProductFilterMetadata[];
  allCategories: CategoryMetadata[];
  allBrands: BrandMetadata[];
  globalMaxPrice: number;
  globalMinPrice: number;

  // Page configuration
  basePath: string;
  currentCategory?: string | null;
  availableCustomFilters?: string[]; // For category pages
  headingLevel?: 'h2' | 'h3';
};

export default function ProductsAsideClientComputed({
  allProductsMetadata,
  allCategories,
  allBrands,
  globalMaxPrice,
  globalMinPrice,
  basePath,
  currentCategory = null,
  availableCustomFilters = [],
  headingLevel = 'h2',
}: ProductsAsideClientComputedProps) {
  const searchParams = useSearchParams();

  // Parse current filters from URL
  const activeFilters = useMemo(() => {
    const brandsParam = searchParams.get('brands');
    return {
      search: searchParams.get('search') || '',
      brands: brandsParam ? parseBrands(brandsParam) : [],
      minPrice: parsePrice(searchParams.get('minPrice'), 0),
      maxPrice: parsePrice(searchParams.get('maxPrice'), Infinity, Infinity),
      category: currentCategory,
      customFilters: parseCustomFilters(searchParams, availableCustomFilters),
      isCPO: false,
    };
  }, [searchParams, currentCategory, availableCustomFilters]);

  // ⚡ INSTANT computation - no fetch, no delay!
  const computed = useMemo(() => {
    return computeAvailableFilters(allProductsMetadata, activeFilters);
  }, [allProductsMetadata, activeFilters]);

  // Merge computed counts with full category/brand data
  const categoriesWithCounts = useMemo(() => {
    return allCategories.map((cat) => ({
      ...cat,
      count: computed.categoryCounts.get(cat.slug) || 0,
    }));
  }, [allCategories, computed.categoryCounts]);

  const brandsWithCounts = useMemo(() => {
    return allBrands.map((brand) => {
      const brandSlug = brand.slug.replace('/marki/', '').replace(/\/$/, '');
      return {
        ...brand,
        count: computed.brandCounts.get(brandSlug) || 0,
      };
    });
  }, [allBrands, computed.brandCounts]);

  // Effective max price (from filtered products or global)
  const effectiveMaxPrice =
    computed.priceRange.max > 0 ? computed.priceRange.max : globalMaxPrice;

  return (
    <ProductsAside
      categories={categoriesWithCounts}
      brands={brandsWithCounts}
      totalCount={computed.totalCount}
      maxPrice={effectiveMaxPrice}
      basePath={basePath}
      currentCategory={currentCategory}
      initialSearch={activeFilters.search}
      initialBrands={activeFilters.brands}
      initialMinPrice={activeFilters.minPrice}
      initialMaxPrice={
        activeFilters.maxPrice < Infinity
          ? activeFilters.maxPrice
          : effectiveMaxPrice
      }
      headingLevel={headingLevel}
    />
  );
}

// Helper to parse custom filters from URL
function parseCustomFilters(
  searchParams: URLSearchParams,
  availableFilters: string[]
): Array<{ filterName: string; value: string }> {
  const filters: Array<{ filterName: string; value: string }> = [];

  availableFilters.forEach((filterName) => {
    const slugified = slugifyFilterName(filterName);
    const value = searchParams.get(slugified);
    if (value) {
      filters.push({ filterName, value });
    }
  });

  return filters;
}

function slugifyFilterName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

#### Task 3.2: Update ProductsListing to Accept searchParams

Instead of creating a separate container, update `ProductsListing` to optionally accept `searchParams` and handle parsing internally. This maintains backward compatibility with brand pages and other usages.

**File**: `apps/web/src/components/products/ProductsListing/index.tsx`

```typescript
import { notFound } from 'next/navigation';

import { fetchEmbeddings } from '@/src/app/actions/embeddings';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { getProductsListingQuery } from '@/src/global/sanity/query';
import type { QueryProductsListingNewestResult } from '@/src/global/sanity/sanity.types';
import type { ProductType } from '@/src/global/types';
import {
  parseBrands,
  parsePrice,
  slugifyFilterName,
} from '@/src/global/utils';
import { PRODUCTS_ITEMS_PER_PAGE } from '@/src/global/constants';

import EmptyState from '../../ui/EmptyState';
import Pagination from '../../ui/Pagination';
import ProductCard from '../../ui/ProductCard';
import styles from './styles.module.scss';

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
  // Option A: Pass searchParams directly (for PPR pages)
  searchParams?: Promise<SearchParamsType>;

  // Option B: Pass explicit props (for backward compatibility)
  currentPage?: number;
  itemsPerPage?: number;
  searchTerm?: string;
  category?: string;
  sortBy?: string;
  brands?: string[];
  brandSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  customFilters?: Array<{ filterName: string; value: string }>;
  isCPO?: boolean;
  embeddingResults?: Array<{
    score: number;
    value: { documentId: string; type: string };
  }> | null;

  // Required for both options
  basePath: string;

  // Additional config for searchParams mode
  availableCustomFilters?: string[];
  defaultSortBy?: string;
};

export default async function ProductsListing(props: ProductsListingProps) {
  // Determine which mode we're in
  let currentPage: number;
  let itemsPerPage: number;
  let searchTerm: string;
  let category: string;
  let sortBy: string;
  let brands: string[];
  let brandSlug: string | undefined;
  let minPrice: number;
  let maxPrice: number;
  let customFilters: Array<{ filterName: string; value: string }>;
  let isCPO: boolean;
  let embeddingResults: Array<{
    score: number;
    value: { documentId: string; type: string };
  }> | null;

  if (props.searchParams) {
    // Mode A: Parse from searchParams (PPR mode)
    const params = await props.searchParams;

    currentPage = Number(params.page) || 1;
    itemsPerPage = props.itemsPerPage || PRODUCTS_ITEMS_PER_PAGE;
    searchTerm = params.search || '';
    category = props.category || '';
    brandSlug = props.brandSlug;

    const hasSearchQuery = Boolean(searchTerm);

    // Fetch embeddings if search exists
    embeddingResults = hasSearchQuery
      ? (await fetchEmbeddings(searchTerm, 'products')) || []
      : [];

    // Determine sort order
    sortBy = hasSearchQuery
      ? params.sortBy || 'relevance'
      : params.sortBy || props.defaultSortBy || 'orderRank';

    brands = parseBrands(params.brands);
    minPrice = parsePrice(params.minPrice, 0);
    maxPrice = parsePrice(params.maxPrice, 999999999, 999999999);
    isCPO = props.isCPO || false;

    // Parse custom filters
    customFilters = (props.availableCustomFilters || [])
      .map((filterName) => {
        const slugified = slugifyFilterName(filterName);
        const value = params[slugified];
        if (typeof value === 'string' && value) {
          return { filterName, value };
        }
        return null;
      })
      .filter((f): f is { filterName: string; value: string } => f !== null);
  } else {
    // Mode B: Use explicit props (backward compatibility)
    currentPage = props.currentPage || 1;
    itemsPerPage = props.itemsPerPage || PRODUCTS_ITEMS_PER_PAGE;
    searchTerm = props.searchTerm || '';
    category = props.category || '';
    sortBy = props.sortBy || 'newest';
    brands = props.brands || [];
    brandSlug = props.brandSlug;
    minPrice = props.minPrice || 0;
    maxPrice = props.maxPrice || 999999999;
    customFilters = props.customFilters || [];
    isCPO = props.isCPO || false;
    embeddingResults = props.embeddingResults || null;
  }

  const offset = (currentPage - 1) * itemsPerPage;
  const limit = offset + itemsPerPage;

  // If brandSlug is provided, use it for filtering
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
  const urlSearchParams = new URLSearchParams();
  if (searchTerm) urlSearchParams.set('search', searchTerm);
  if (sortBy && sortBy !== 'newest' && sortBy !== 'orderRank')
    urlSearchParams.set('sortBy', sortBy);
  if (!brandSlug && brands.length > 0) {
    urlSearchParams.set('brands', brands.join(','));
  }
  if (minPrice > 0) urlSearchParams.set('minPrice', minPrice.toString());
  if (maxPrice < 999999999)
    urlSearchParams.set('maxPrice', maxPrice.toString());
  if (customFilters.length > 0) {
    customFilters.forEach(({ filterName, value }) => {
      const slugifiedFilterName = slugifyFilterName(filterName);
      urlSearchParams.set(slugifiedFilterName, value);
    });
  }

  const ITEMS_PER_ROW = 3;
  const ROW_DELAY = 80;

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
            basePath={props.basePath}
            searchParams={urlSearchParams}
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
            basePath={props.basePath}
            searchParams={urlSearchParams}
          />
        </>
      )}
    </>
  );
}
```

#### Task 3.3: Create ProductsAsideSkeleton (with Mobile Support)

Create a skeleton that covers both desktop sidebar and mobile filter button/panel.

**File**: `apps/web/src/components/products/ProductsAside/ProductsAsideSkeleton.tsx`

```typescript
import styles from './styles.module.scss';

/**
 * Skeleton loader for ProductsAside
 * Includes both mobile button and desktop sidebar structure
 */
export default function ProductsAsideSkeleton() {
  return (
    <>
      {/* Mobile Open Button Skeleton */}
      <div className={styles.mobileOpenButtonSkeleton}>
        <div className={styles.skeletonIcon} />
        <div className={styles.skeletonText} />
      </div>

      {/* Desktop Sidebar Skeleton */}
      <aside className={styles.sidebar} data-loading="true">
        {/* Search skeleton */}
        <div className={styles.skeletonSearch} />

        {/* Categories skeleton */}
        <div className={styles.section}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonList}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonItem} />
            ))}
          </div>
        </div>

        {/* Brands skeleton */}
        <div className={styles.section}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skeletonCheckbox} />
            ))}
          </div>
        </div>

        {/* Price range skeleton */}
        <div className={styles.section}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonPriceRange} />
        </div>

        {/* Button skeleton */}
        <div className={styles.skeletonButton} />
      </aside>
    </>
  );
}
```

**Note**: The skeleton is mainly for edge cases. With PPR, the sidebar renders immediately with server data, so the skeleton is rarely seen. However, it provides a fallback during initial hydration.

---

### Phase 4: Update Page Components

#### Task 4.1: Update `/produkty/(listing)/page.tsx`

**File**: `apps/web/src/app/produkty/(listing)/page.tsx`

```typescript
import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import ProductsAsideClientComputed from '@/src/components/products/ProductsAsideClientComputed';
import ProductsListing from '@/src/components/products/ProductsListing';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/products/ProductsListing/styles.module.scss';
import SortDropdown from '@/src/components/products/SortDropdown';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import {
  PRODUCT_SORT_OPTIONS,
  RELEVANCE_SORT_OPTION,
} from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  queryProductsPageContent,
  queryAllProductsFilterMetadata,
} from '@/src/global/sanity/query';
import type {
  QueryProductsPageContentResult,
  QueryAllProductsFilterMetadataResult,
} from '@/src/global/sanity/sanity.types';
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

// Cached static data fetcher
async function getStaticPageData() {
  'use cache';
  cacheLife('hours');

  const [contentData, filterMetadata] = await Promise.all([
    sanityFetch<QueryProductsPageContentResult>({
      query: queryProductsPageContent,
      params: { category: '' }, // Empty = main products page
      tags: ['products'],
    }),
    sanityFetch<QueryAllProductsFilterMetadataResult>({
      query: queryAllProductsFilterMetadata,
      tags: ['products'],
    }),
  ]);

  return { contentData, filterMetadata };
}

export async function generateMetadata() {
  const { contentData } = await getStaticPageData();
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

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  // Fetch cached static data (instant after first load)
  const { contentData, filterMetadata } = await getStaticPageData();
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
        _key={''}
        _type={'heroStatic'}
        button={null}
      />
      <section className={`${styles.productsListing} max-width`}>
        {/* Client-side computed sidebar - instant filter updates */}
        <ProductsAsideClientComputed
          allProductsMetadata={filterMetadata.products}
          allCategories={filterMetadata.categories}
          allBrands={filterMetadata.brands}
          globalMaxPrice={filterMetadata.globalMaxPrice || 100000}
          globalMinPrice={filterMetadata.globalMinPrice || 0}
          basePath="/produkty/"
          currentCategory={null}
          headingLevel="h2"
        />

        {/* Sort dropdown - reads from URL client-side */}
        <SortDropdown
          options={[RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]}
          basePath="/produkty/"
          defaultValue="orderRank"
        />

        {/* Products listing in Suspense - only this shows skeleton */}
        <Suspense fallback={<ProductsListingSkeleton />}>
          <ProductsListing
            searchParams={searchParams}
            basePath="/produkty/"
            defaultSortBy="orderRank"
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={pageData.pageBuilder || []} />
    </>
  );
}
```

#### Task 4.2: Update `/produkty/(listing)/kategoria/[category]/page.tsx`

**File**: `apps/web/src/app/produkty/(listing)/kategoria/[category]/page.tsx`

```typescript
import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import HeroStatic from '@/src/components/pageBuilder/HeroStatic';
import CustomFiltersBarClientComputed from '@/src/components/products/CustomFiltersBarClientComputed';
import ProductsAsideClientComputed from '@/src/components/products/ProductsAsideClientComputed';
import ProductsListing from '@/src/components/products/ProductsListing';
import ProductsListingSkeleton from '@/src/components/products/ProductsListing/ProductsListingSkeleton';
import styles from '@/src/components/products/ProductsListing/styles.module.scss';
import SortDropdown from '@/src/components/products/SortDropdown';
import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import {
  PRODUCT_SORT_OPTIONS,
  RELEVANCE_SORT_OPTION,
} from '@/src/global/constants';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  queryProductsPageContent,
  queryAllProductsFilterMetadata,
} from '@/src/global/sanity/query';
import type {
  QueryProductsPageContentResult,
  QueryAllProductsFilterMetadataResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    brands?: string | string[];
    minPrice?: string;
    maxPrice?: string;
    [key: string]: string | string[] | undefined;
  }>;
};

// Cached static data fetcher (shared across all category pages)
async function getStaticFilterMetadata() {
  'use cache';
  cacheLife('hours');

  return sanityFetch<QueryAllProductsFilterMetadataResult>({
    query: queryAllProductsFilterMetadata,
    tags: ['products'],
  });
}

// Cached page content fetcher (handles both default and category-specific content)
async function getPageContent(categorySlug: string) {
  'use cache';
  cacheLife('hours');

  return sanityFetch<QueryProductsPageContentResult>({
    query: queryProductsPageContent,
    params: { category: `/kategoria/${categorySlug}/` },
    tags: ['products', 'productCategorySub'],
  });
}

export async function generateStaticParams() {
  const filterMetadata = await getStaticFilterMetadata();

  return (
    filterMetadata?.categories
      ?.filter((cat) => cat.slug)
      .map((cat) => ({
        category: cat.slug.replace('/kategoria/', '').replace('/', '') || '',
      })) || []
  );
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const contentData = await getPageContent(categorySlug);

  // Use category content if available, otherwise default
  const pageData = contentData?.categoryContent || contentData?.defaultContent;

  if (!pageData) {
    logWarn(`Category not found: ${categorySlug}`);
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category: categorySlug } = await params;

  // Fetch all cached static data in parallel
  const [contentData, filterMetadata] = await Promise.all([
    getPageContent(categorySlug),
    getStaticFilterMetadata(),
  ]);

  const defaultContent = contentData?.defaultContent;
  const categoryContent = contentData?.categoryContent;

  if (!defaultContent || !filterMetadata) {
    logWarn(`Category page data not found for: ${categorySlug}`);
    notFound();
  }

  // Check if category exists
  const categoryExists = filterMetadata.categories.some(
    (cat) => cat.slug === `/kategoria/${categorySlug}/`
  );

  if (!categoryExists) {
    logWarn(`Category "${categorySlug}" does not exist`);
    notFound();
  }

  // Use category content if available, otherwise fallback to default
  const heroTitle = categoryContent?.title || defaultContent.title;
  const heroDescription =
    categoryContent?.description || defaultContent.description;
  const heroImage = categoryContent?.heroImage || defaultContent.heroImage;
  const pageBuilderSections =
    categoryContent?.pageBuilder?.length > 0
      ? categoryContent.pageBuilder
      : defaultContent.pageBuilder || [];

  // Available custom filters for this category
  const availableCustomFilters = categoryContent?.customFilters || [];

  const breadcrumbsData = [
    {
      name: defaultContent.name || 'Produkty',
      path: '/produkty/',
    },
    {
      name: categoryContent?.name || categorySlug,
      path:
        categoryContent?.slug || `/produkty/kategoria/${categorySlug}/`,
    },
  ];

  return (
    <>
      <CollectionPageSchema
        name={categoryContent?.name || categorySlug}
        url={`/produkty/kategoria/${categorySlug}/`}
        description={categoryContent?.description || defaultContent.description}
      />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <HeroStatic
        heading={heroTitle!}
        description={heroDescription!}
        image={heroImage}
        showBlocks={false}
        blocksHeading={null}
        blocks={[]}
        index={0}
        _key={''}
        _type={'heroStatic'}
        button={null}
      />

      <section
        className={`${styles.productsListing} max-width`}
        data-has-filters={availableCustomFilters.length > 0}
      >
        {/* Client-side computed sidebar */}
        <ProductsAsideClientComputed
          allProductsMetadata={filterMetadata.products}
          allCategories={filterMetadata.categories}
          allBrands={filterMetadata.brands}
          globalMaxPrice={filterMetadata.globalMaxPrice || 100000}
          globalMinPrice={filterMetadata.globalMinPrice || 0}
          basePath={`/produkty/kategoria/${categorySlug}/`}
          currentCategory={`/kategoria/${categorySlug}/`}
          availableCustomFilters={availableCustomFilters}
          headingLevel="h2"
        />

        {/* Custom filters bar (for categories with custom filters) */}
        {availableCustomFilters.length > 0 && (
          <CustomFiltersBarClientComputed
            availableFilters={availableCustomFilters}
            allProductsMetadata={filterMetadata.products}
            basePath={`/produkty/kategoria/${categorySlug}/`}
            currentCategory={`/kategoria/${categorySlug}/`}
          />
        )}

        <SortDropdown
          options={[RELEVANCE_SORT_OPTION, ...PRODUCT_SORT_OPTIONS]}
          basePath={`/produkty/kategoria/${categorySlug}/`}
          defaultValue="newest"
        />

        {/* Products listing in Suspense */}
        <Suspense fallback={<ProductsListingSkeleton />}>
          <ProductsListing
            searchParams={searchParams}
            basePath={`/produkty/kategoria/${categorySlug}/`}
            category={`/kategoria/${categorySlug}/`}
            availableCustomFilters={availableCustomFilters}
            defaultSortBy="newest"
          />
        </Suspense>
      </section>

      <PageBuilder pageBuilder={pageBuilderSections} />
    </>
  );
}
```

---

### Phase 5: Update Existing Components

#### Task 5.1: Update SortDropdown to Read from URL

**File**: `apps/web/src/components/products/SortDropdown/index.tsx`

Ensure SortDropdown reads current sort value from URL client-side rather than requiring it as a prop.

```typescript
// Add to SortDropdown component
const searchParams = useSearchParams();
const currentSort = searchParams.get("sortBy") || defaultValue;
const hasSearchQuery = Boolean(searchParams.get("search"));

// Show relevance option only when search is active
const visibleOptions = hasSearchQuery
  ? options
  : options.filter((opt) => opt.value !== "relevance");
```

#### Task 5.2: Update CategoryViewTracker

Move CategoryViewTracker to ProductsListing since it needs totalCount from the listing query.

---

### Phase 6: Type Generation

#### Task 6.1: Run Sanity Type Generation

After adding new queries, regenerate types:

```bash
cd apps/web
bun sanity:typegen
```

This will generate:

- `QueryProductsPageContentResult`
- `QueryAllProductsFilterMetadataResult`

---

## File Structure Summary

### New Files

```
apps/web/src/
├── global/
│   └── filters/
│       ├── index.ts                    # Exports
│       ├── types.ts                    # Type definitions
│       └── computeFilters.ts           # Filter computation logic
│
├── components/products/
│   ├── ProductsAsideClientComputed/
│   │   └── index.tsx                   # Client-side computed sidebar
│   ├── CustomFiltersBarClientComputed/
│   │   └── index.tsx                   # Client-side computed custom filters
│   └── ProductsAside/
│       └── ProductsAsideSkeleton.tsx   # Skeleton with mobile support
```

### Modified Files

```
apps/web/src/
├── global/sanity/
│   └── query.ts                        # Add 2 new queries
│
├── app/produkty/(listing)/
│   ├── page.tsx                        # Full rewrite
│   └── kategoria/[category]/
│       └── page.tsx                    # Full rewrite
│
├── components/products/
│   ├── ProductsListing/
│   │   └── index.tsx                   # Add searchParams support
│   └── SortDropdown/
│       └── index.tsx                   # Read from URL client-side
```

---

## Testing Checklist

### Functional Tests

- [ ] `/produkty` loads instantly (static shell)
- [ ] Filter changes update sidebar counts instantly
- [ ] Only products grid shows skeleton on filter change
- [ ] Search works correctly with relevance sorting
- [ ] Category pages work with custom filters
- [ ] Pagination preserves all filter state
- [ ] Back/forward navigation works correctly
- [ ] `generateStaticParams` generates all category pages
- [ ] Mobile filter button and panel work correctly

### Performance Tests

- [ ] Initial page load < 100ms (after cache warm)
- [ ] Filter computation < 10ms (client-side)
- [ ] No CLS (Cumulative Layout Shift)
- [ ] LCP (Largest Contentful Paint) < 2.5s

### PPR Verification

- [ ] Build output shows PPR for `/produkty` route
- [ ] View page source shows pre-rendered static shell
- [ ] Network tab shows streaming for products listing

---

## Rollback Plan

If issues arise:

1. Revert page.tsx files to original implementation
2. Remove new components (can keep for future use)
3. New queries can remain (not breaking)

---

## Migration Notes

### Breaking Changes

None - URLs and behavior remain the same.

### SEO Impact

Positive - PPR improves Core Web Vitals (LCP, CLS).

### Analytics

Update CategoryViewTracker to work with new architecture (moved to ProductsListing).

---

## Estimated Effort

| Phase                    | Estimated Time  |
| ------------------------ | --------------- |
| Phase 1: Queries         | 1.5 hours       |
| Phase 2: Filter Utils    | 2 hours         |
| Phase 3: New Components  | 3 hours         |
| Phase 4: Update Pages    | 2.5 hours       |
| Phase 5: Update Existing | 1 hour          |
| Phase 6: Type Generation | 30 mins         |
| Testing                  | 2 hours         |
| **Total**                | **~12.5 hours** |
