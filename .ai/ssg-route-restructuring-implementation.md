# SSG Route Restructuring Implementation Plan

## Overview

This document outlines the end-to-end implementation strategy for restructuring product routes to leverage Static Site Generation (SSG) for optimal performance on the most common browsing paths.

### Key Constraints & Solutions

| Constraint                               | Solution                                                    |
| ---------------------------------------- | ----------------------------------------------------------- |
| **Slow product listing queries (1.3s+)** | Run queries at build time, serve from CDN                   |
| **Filters require dynamic data**         | Move filtered views to `/filtr` route with PPR              |
| **URL structure change**                 | Clean URLs for static routes, query params only for filters |
| **Revalidation on content change**       | Webhook triggers revalidation of static pages               |

### Problem Statement

The current products listing query takes **1.2-1.5 seconds** on every request because:

- Complex GROQ operations run on each page load
- `searchParams` make pages dynamic (no caching)
- Every filter combination triggers a fresh query

### Solution

Restructure routes so that:

1. **Most common routes are statically generated** at build time
2. **Filtered views** use PPR with the slow query (acceptable trade-off)
3. **CDN serves static pages** with 0ms query latency

### Expected Improvement

| Metric                           | Before (Current) | After (SSG)                  |
| -------------------------------- | ---------------- | ---------------------------- |
| `/produkty/` load time           | 1.3s query       | 0ms (CDN cached)             |
| `/produkty/kategoria/X`          | 1.3s query       | 0ms (CDN cached)             |
| `/marki/{brand}/`                | 1.3s query       | 0ms (CDN cached)             |
| `/marki/{brand}/kategoria/{cat}` | 1.3s query       | 0ms (CDN cached, valid only) |
| Filtered views (`/filtr`)        | 1.3s query       | 1.3s (PPR, same)             |
| Build time                       | ~6-7 min         | ~10-12 min (estimated)       |

> **Note**: Brand+category combinations are only generated for valid pairs (where products exist), not all 1400+ theoretical combinations. This keeps build time reasonable (~150-200 pages instead of 1400).

---

## Phase 1: Route Structure Planning

### Current Route Structure

```
/produkty/                              → Dynamic (searchParams)
/produkty/?kategoria=wzmacniacze        → Dynamic
/produkty/?marki=yamaha                 → Dynamic
/produkty/?marki=yamaha&kategoria=X     → Dynamic

/marki/{brand}/                         → Dynamic (searchParams)
/marki/{brand}/?kategoria=wzmacniacze   → Dynamic
```

### New Route Structure

```
# Static Routes (SSG) - Generated at build time
/produkty/                              → Static (all products, default sort)
/produkty/kategoria/{category}          → Static (products by category, ~40 pages)

/marki/{brand}/                         → Static (brand page, all products, ~35 pages)
/marki/{brand}/kategoria/{category}     → Static (brand + category, ~150-200 valid combinations only)

# Dynamic Routes (PPR) - Generated on request
/produkty/filtr?...                     → PPR (filtered products with searchParams)
/marki/{brand}/filtr?...                → PPR (filtered brand products with searchParams)
```

### Static Pages Count (Estimated)

| Route Pattern                         | Count    | Build Impact |
| ------------------------------------- | -------- | ------------ |
| `/produkty/`                          | 1        | Minimal      |
| `/produkty/kategoria/{category}`      | ~40      | ~1 min       |
| `/marki/{brand}/`                     | ~35      | ~1 min       |
| `/marki/{brand}/kategoria/{category}` | ~150-200 | ~3-4 min     |
| **Total static pages**                | **~230** | **~5-6 min** |

> Combined with existing product/review pages (~1500), total build time: **~10-12 minutes**

### URL Parameter Handling

**Key Principle:**

> **Category and Brand are always in the URL path (static when alone).**  
> **Other filters (price, custom filters, pagination) are always searchParams on `/filtr` routes.**

**Static routes (NO searchParams at all):**

- `/produkty/` - all products, first page only
- `/produkty/kategoria/wzmacniacze` - category, first page only
- `/marki/yamaha/` - brand, first page only
- `/marki/yamaha/kategoria/wzmacniacze` - brand + category, first page only

**Dynamic filter routes (PPR with searchParams):**

Only "extra" filters (price, custom, pagination, brand when browsing category) go to `/filtr`:

- `/produkty/filtr?page=2` - pagination on all products
- `/produkty/filtr?marki=yamaha` - brand filter on all products
- `/produkty/kategoria/wzmacniacze/filtr?page=2` - category pagination
- `/produkty/kategoria/wzmacniacze/filtr?marki=yamaha` - category + brand filter
- `/marki/yamaha/filtr?page=2&cena_min=5000` - brand + pagination + price
- `/marki/yamaha/kategoria/wzmacniacze/filtr?cena_min=10000` - brand + category + price

> **Important**: Category is NEVER a searchParam. It's always part of the URL path. This maximizes static page usage.

---

## Navigation Flow Logic

### Products Section (`/produkty/`)

| Current Route                         | User Action        | Destination                           | Type   |
| ------------------------------------- | ------------------ | ------------------------------------- | ------ |
| `/produkty/`                          | Click category     | `/produkty/kategoria/X`               | Static |
| `/produkty/`                          | Click brand filter | `/produkty/filtr?marki=X`             | PPR    |
| `/produkty/`                          | Click page 2       | `/produkty/filtr?page=2`              | PPR    |
| `/produkty/filtr?marki=X`             | Click category     | `/produkty/kategoria/X/filtr?marki=X` | PPR    |
| `/produkty/filtr?marki=X`             | Clear brand        | `/produkty/`                          | Static |
| `/produkty/kategoria/X`               | Click brand filter | `/produkty/kategoria/X/filtr?marki=Y` | PPR    |
| `/produkty/kategoria/X`               | Click page 2       | `/produkty/kategoria/X/filtr?page=2`  | PPR    |
| `/produkty/kategoria/X/filtr?marki=Y` | Clear brand        | `/produkty/kategoria/X`               | Static |
| `/produkty/kategoria/X/filtr?marki=Y` | Change category    | `/produkty/kategoria/Z/filtr?marki=Y` | PPR    |
| `/produkty/kategoria/X/filtr?marki=Y` | Clear category     | `/produkty/filtr?marki=Y`             | PPR    |

### Brand Section (`/marki/`)

| Current Route                                   | User Action        | Destination                                     | Type   |
| ----------------------------------------------- | ------------------ | ----------------------------------------------- | ------ |
| `/marki/yamaha/`                                | Click category     | `/marki/yamaha/kategoria/X`                     | Static |
| `/marki/yamaha/`                                | Click price filter | `/marki/yamaha/filtr?cena_min=5000`             | PPR    |
| `/marki/yamaha/`                                | Click page 2       | `/marki/yamaha/filtr?page=2`                    | PPR    |
| `/marki/yamaha/kategoria/X`                     | Click price filter | `/marki/yamaha/kategoria/X/filtr?cena_min=5000` | PPR    |
| `/marki/yamaha/kategoria/X`                     | Click page 2       | `/marki/yamaha/kategoria/X/filtr?page=2`        | PPR    |
| `/marki/yamaha/kategoria/X/filtr?cena_min=5000` | Clear price        | `/marki/yamaha/kategoria/X`                     | Static |
| `/marki/yamaha/filtr?cena_min=5000`             | Click category     | `/marki/yamaha/kategoria/X/filtr?cena_min=5000` | PPR    |

### Clear Filters Logic

| Scenario                         | Action             | Result                                            |
| -------------------------------- | ------------------ | ------------------------------------------------- |
| On `/filtr` with only pagination | Clear pagination   | Go to parent static route                         |
| On `/filtr` with brand filter    | Clear brand        | Stay on `/filtr` if other filters, else go static |
| On `/filtr` with all filters     | "Clear all" button | Go to base static route                           |
| On `/kategoria/X/filtr?...`      | Clear all filters  | Go to `/kategoria/X` (static)                     |

---

## Phase 2: File Structure Changes

### Task 2.1: New File Structure

```
apps/web/src/app/
├── produkty/
│   ├── (listing)/                      # Route group for shared layout
│   │   ├── page.tsx                    # Static: /produkty/ (1 page, NO Suspense)
│   │   ├── filtr/
│   │   │   └── page.tsx                # PPR: /produkty/filtr?... (with Suspense)
│   │   └── kategoria/
│   │       └── [category]/
│   │           ├── page.tsx            # Static: /produkty/kategoria/{category} (~40 pages, NO Suspense)
│   │           └── filtr/
│   │               └── page.tsx        # PPR: /produkty/kategoria/{category}/filtr?... (with Suspense)
│   └── [slug]/
│       └── page.tsx                    # Product detail (unchanged, ~1000 pages)
│
├── marki/
│   ├── page.tsx                        # Brands listing (unchanged)
│   └── [slug]/
│       ├── page.tsx                    # Static: /marki/{brand}/ (~35 pages, NO Suspense)
│       ├── filtr/
│       │   └── page.tsx                # PPR: /marki/{brand}/filtr?... (with Suspense)
│       └── kategoria/
│           └── [category]/
│               ├── page.tsx            # Static: /marki/{brand}/kategoria/{category} (NO Suspense)
│               │                       # (~150-200 valid combinations only)
│               └── filtr/
│                   └── page.tsx        # PPR: /marki/{brand}/kategoria/{category}/filtr?... (with Suspense)
```

### Key Architecture Difference

| Route Type                                  | Suspense | SearchParams                | Rendering                      |
| ------------------------------------------- | -------- | --------------------------- | ------------------------------ |
| Static (`/produkty/`, `/kategoria/X`, etc.) | ❌ No    | ❌ None                     | Fully rendered at build        |
| Filter (`/filtr?...`)                       | ✅ Yes   | ✅ All filters + pagination | PPR (static shell + streaming) |

### Task 2.2: Shared Components Location

The existing `ProductsListing` component will be reused, but we'll create variants:

```
apps/web/src/components/products/
├── ProductsListing/
│   ├── index.tsx                       # Main component (modify to accept props)
│   ├── ProductsListingStatic.tsx       # NEW: Static variant (no searchParams)
│   └── ProductsListingDynamic.tsx      # NEW: Dynamic variant (with searchParams)
```

---

## Phase 3: Static Route Implementation

### Task 3.1: Static Products Page (`/produkty/`)

**File**: `apps/web/src/app/produkty/(listing)/page.tsx`

This page is **fully static** - NO Suspense, NO searchParams. Everything is rendered at build time.

```typescript
import { notFound } from "next/navigation";

import { ProductsGridStatic } from "@/components/products/ProductsListing/ProductsGridStatic";
import { ProductsSidebarStatic } from "@/components/products/ProductsListing/ProductsSidebarStatic";
import { sanityFetch } from "@/global/sanity/fetch";
import {
  queryProductsPageContent,
  queryProductsStatic,
  allProductsFilterMetadata,
} from "@/global/sanity/query";

export async function generateMetadata() {
  const content = await sanityFetch({
    query: queryProductsPageContent,
    tags: ["products"],
  });

  return {
    title: content?.seo?.title || "Produkty | Audiofast",
    description: content?.seo?.description,
  };
}

export default async function ProductsPage() {
  // Fetch everything at build time - no streaming, no Suspense
  const [content, products, filterMetadata] = await Promise.all([
    sanityFetch({
      query: queryProductsPageContent,
      tags: ["products"],
    }),
    sanityFetch({
      query: queryProductsStatic,
      params: { category: "", brandSlug: "", limit: 12 },
      tags: ["product"],
    }),
    sanityFetch({
      query: allProductsFilterMetadata,
      tags: ["product"],
    }),
  ]);

  if (!content) {
    return notFound();
  }

  return (
    <main id="main">
      {/* Hero/header section */}
      {content.hero && <ProductsHero hero={content.hero} />}

      <div className="productsListing">
        {/* Sidebar with navigation links (no interactive filtering) */}
        <ProductsSidebarStatic
          filterMetadata={filterMetadata}
          filterUrl="/produkty/filtr"
          categoryBaseUrl="/produkty/kategoria"
        />

        <div className="productsContent">
          {/* Products grid - first page only, static */}
          <ProductsGridStatic products={products.products} />

          {/* Pagination links to /filtr route */}
          {products.totalCount > 12 && (
            <PaginationLink
              href="/produkty/filtr?page=2"
              totalPages={Math.ceil(products.totalCount / 12)}
            />
          )}
        </div>
      </div>
    </main>
  );
}
```

> **Key differences from current implementation:**
>
> - **NO Suspense** - everything renders at build time
> - **NO searchParams** - pagination links go to `/filtr?page=2`
> - **Static sidebar** - filter clicks navigate to `/filtr` routes
> - **First page only** - subsequent pages are on `/filtr` route

### Task 3.2: Static Category Page (`/produkty/kategoria/{category}`)

**File**: `apps/web/src/app/produkty/(listing)/kategoria/[category]/page.tsx`

This page is **fully static** - NO Suspense, NO searchParams.

```typescript
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";

import { ProductsGridStatic } from "@/components/products/ProductsListing/ProductsGridStatic";
import { ProductsSidebarStatic } from "@/components/products/ProductsListing/ProductsSidebarStatic";
import { sanityFetch } from "@/global/sanity/fetch";
import {
  queryAllCategorySlugs,
  queryCategoryBySlug,
  queryProductsStatic,
  allProductsFilterMetadata,
} from "@/global/sanity/query";

// Generate all category pages at build time
export async function generateStaticParams() {
  "use cache";
  cacheTag("productCategorySub");
  cacheLife("max");

  const categories = await sanityFetch<Array<{ slug: string }>>({
    query: queryAllCategorySlugs,
    tags: ["productCategorySub"],
  });

  return categories.map((cat) => ({
    category: cat.slug,
  }));
}

type Props = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { category } = await params;

  const categoryData = await sanityFetch({
    query: queryCategoryBySlug,
    params: { slug: category },
    tags: ["productCategorySub"],
  });

  if (!categoryData) {
    return { title: "Kategoria nie znaleziona" };
  }

  return {
    title: categoryData.seo?.title || `${categoryData.name} | Audiofast`,
    description: categoryData.seo?.description || `Produkty w kategorii ${categoryData.name}`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;

  // Fetch everything at build time - no streaming, no Suspense
  const [categoryData, products, filterMetadata] = await Promise.all([
    sanityFetch({
      query: queryCategoryBySlug,
      params: { slug: category },
      tags: ["productCategorySub"],
    }),
    sanityFetch({
      query: queryProductsStatic,
      params: { category, brandSlug: "", limit: 12 },
      tags: ["product"],
    }),
    sanityFetch({
      query: allProductsFilterMetadata,
      tags: ["product"],
    }),
  ]);

  if (!categoryData) {
    return notFound();
  }

  return (
    <main id="main">
      {/* Category header */}
      <CategoryHeader category={categoryData} />

      <div className="productsListing">
        {/* Sidebar - filter clicks go to /filtr route */}
        <ProductsSidebarStatic
          filterMetadata={filterMetadata}
          currentCategory={category}
          filterUrl={`/produkty/kategoria/${category}/filtr`}
          categoryBaseUrl="/produkty/kategoria"
        />

        <div className="productsContent">
          {/* Products grid - first page only */}
          <ProductsGridStatic products={products.products} />

          {/* Pagination links to /filtr route */}
          {products.totalCount > 12 && (
            <PaginationLink
              href={`/produkty/kategoria/${category}/filtr?page=2`}
              totalPages={Math.ceil(products.totalCount / 12)}
            />
          )}
        </div>
      </div>
    </main>
  );
}
```

### Task 3.3: Static Brand Page (`/marki/{brand}/`)

**File**: `apps/web/src/app/marki/[slug]/page.tsx`

This page is **fully static** - NO Suspense, NO searchParams.

```typescript
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";

import { ProductsGridStatic } from "@/components/products/ProductsListing/ProductsGridStatic";
import { ProductsSidebarStatic } from "@/components/products/ProductsListing/ProductsSidebarStatic";
import { sanityFetch } from "@/global/sanity/fetch";
import {
  queryBrandBySlug,
  queryAllBrandSlugs,
  queryProductsStatic,
  allProductsFilterMetadata,
} from "@/global/sanity/query";

// Generate all brand pages at build time
export async function generateStaticParams() {
  "use cache";
  cacheTag("brand");
  cacheLife("max");

  const brands = await sanityFetch<Array<{ slug: string }>>({
    query: queryAllBrandSlugs,
    tags: ["brand"],
  });

  return brands.map((brand) => ({
    slug: brand.slug,
  }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;

  const brandData = await sanityFetch({
    query: queryBrandBySlug,
    params: { slug },
    tags: ["brand"],
  });

  if (!brandData) {
    return { title: "Marka nie znaleziona" };
  }

  return {
    title: brandData.seo?.title || `${brandData.name} | Audiofast`,
    description: brandData.seo?.description || `Produkty marki ${brandData.name}`,
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;

  // Fetch everything at build time - no streaming, no Suspense
  const [brandData, products, filterMetadata] = await Promise.all([
    sanityFetch({
      query: queryBrandBySlug,
      params: { slug },
      tags: ["brand"],
    }),
    sanityFetch({
      query: queryProductsStatic,
      params: { category: "", brandSlug: slug, limit: 12 },
      tags: ["product"],
    }),
    sanityFetch({
      query: allProductsFilterMetadata,
      tags: ["product"],
    }),
  ]);

  if (!brandData) {
    return notFound();
  }

  return (
    <main id="main">
      {/* Brand header */}
      <BrandHeader brand={brandData} />

      <div className="productsListing">
        {/* Sidebar - category links go to /kategoria, filters go to /filtr */}
        <ProductsSidebarStatic
          filterMetadata={filterMetadata}
          currentBrand={slug}
          filterUrl={`/marki/${slug}/filtr`}
          categoryBaseUrl={`/marki/${slug}/kategoria`}
        />

        <div className="productsContent">
          {/* Products grid - first page only */}
          <ProductsGridStatic products={products.products} />

          {/* Pagination links to /filtr route */}
          {products.totalCount > 12 && (
            <PaginationLink
              href={`/marki/${slug}/filtr?page=2`}
              totalPages={Math.ceil(products.totalCount / 12)}
            />
          )}
        </div>
      </div>
    </main>
  );
}
```

### Task 3.4: Static Brand + Category Page (Valid Combinations Only)

**File**: `apps/web/src/app/marki/[slug]/kategoria/[category]/page.tsx`

This page is **fully static** - NO Suspense, NO searchParams. Only generates pages for valid brand+category combinations.

```typescript
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";

import { ProductsGridStatic } from "@/components/products/ProductsListing/ProductsGridStatic";
import { ProductsSidebarStatic } from "@/components/products/ProductsListing/ProductsSidebarStatic";
import { sanityFetch } from "@/global/sanity/fetch";
import {
  queryBrandBySlug,
  queryCategoryBySlug,
  queryProductsStatic,
  queryValidBrandCategoryCombinations,
  allProductsFilterMetadata,
} from "@/global/sanity/query";

// Generate ONLY valid brand+category combinations at build time
export async function generateStaticParams() {
  "use cache";
  cacheTag("product", "brand", "productCategorySub");
  cacheLife("max");

  const validCombinations = await sanityFetch<
    Array<{ brandSlug: string; categorySlug: string }>
  >({
    query: queryValidBrandCategoryCombinations,
    tags: ["product"],
  });

  // Return only combinations that have products (~150-200 instead of 1400+)
  return validCombinations.map((combo) => ({
    slug: combo.brandSlug,
    category: combo.categorySlug,
  }));
}

type Props = {
  params: Promise<{ slug: string; category: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug, category } = await params;

  const [brandData, categoryData] = await Promise.all([
    sanityFetch({
      query: queryBrandBySlug,
      params: { slug },
      tags: ["brand"],
    }),
    sanityFetch({
      query: queryCategoryBySlug,
      params: { slug: category },
      tags: ["productCategorySub"],
    }),
  ]);

  if (!brandData || !categoryData) {
    return { title: "Nie znaleziono" };
  }

  return {
    title: `${brandData.name} - ${categoryData.name} | Audiofast`,
    description: `Produkty marki ${brandData.name} w kategorii ${categoryData.name}. Sprawdź naszą ofertę.`,
  };
}

export default async function BrandCategoryPage({ params }: Props) {
  const { slug, category } = await params;

  // Fetch everything at build time - no streaming, no Suspense
  const [brandData, categoryData, products, filterMetadata] = await Promise.all([
    sanityFetch({
      query: queryBrandBySlug,
      params: { slug },
      tags: ["brand"],
    }),
    sanityFetch({
      query: queryCategoryBySlug,
      params: { slug: category },
      tags: ["productCategorySub"],
    }),
    sanityFetch({
      query: queryProductsStatic,
      params: { category, brandSlug: slug, limit: 12 },
      tags: ["product"],
    }),
    sanityFetch({
      query: allProductsFilterMetadata,
      tags: ["product"],
    }),
  ]);

  if (!brandData || !categoryData) {
    return notFound();
  }

  return (
    <main id="main">
      {/* Brand + Category header */}
      <BrandCategoryHeader brand={brandData} category={categoryData} />

      <div className="productsListing">
        {/* Sidebar - filters go to /filtr route */}
        <ProductsSidebarStatic
          filterMetadata={filterMetadata}
          currentBrand={slug}
          currentCategory={category}
          filterUrl={`/marki/${slug}/kategoria/${category}/filtr`}
          categoryBaseUrl={`/marki/${slug}/kategoria`}
        />

        <div className="productsContent">
          {/* Products grid - first page only */}
          <ProductsGridStatic products={products.products} />

          {/* Pagination links to /filtr route */}
          {products.totalCount > 12 && (
            <PaginationLink
              href={`/marki/${slug}/kategoria/${category}/filtr?page=2`}
              totalPages={Math.ceil(products.totalCount / 12)}
            />
          )}
        </div>
      </div>
    </main>
  );
}
```

### Task 3.5: Query for Valid Brand+Category Combinations

**File**: `apps/web/src/global/sanity/query.ts`

Add this query to efficiently find which brand+category pairs have products:

```typescript
// Query to get all valid brand+category combinations (where products exist)
// Used by generateStaticParams to avoid generating empty pages
// Returns ~150-200 combinations instead of 1400+ theoretical combinations
export const queryValidBrandCategoryCombinations = defineQuery(`
  array::unique(
    *[_type == "product" 
      && defined(brand) 
      && count(categories) > 0 
      && isArchived != true
    ]{
      "brandSlug": string::split(brand->slug.current, "/")[2],
      "categorySlug": categories[0]->slug.current
    }
  )
`);
```

> **Why this approach?**
>
> - Queries actual products to find valid combinations
> - Returns unique pairs only (no duplicates)
> - Filters out archived products
> - Result is ~150-200 combinations vs 1400+ if we did brands × categories
> - Build time stays reasonable (~10-12 min instead of 30+ min)

---

## Phase 4: Dynamic Filter Routes (PPR)

All filter routes use **PPR (Partial Pre-Rendering)**:

- Static shell (header, sidebar structure) is pre-rendered
- Dynamic content (products list) streams via Suspense
- All searchParams are handled (filters, pagination, sorting)

### Task 4.1: Products Filter Page (`/produkty/filtr`)

**File**: `apps/web/src/app/produkty/(listing)/filtr/page.tsx`

This is the filter route for ALL products (no category). Categories in sidebar link to `/produkty/kategoria/X/filtr?...` to preserve current filters.

```typescript
import { Suspense } from "react";

import { ProductsListingDynamic } from "@/components/products/ProductsListing/ProductsListingDynamic";
import { ProductsListingSkeleton } from "@/components/products/ProductsListing/ProductsListingSkeleton";
import { sanityFetch } from "@/global/sanity/fetch";
import { allProductsFilterMetadata } from "@/global/sanity/query";

export const experimental_ppr = true;

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams;

  const filters: string[] = [];
  if (params.marki) filters.push(`Marka: ${params.marki}`);
  if (params.page) filters.push(`Strona ${params.page}`);
  if (params.cena_min || params.cena_max) filters.push("Filtr cenowy");

  return {
    title: filters.length > 0 ? `Produkty - ${filters.join(", ")}` : "Produkty - Filtr",
    robots: { index: false },
  };
}

export default async function ProductsFilterPage({ searchParams }: Props) {
  const filterMetadata = await sanityFetch({
    query: allProductsFilterMetadata,
    tags: ["product"],
  });

  return (
    <main id="main">
      <FilterHeader backUrl="/produkty/" title="Produkty" />

      <div className="productsListing">
        {/* Sidebar - category clicks go to /produkty/kategoria/X/filtr with current filters */}
        <ProductsSidebarDynamic
          filterMetadata={filterMetadata}
          searchParams={searchParams}
          baseFilterUrl="/produkty/filtr"
          categoryBaseUrl="/produkty/kategoria"
          categoryFilterSuffix="/filtr"  // Append /filtr + searchParams when clicking category
        />

        <Suspense fallback={<ProductsListingSkeleton />}>
          <ProductsListingDynamic
            searchParams={searchParams}
            baseUrl="/produkty/filtr"
            backUrl="/produkty/"
          />
        </Suspense>
      </div>
    </main>
  );
}
```

> **Note**: When user clicks a category from this page, they go to `/produkty/kategoria/X/filtr?marki=Y` (preserving brand filter), NOT `/produkty/filtr?kategoria=X`.

### Task 4.2: Category Filter Page (`/produkty/kategoria/{category}/filtr`)

**File**: `apps/web/src/app/produkty/(listing)/kategoria/[category]/filtr/page.tsx`

Category is in the URL path. Only brand, price, pagination, etc. are searchParams.

```typescript
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ProductsListingDynamic } from "@/components/products/ProductsListing/ProductsListingDynamic";
import { ProductsListingSkeleton } from "@/components/products/ProductsListing/ProductsListingSkeleton";
import { sanityFetch } from "@/global/sanity/fetch";
import { queryCategoryBySlug, allProductsFilterMetadata } from "@/global/sanity/query";

export const experimental_ppr = true;

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { category } = await params;
  const filterParams = await searchParams;

  const categoryData = await sanityFetch({
    query: queryCategoryBySlug,
    params: { slug: category },
    tags: ["productCategorySub"],
  });

  const filters: string[] = [];
  if (filterParams.marki) filters.push(`Marka: ${filterParams.marki}`);
  if (filterParams.page) filters.push(`Strona ${filterParams.page}`);

  return {
    title: filters.length > 0
      ? `${categoryData?.name} - ${filters.join(", ")}`
      : `${categoryData?.name} - Filtr`,
    robots: { index: false },
  };
}

export default async function CategoryFilterPage({ params, searchParams }: Props) {
  const { category } = await params;

  const [categoryData, filterMetadata] = await Promise.all([
    sanityFetch({
      query: queryCategoryBySlug,
      params: { slug: category },
      tags: ["productCategorySub"],
    }),
    sanityFetch({
      query: allProductsFilterMetadata,
      tags: ["product"],
    }),
  ]);

  if (!categoryData) {
    return notFound();
  }

  return (
    <main id="main">
      <FilterHeader backUrl={`/produkty/kategoria/${category}`} title={categoryData.name} />

      <div className="productsListing">
        {/* Category switching: /produkty/kategoria/OTHER/filtr?marki=X preserves brand filter */}
        <ProductsSidebarDynamic
          filterMetadata={filterMetadata}
          searchParams={searchParams}
          currentCategory={category}
          baseFilterUrl={`/produkty/kategoria/${category}/filtr`}
          categoryBaseUrl="/produkty/kategoria"
          categoryFilterSuffix="/filtr"
          clearCategoryUrl="/produkty/filtr"  // Clearing category goes to /produkty/filtr with filters
        />

        <Suspense fallback={<ProductsListingSkeleton />}>
          <ProductsListingDynamic
            searchParams={searchParams}
            category={category}
            baseUrl={`/produkty/kategoria/${category}/filtr`}
            backUrl={`/produkty/kategoria/${category}`}
          />
        </Suspense>
      </div>
    </main>
  );
}
```

> **Navigation from this page:**
>
> - Change category → `/produkty/kategoria/OTHER/filtr?marki=X` (preserves brand)
> - Clear category → `/produkty/filtr?marki=X` (preserves brand, removes category from path)
> - Clear all filters → `/produkty/kategoria/{category}` (static)

### Task 4.3: Brand Filter Page (`/marki/{brand}/filtr`)

**File**: `apps/web/src/app/marki/[slug]/filtr/page.tsx`

Brand is in the URL path. Category clicks go to `/marki/{brand}/kategoria/X/filtr?...`.

```typescript
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ProductsListingDynamic } from "@/components/products/ProductsListing/ProductsListingDynamic";
import { ProductsListingSkeleton } from "@/components/products/ProductsListing/ProductsListingSkeleton";
import { sanityFetch } from "@/global/sanity/fetch";
import { queryBrandBySlug, allProductsFilterMetadata } from "@/global/sanity/query";

export const experimental_ppr = true;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  const filterParams = await searchParams;

  const brandData = await sanityFetch({
    query: queryBrandBySlug,
    params: { slug },
    tags: ["brand"],
  });

  const filters: string[] = [];
  if (filterParams.page) filters.push(`Strona ${filterParams.page}`);
  if (filterParams.cena_min || filterParams.cena_max) filters.push("Filtr cenowy");

  return {
    title: filters.length > 0
      ? `${brandData?.name} - ${filters.join(", ")}`
      : `${brandData?.name} - Filtr`,
    robots: { index: false },
  };
}

export default async function BrandFilterPage({ params, searchParams }: Props) {
  const { slug } = await params;

  const [brandData, filterMetadata] = await Promise.all([
    sanityFetch({
      query: queryBrandBySlug,
      params: { slug },
      tags: ["brand"],
    }),
    sanityFetch({
      query: allProductsFilterMetadata,
      tags: ["product"],
    }),
  ]);

  if (!brandData) {
    return notFound();
  }

  return (
    <main id="main">
      <FilterHeader backUrl={`/marki/${slug}/`} title={brandData.name} />

      <div className="productsListing">
        {/* Category clicks go to /marki/{brand}/kategoria/X/filtr with current filters */}
        <ProductsSidebarDynamic
          filterMetadata={filterMetadata}
          searchParams={searchParams}
          currentBrand={slug}
          baseFilterUrl={`/marki/${slug}/filtr`}
          categoryBaseUrl={`/marki/${slug}/kategoria`}
          categoryFilterSuffix="/filtr"
        />

        <Suspense fallback={<ProductsListingSkeleton />}>
          <ProductsListingDynamic
            searchParams={searchParams}
            brandSlug={slug}
            baseUrl={`/marki/${slug}/filtr`}
            backUrl={`/marki/${slug}/`}
          />
        </Suspense>
      </div>
    </main>
  );
}
```

> **Navigation from this page:**
>
> - Click category → `/marki/{brand}/kategoria/X/filtr?cena_min=5000` (preserves price filter)
> - Clear all filters → `/marki/{brand}/` (static)

### Task 4.4: Brand + Category Filter Page (`/marki/{brand}/kategoria/{category}/filtr`)

**File**: `apps/web/src/app/marki/[slug]/kategoria/[category]/filtr/page.tsx`

Both brand and category are in the URL path. Only price, pagination, custom filters are searchParams.

```typescript
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ProductsListingDynamic } from "@/components/products/ProductsListing/ProductsListingDynamic";
import { ProductsListingSkeleton } from "@/components/products/ProductsListing/ProductsListingSkeleton";
import { sanityFetch } from "@/global/sanity/fetch";
import {
  queryBrandBySlug,
  queryCategoryBySlug,
  allProductsFilterMetadata,
} from "@/global/sanity/query";

export const experimental_ppr = true;

type Props = {
  params: Promise<{ slug: string; category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug, category } = await params;
  const filterParams = await searchParams;

  const [brandData, categoryData] = await Promise.all([
    sanityFetch({
      query: queryBrandBySlug,
      params: { slug },
      tags: ["brand"],
    }),
    sanityFetch({
      query: queryCategoryBySlug,
      params: { slug: category },
      tags: ["productCategorySub"],
    }),
  ]);

  const filters: string[] = [];
  if (filterParams.page) filters.push(`Strona ${filterParams.page}`);
  if (filterParams.cena_min || filterParams.cena_max) filters.push("Filtr cenowy");

  return {
    title: filters.length > 0
      ? `${brandData?.name} ${categoryData?.name} - ${filters.join(", ")}`
      : `${brandData?.name} ${categoryData?.name} - Filtr`,
    robots: { index: false },
  };
}

export default async function BrandCategoryFilterPage({ params, searchParams }: Props) {
  const { slug, category } = await params;

  const [brandData, categoryData, filterMetadata] = await Promise.all([
    sanityFetch({
      query: queryBrandBySlug,
      params: { slug },
      tags: ["brand"],
    }),
    sanityFetch({
      query: queryCategoryBySlug,
      params: { slug: category },
      tags: ["productCategorySub"],
    }),
    sanityFetch({
      query: allProductsFilterMetadata,
      tags: ["product"],
    }),
  ]);

  if (!brandData || !categoryData) {
    return notFound();
  }

  return (
    <main id="main">
      <FilterHeader
        backUrl={`/marki/${slug}/kategoria/${category}`}
        title={`${brandData.name} - ${categoryData.name}`}
      />

      <div className="productsListing">
        {/* Category switching: /marki/{brand}/kategoria/OTHER/filtr?cena_min=X */}
        <ProductsSidebarDynamic
          filterMetadata={filterMetadata}
          searchParams={searchParams}
          currentBrand={slug}
          currentCategory={category}
          baseFilterUrl={`/marki/${slug}/kategoria/${category}/filtr`}
          categoryBaseUrl={`/marki/${slug}/kategoria`}
          categoryFilterSuffix="/filtr"
          clearCategoryUrl={`/marki/${slug}/filtr`}
        />

        <Suspense fallback={<ProductsListingSkeleton />}>
          <ProductsListingDynamic
            searchParams={searchParams}
            brandSlug={slug}
            category={category}
            baseUrl={`/marki/${slug}/kategoria/${category}/filtr`}
            backUrl={`/marki/${slug}/kategoria/${category}`}
          />
        </Suspense>
      </div>
    </main>
  );
}
```

> **Navigation from this page:**
>
> - Change category → `/marki/{brand}/kategoria/OTHER/filtr?cena_min=X` (preserves price filter)
> - Clear category → `/marki/{brand}/filtr?cena_min=X` (preserves price, removes category)
> - Clear all filters → `/marki/{brand}/kategoria/{category}` (static)

---

## Phase 5: Component Updates

### Task 5.1: Create ProductsListingStatic Component

**File**: `apps/web/src/components/products/ProductsListing/ProductsListingStatic.tsx`

This component fetches and displays products without searchParams (for static routes).

```typescript
import { sanityFetch } from "@/global/sanity/fetch";
import { getProductsListingQuery } from "@/global/sanity/query";
import type { QueryProductsListingNewestResult } from "@/global/sanity/sanity.types";

import { ProductsGrid } from "./ProductsGrid";
import { ProductsSidebar } from "./ProductsSidebar";
import { Pagination } from "./Pagination";

type Props = {
  category?: string;
  brandSlug?: string;
  filterMetadata: any;
  filterUrl: string;
  categoryBaseUrl: string;
  page?: number;
};

export async function ProductsListingStatic({
  category = "",
  brandSlug,
  filterMetadata,
  filterUrl,
  categoryBaseUrl,
  page = 1,
}: Props) {
  const limit = 12;
  const offset = (page - 1) * limit;

  // Fetch products with minimal filters (category and/or brand only)
  const query = getProductsListingQuery("newest");

  const productsData = await sanityFetch<QueryProductsListingNewestResult>({
    query,
    params: {
      category,
      search: "",
      offset,
      limit,
      brands: brandSlug ? [brandSlug] : [],
      minPrice: 0,
      maxPrice: 999999999,
      customFilters: [],
      rangeFilters: [],
      isCPO: false,
      embeddingResults: [],
    },
    tags: ["product"],
  });

  const { products, totalCount } = productsData;
  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="productsListing">
      <ProductsSidebar
        filterMetadata={filterMetadata}
        filterUrl={filterUrl}
        categoryBaseUrl={categoryBaseUrl}
        currentCategory={category}
        mode="navigation" // Links instead of in-place filtering
      />

      <div className="productsContent">
        <ProductsGrid products={products} />

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl={filterUrl}
        />
      </div>
    </div>
  );
}
```

### Task 5.2: Create ProductsListingDynamic Component

**File**: `apps/web/src/components/products/ProductsListing/ProductsListingDynamic.tsx`

This is similar to the current ProductsListing but specifically for filter routes.

```typescript
import { sanityFetch, sanityFetchDynamic } from "@/global/sanity/fetch";
import { getProductsListingQuery } from "@/global/sanity/query";
import { fetchEmbeddings } from "@/global/sanity/embeddings";
import type { QueryProductsListingNewestResult } from "@/global/sanity/sanity.types";

import { ProductsGrid } from "./ProductsGrid";
import { ProductsSidebar } from "./ProductsSidebar";
import { Pagination } from "./Pagination";
import { ActiveFilters } from "./ActiveFilters";
import { parseSearchParams, buildFilterParams } from "./utils";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  brandSlug?: string;
  filterMetadata: any;
  baseUrl: string;
  backUrl: string;
};

export async function ProductsListingDynamic({
  searchParams,
  brandSlug,
  filterMetadata,
  baseUrl,
  backUrl,
}: Props) {
  const params = await searchParams;

  // Parse all filter parameters from URL
  const {
    page,
    sortBy,
    category,
    brands,
    minPrice,
    maxPrice,
    customFilters,
    rangeFilters,
    isCPO,
    search,
  } = parseSearchParams(params);

  const limit = 12;
  const offset = (page - 1) * limit;

  // Handle brand from route param or searchParams
  const effectiveBrands = brandSlug ? [brandSlug] : brands;

  // Fetch embeddings if search exists
  const embeddingResults = search
    ? (await fetchEmbeddings(search, "products")) || []
    : [];

  // Fetch products with all filters
  const query = getProductsListingQuery(sortBy);

  const productsData = await sanityFetchDynamic<QueryProductsListingNewestResult>({
    query,
    params: {
      category: category || "",
      search: search || "",
      offset,
      limit,
      brands: effectiveBrands,
      minPrice,
      maxPrice,
      customFilters,
      rangeFilters,
      isCPO,
      embeddingResults,
    },
  });

  const { products, totalCount } = productsData;
  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="productsListing">
      <ProductsSidebar
        filterMetadata={filterMetadata}
        baseUrl={baseUrl}
        currentFilters={params}
        mode="interactive" // Updates searchParams in place
      />

      <div className="productsContent">
        {/* Show active filters with clear buttons */}
        <ActiveFilters
          filters={params}
          baseUrl={baseUrl}
          backUrl={backUrl}
        />

        <ProductsGrid products={products} />

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl={baseUrl}
          preserveParams={params}
        />
      </div>
    </div>
  );
}
```

### Task 5.3: Update ProductsSidebar for Navigation Mode

**File**: `apps/web/src/components/products/ProductsListing/ProductsSidebar.tsx`

The sidebar needs to work in two modes:

1. **Navigation mode** (static pages): Clicking a filter navigates to `/filtr` route
2. **Interactive mode** (filter pages): Clicking a filter updates searchParams

```typescript
type ProductsSidebarProps = {
  filterMetadata: any;
  filterUrl?: string;       // For navigation mode
  categoryBaseUrl?: string; // For category links
  baseUrl?: string;         // For interactive mode
  currentFilters?: Record<string, string | string[] | undefined>;
  currentCategory?: string;
  mode: "navigation" | "interactive";
};

export function ProductsSidebar({
  filterMetadata,
  filterUrl,
  categoryBaseUrl,
  baseUrl,
  currentFilters,
  currentCategory,
  mode,
}: ProductsSidebarProps) {
  return (
    <aside className="productsSidebar">
      {/* Categories - always links */}
      <CategoryFilter
        categories={filterMetadata.categories}
        currentCategory={currentCategory}
        baseUrl={categoryBaseUrl}
      />

      {/* Brands */}
      <BrandFilter
        brands={filterMetadata.brands}
        selectedBrands={currentFilters?.marki}
        mode={mode}
        filterUrl={filterUrl}
        baseUrl={baseUrl}
      />

      {/* Price range */}
      <PriceFilter
        minPrice={currentFilters?.cena_min}
        maxPrice={currentFilters?.cena_max}
        mode={mode}
        filterUrl={filterUrl}
        baseUrl={baseUrl}
      />

      {/* Custom filters */}
      {filterMetadata.customFilters?.map((filter) => (
        <CustomFilter
          key={filter.name}
          filter={filter}
          selectedValues={currentFilters?.[filter.slug]}
          mode={mode}
          filterUrl={filterUrl}
          baseUrl={baseUrl}
        />
      ))}
    </aside>
  );
}
```

### Task 5.4: Create Filter Navigation Utilities

**File**: `apps/web/src/components/products/ProductsListing/utils.ts`

```typescript
/**
 * Build a filter URL with the given parameters
 */
export function buildFilterUrl(
  baseUrl: string,
  filters: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') continue;

    if (Array.isArray(value)) {
      // Multiple values: marki=yamaha,audioquest
      params.set(key, value.join(','));
    } else {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Parse search params into typed filter object
 */
export function parseSearchParams(
  params: Record<string, string | string[] | undefined>
) {
  return {
    page: parseInt(String(params.page || '1'), 10),
    sortBy: String(params.sortowanie || 'newest'),
    category: String(params.kategoria || ''),
    brands: params.marki ? String(params.marki).split(',').filter(Boolean) : [],
    minPrice: parseInt(String(params.cena_min || '0'), 10),
    maxPrice: parseInt(String(params.cena_max || '999999999'), 10),
    customFilters: parseCustomFilters(params),
    rangeFilters: parseRangeFilters(params),
    isCPO: params.cpo === 'true',
    search: String(params.szukaj || ''),
  };
}

/**
 * Parse custom filter params (e.g., kolor=czarny,bialy)
 */
function parseCustomFilters(
  params: Record<string, string | string[] | undefined>
): Array<{ filterName: string; value: string }> {
  const customFilters: Array<{ filterName: string; value: string }> = [];

  // Known custom filter keys (should match filter metadata)
  const customFilterKeys = ['kolor', 'dlugosc-kabla', 'material' /* etc */];

  for (const key of customFilterKeys) {
    const value = params[key];
    if (value) {
      const values = String(value).split(',');
      for (const v of values) {
        customFilters.push({ filterName: key, value: v });
      }
    }
  }

  return customFilters;
}
```

---

## Phase 6: Sanity Query Updates

### Task 6.1: Add Missing Queries

**File**: `apps/web/src/global/sanity/query.ts`

```typescript
// Query for all category slugs (for generateStaticParams)
export const queryAllCategorySlugs = defineQuery(`
  *[_type == "productCategorySub" && defined(slug.current)]{
    "slug": slug.current
  }
`);

// Query for all brand slugs (for generateStaticParams)
export const queryAllBrandSlugs = defineQuery(`
  *[_type == "brand" && defined(slug.current)]{
    "slug": string::split(slug.current, "/")[2]
  }
`);

// Query category by slug
export const queryCategoryBySlug = defineQuery(`
  *[_type == "productCategorySub" && slug.current == $slug][0]{
    _id,
    name,
    "slug": slug.current,
    seo,
    description,
    ${imageFragment('image')},
    customFilters[]{
      _key,
      name,
      filterType,
      unit
    }
  }
`);

// Query brand by slug
export const queryBrandBySlug = defineQuery(`
  *[_type == "brand" && slug.current match "*" + $slug + "*"][0]{
    _id,
    name,
    "slug": string::split(slug.current, "/")[2],
    seo,
    description,
    ${imageFragment('logo')},
    ${imageFragment('heroImage')}
  }
`);
```

---

## Phase 7: Revalidation Setup

### Task 7.1: Update Webhook Handler

**File**: `apps/web/src/app/api/revalidate/route.ts`

```typescript
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { _type, _id } = body;

  // Revalidate based on document type
  switch (_type) {
    case 'product':
      // Revalidate all product listing pages
      revalidateTag('product');
      revalidatePath('/produkty', 'layout');
      break;

    case 'brand':
      // Revalidate brand pages
      revalidateTag('brand');
      revalidatePath('/marki', 'layout');
      break;

    case 'productCategorySub':
      // Revalidate category pages
      revalidateTag('productCategorySub');
      revalidatePath('/produkty/kategoria', 'layout');
      break;

    default:
      // Generic revalidation
      revalidateTag(_type);
  }

  return NextResponse.json({ revalidated: true });
}
```

### Task 7.2: Ensure Webhook Includes All Types

In Sanity Dashboard, ensure the webhook filter includes:

```groq
_type in ["product", "brand", "productCategorySub", "productCategoryParent"]
```

---

## Phase 8: Redirects for URL Migration

### Task 8.1: Add Redirects for Old URLs

**File**: `apps/web/next.config.ts`

```typescript
const nextConfig = {
  async redirects() {
    return [
      // Redirect old filter URLs to new structure
      {
        source: '/produkty/',
        has: [
          {
            type: 'query',
            key: 'marki',
          },
        ],
        destination: '/produkty/filtr',
        permanent: false, // Use 307 during migration
      },
      {
        source: '/produkty/',
        has: [
          {
            type: 'query',
            key: 'cena_min',
          },
        ],
        destination: '/produkty/filtr',
        permanent: false,
      },
      // Add more as needed...
    ];
  },
};
```

### Task 8.2: Add Category Redirects

```typescript
// In next.config.ts redirects array
{
  source: "/produkty/",
  has: [
    {
      type: "query",
      key: "kategoria",
      value: "(?<cat>.+)",
    },
  ],
  destination: "/produkty/kategoria/:cat",
  permanent: true,
},
```

---

## Phase 9: Testing Strategy

### Task 9.1: Test Checklist

**Static Routes:**

- [ ] `/produkty/` loads instantly (CDN cached)
- [ ] `/produkty/kategoria/{category}` loads instantly
- [ ] `/marki/{brand}/` loads instantly
- [ ] `/marki/{brand}/kategoria/{category}` loads instantly
- [ ] Pagination works on static pages
- [ ] All static pages generated at build time

**Filter Routes (PPR):**

- [ ] `/produkty/filtr?marki=X` works with PPR
- [ ] `/marki/{brand}/filtr?kategoria=X` works with PPR
- [ ] Multiple filters work together
- [ ] Price range filter works
- [ ] Custom filters work
- [ ] Search works
- [ ] Sorting works

**Navigation:**

- [ ] Clicking brand filter on static page navigates to `/filtr`
- [ ] Clicking category on static page navigates to `/kategoria/{cat}`
- [ ] "Clear filters" button returns to static page
- [ ] Back button works correctly

**Revalidation:**

- [ ] Publishing product triggers revalidation
- [ ] Updating brand triggers revalidation
- [ ] Updating category triggers revalidation

### Task 9.2: Performance Verification

```bash
# Verify static generation
next build

# Check for static pages in output
# Should see /produkty, /produkty/kategoria/*, /marki/*, etc.

# Verify CDN caching in production
curl -I https://your-domain.com/produkty/
# Should see: cache-control: public, max-age=...
```

---

## Phase 10: Deployment Plan

### Step 1: Create New Routes (Non-breaking)

1. Create all new route files
2. Create new component variants
3. Deploy to staging
4. Test all routes work

### Step 2: Update Redirects

1. Add redirects in `next.config.ts`
2. Test old URLs redirect correctly
3. Deploy redirects

### Step 3: Update Internal Links

1. Update filter components to use new URL structure
2. Update any hardcoded links
3. Deploy link updates

### Step 4: Remove Old Dynamic Behavior

1. Remove searchParams handling from static pages
2. Add `dynamic = "force-static"` to pages
3. Deploy final version

### Step 5: Monitor

1. Check build times
2. Monitor CDN cache hit rates
3. Check for 404s on old URLs
4. Monitor Core Web Vitals

---

## Rollback Plan

If issues arise:

1. **Route rollback**: Remove `force-static`, routes become dynamic again
2. **Redirect rollback**: Remove redirects, old URLs work
3. **Component rollback**: Revert to single ProductsListing component

---

## Estimated Effort

| Phase     | Task                 | Time          |
| --------- | -------------------- | ------------- |
| 1         | Route planning       | 30 min        |
| 2         | File structure       | 30 min        |
| 3         | Static route pages   | 2 hours       |
| 4         | Dynamic filter pages | 1.5 hours     |
| 5         | Component updates    | 2 hours       |
| 6         | Query updates        | 30 min        |
| 7         | Revalidation         | 30 min        |
| 8         | Redirects            | 30 min        |
| 9         | Testing              | 1.5 hours     |
| 10        | Deployment           | 1 hour        |
| **Total** |                      | **~10 hours** |

---

## Files Summary

### New Files

```
apps/web/src/app/
├── produkty/(listing)/
│   ├── filtr/
│   │   └── page.tsx                        # PPR: /produkty/filtr
│   └── kategoria/[category]/
│       ├── page.tsx                        # Static: /produkty/kategoria/{cat} (~40 pages)
│       └── filtr/
│           └── page.tsx                    # PPR: /produkty/kategoria/{cat}/filtr
│
├── marki/[slug]/
│   ├── filtr/
│   │   └── page.tsx                        # PPR: /marki/{brand}/filtr
│   └── kategoria/[category]/
│       ├── page.tsx                        # Static: /marki/{brand}/kategoria/{cat} (~150-200 pages)
│       └── filtr/
│           └── page.tsx                    # PPR: /marki/{brand}/kategoria/{cat}/filtr

apps/web/src/components/products/ProductsListing/
├── ProductsGridStatic.tsx                  # Static grid (no interactivity)
├── ProductsSidebarStatic.tsx               # Static sidebar (navigation links only)
├── ProductsSidebarDynamic.tsx              # Dynamic sidebar (interactive filters)
├── ProductsListingDynamic.tsx              # Dynamic listing (with searchParams)
├── FilterHeader.tsx                        # Header with back button for filter pages
├── PaginationLink.tsx                      # "View more" link to /filtr route
└── utils.ts                                # URL building utilities
```

### Modified Files

```
apps/web/src/app/
├── produkty/(listing)/page.tsx             # Static, NO Suspense, NO searchParams
├── marki/[slug]/page.tsx                   # Static, NO Suspense, NO searchParams

apps/web/src/global/sanity/query.ts         # Add new queries:
│                                           #   - queryAllCategorySlugs
│                                           #   - queryAllBrandSlugs
│                                           #   - queryCategoryBySlug
│                                           #   - queryBrandBySlug
│                                           #   - queryProductsStatic (simplified, first page only)
│                                           #   - queryValidBrandCategoryCombinations

apps/web/src/app/api/revalidate/route.ts    # Extend revalidation for new routes
apps/web/next.config.ts                     # Add redirects for URL migration
```

### Summary: Static vs PPR Routes

| Route                                  | Type   | Suspense | SearchParams |
| -------------------------------------- | ------ | -------- | ------------ |
| `/produkty/`                           | Static | ❌       | ❌           |
| `/produkty/filtr`                      | PPR    | ✅       | ✅           |
| `/produkty/kategoria/{cat}`            | Static | ❌       | ❌           |
| `/produkty/kategoria/{cat}/filtr`      | PPR    | ✅       | ✅           |
| `/marki/{brand}/`                      | Static | ❌       | ❌           |
| `/marki/{brand}/filtr`                 | PPR    | ✅       | ✅           |
| `/marki/{brand}/kategoria/{cat}`       | Static | ❌       | ❌           |
| `/marki/{brand}/kategoria/{cat}/filtr` | PPR    | ✅       | ✅           |

---

## Comparison: SSG vs Denormalization

| Aspect                      | SSG Restructuring | Denormalization       |
| --------------------------- | ----------------- | --------------------- |
| Main routes performance     | ⚡ Instant (CDN)  | 🟢 Fast (300ms)       |
| Filtered routes performance | 🔴 Slow (1.3s)    | 🟢 Fast (300ms)       |
| Implementation time         | ~10 hours         | ~10 hours             |
| Build time impact           | 🔴 Longer         | 🟢 Normal             |
| Sanity changes required     | 🟢 None           | 🔴 Schema + migration |
| URL changes required        | 🔴 Yes            | 🟢 None               |
| Fixes root cause            | ❌ No             | ✅ Yes                |

### Recommendation

**SSG is best when:**

- Most users browse without filtering
- Build time increase is acceptable
- URL structure change is acceptable

**Denormalization is best when:**

- Users frequently use filters
- Consistent performance on all views is important
- You want to fix the root cause

**Hybrid approach:**

- Start with SSG for quick wins on main routes
- Add denormalization later for filtered views
