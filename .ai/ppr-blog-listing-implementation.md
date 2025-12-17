# PPR Blog Listing Implementation Plan

## Overview

This document outlines the implementation plan for converting the blog listing pages (`/blog` and `/blog/kategoria/[category]`) from Server-Side Rendered (SSR) to Partial Pre-rendering (PPR), plus adding a year filtering feature via `searchParams`.

## Current State Analysis

### Current Architecture Issues

Both `page.tsx` files currently:

1. **Await `searchParams` at page level** (forces SSR)

   ```typescript
   const searchParams = await props.searchParams; // Line 48
   ```

2. **Fetch all data based on searchParams** before rendering

   ```typescript
   const blogData = await sanityFetch({
     query: queryBlogPageData,
     params: { category: '', embeddingResults },
     tags: ['blog'],
   });
   ```

3. **Pass articlesByYear to sidebar** - Contains all articles for year navigation (currently only for expanding/collapsing year lists, not filtering)

**Result**: Every page load requires full server round-trip. No static shell, no instant navigation.

### Current Data Flow

```
URL Change → await searchParams → Fetch Embeddings → Fetch from Sanity → Render Page
                     ↓
            ENTIRE PAGE BLOCKED
```

### Files Affected

| File                                                            | Purpose                       |
| --------------------------------------------------------------- | ----------------------------- |
| `apps/web/src/app/blog/(listing)/page.tsx`                      | Main blog listing             |
| `apps/web/src/app/blog/(listing)/kategoria/[category]/page.tsx` | Category-filtered listing     |
| `apps/web/src/components/ui/BlogAside/index.tsx`                | Sidebar with categories/years |
| `apps/web/src/components/blog/BlogListing/index.tsx`            | Article grid (server)         |
| `apps/web/src/global/sanity/query.ts`                           | Sanity GROQ queries           |

### Current BlogAside Behavior

The `BlogAside` component currently:

- Shows category pills with static counts
- Has a "Browse by Year" section that **expands to show article links** (not filter!)
- Users must click individual article links from the expanded year list

**New Requirement**: Clicking a year should **filter the listing** to show only articles from that year, not just expand a list.

---

## Target Architecture

### PPR with Year Filtering

```
┌─────────────────────────────────────────────────────────────────┐
│ BlogPage (PPR - static shell renders instantly)                  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ STATIC SHELL (cached with "use cache")                      │ │
│ │ • Breadcrumbs                                               │ │
│ │ • HeroStatic (title, description, image)                    │ │
│ │ • Categories with counts (static, from query)               │ │
│ │ • Available years list (static, from query)                 │ │
│ │ • PageBuilder sections                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ BlogAsideClient (client component)                          │ │
│ │                                                             │ │
│ │ • Receives: static categories, available years              │ │
│ │ • Reads: URL params client-side (useSearchParams)           │ │
│ │ • Renders: Category pills, Year filter, Search              │ │
│ │ • Year pills now FILTER (add ?year=2024 to URL)             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Suspense fallback={<BlogListingSkeleton />}                 │ │
│ │                                                             │ │
│ │ BlogListing (server component)                              │ │
│ │ • Awaits: searchParams (inside Suspense)                    │ │
│ │ • Filters: by category, search, AND year                    │ │
│ │ • Only this shows skeleton on filter changes                │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Static shell prerendered** - Hero, breadcrumbs, sidebar structure load instantly
2. **Year as searchParam** - `?year=2024` filters articles by publication year
3. **Only BlogListing in Suspense** - Minimal loading state
4. **Categories keep static counts** - Unlike products, blog category counts don't change based on other filters
5. **Search + Year work together** - Can combine `?search=audio&year=2024`

---

## Year Filter Feature Specification

### URL Structure

| URL                                   | Meaning                             |
| ------------------------------------- | ----------------------------------- |
| `/blog/`                              | All articles, newest first          |
| `/blog/?year=2024`                    | Articles from 2024 only             |
| `/blog/?search=audio`                 | Articles matching "audio"           |
| `/blog/?search=audio&year=2024`       | Articles matching "audio" from 2024 |
| `/blog/kategoria/recenzje/?year=2023` | Reviews from 2023                   |

### Year Filter Logic

```typescript
// Filter by year using publishedDate or _createdAt
// The existing query uses: coalesce(publishedDate, _createdAt)
// We need to extract the year and compare

// In GROQ:
&& ($year == "" || string::split(coalesce(publishedDate, _createdAt), "-")[0] == $year)
```

### UI Behavior

1. **Year Pills**: Display years as clickable pills (similar to categories)
2. **Active State**: Selected year has active styling
3. **Clear Filter**: "All articles" pill clears year filter
4. **Preserve Search**: Year filter preserves search query and page resets to 1
5. **Persist Category**: If on category page, year filter stays within that category

---

## Implementation Tasks

### Phase 1: New Sanity Queries

#### Task 1.1: Create Blog Page Content Query (Static Data)

Create a query that fetches static page content without dynamic filtering.

**File**: `apps/web/src/global/sanity/query.ts`

```typescript
// Query for blog page static content - handles both /blog and /blog/kategoria/[category]
// Uses GROQ select() to conditionally fetch category-specific or default content
// Parameters:
// - $category: category slug (e.g., "/blog/kategoria/recenzje/") or empty string "" for main page
// This query is designed to be cached with "use cache" for PPR static shell
export const queryBlogPageContent = defineQuery(`
  {
    // Main blog page data (always fetched for fallback content)
    "defaultContent": *[_type == "blog"][0] {
      _id,
      _type,
      "slug": slug.current,
      name,
      ${portableTextFragment('title')},
      ${portableTextFragment('description')},
      ${imageFragment('heroImage')},
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
      $category != "" => *[_type == "blog-category" && slug.current == $category][0]{
        _id,
        name,
        "slug": slug.current,
        ${portableTextFragment('title')},
        ${portableTextFragment('description')},
        seo,
        openGraph{
          title,
          description,
          "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        }
      },
      null
    ),
    // Categories with counts (static, doesn't change with filters)
    "categories": *[_type == "blog-category" && defined(slug.current)] | order(orderRank){
      _id,
      name,
      "slug": slug.current,
      "count": count(*[_type == "blog-article" && category._ref == ^._id && !hideFromList])
    },
    // Total count of all articles
    "totalCount": count(*[_type == "blog-article" && defined(slug.current) && !hideFromList]),
    // Available years (for year filter UI)
    "availableYears": array::unique(
      *[_type == "blog-article" && defined(slug.current) && !hideFromList]{
        "year": string::split(coalesce(publishedDate, _createdAt), "-")[0]
      }.year
    ) | order(@ desc)
  }
`);
```

**Usage in page.tsx:**

```typescript
// For /blog page
const data = await sanityFetch({
  query: queryBlogPageContent,
  params: { category: '' },
});
// data.defaultContent = main page content
// data.categoryContent = null
// data.categories = array of categories with counts
// data.availableYears = ["2024", "2023", "2022", ...]

// For /blog/kategoria/recenzje page
const data = await sanityFetch({
  query: queryBlogPageContent,
  params: { category: '/blog/kategoria/recenzje/' },
});
// data.defaultContent = fallback content
// data.categoryContent = recenzje-specific content (or null if not found)

// Use categoryContent if available, otherwise defaultContent
const pageContent = data.categoryContent || data.defaultContent;
```

#### Task 1.2: Update Blog Articles Query with Year Filter

Modify the existing blog articles query to support year filtering.

**File**: `apps/web/src/global/sanity/query.ts`

```typescript
// Updated filter conditions with year support
const blogArticlesFilterConditions = /* groq */ `
  _type == "blog-article"
  && defined(slug.current)
  && hideFromList == false
  && ($category == "" || category->slug.current == $category)
  && ($year == "" || string::split(coalesce(publishedDate, _createdAt), "-")[0] == $year)
  && ($search == "" || count($embeddingResults) > 0 || [name, pt::text(title)] match $search)
  && (count($embeddingResults) == 0 || _id in $embeddingResults[].value.documentId)
`;

// Update blogArticlesFragment to include year param
const blogArticlesFragment = (orderClause: string) => /* groq */ `
  {
    "articles": *[${blogArticlesFilterConditions}] | order(${orderClause}) [$offset...$limit] {
      ${blogArticlesProjection}
    },
    "totalCount": count(*[${blogArticlesFilterConditions}])
  }
`;
```

---

### Phase 2: Update BlogAside Component

#### Task 2.1: Simplify BlogAside to Accept Static Data

The sidebar no longer needs `articlesByYear` with full article data. Instead, it receives `availableYears` (just year strings) and handles filtering via URL.

**File**: `apps/web/src/components/ui/BlogAside/index.tsx`

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useCallback } from "react";

import Pill from "../Pill";
import Searchbar from "../Searchbar";
import styles from "./styles.module.scss";

type BlogAsideProps = {
  categories: {
    _id: string;
    name: string | null;
    slug: string | null;
    count: number;
  }[];
  totalCount: number;
  availableYears: string[]; // NEW: just year strings ["2024", "2023", ...]
  basePath?: string;
  currentCategory?: string | null;
  initialSearch?: string;
};

export default function BlogAside({
  categories,
  totalCount,
  availableYears,
  basePath = "/blog/",
  currentCategory = null,
  initialSearch = "",
}: BlogAsideProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(initialSearch);

  // Get current year filter from URL
  const currentYear = searchParams.get("year") || "";

  // Check if we're on the main blog page (no category selected)
  const isAllPostsActive = !currentCategory || currentCategory === "";

  // Build URL with preserved params
  const buildUrl = useCallback(
    (updates: { year?: string | null; search?: string | null; page?: null }) => {
      const params = new URLSearchParams(searchParams.toString());

      // Always reset page when changing filters
      params.delete("page");

      // Handle year
      if (updates.year === null) {
        params.delete("year");
      } else if (updates.year !== undefined) {
        params.set("year", updates.year);
      }

      // Handle search
      if (updates.search === null) {
        params.delete("search");
      } else if (updates.search !== undefined) {
        if (updates.search.trim()) {
          params.set("search", updates.search.trim());
        } else {
          params.delete("search");
        }
      }

      const queryString = params.toString();
      return queryString ? `${basePath}?${queryString}` : basePath;
    },
    [basePath, searchParams]
  );

  const handleYearClick = (year: string) => {
    const newUrl = currentYear === year
      ? buildUrl({ year: null }) // Toggle off if already selected
      : buildUrl({ year });

    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const applySearch = () => {
    const newUrl = buildUrl({ search: localSearch });

    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const clearAllFilters = () => {
    setLocalSearch("");
    startTransition(() => {
      router.push(basePath, { scroll: false });
    });
  };

  // Check if any filters are active
  const hasActiveFilters = currentYear || localSearch;

  return (
    <aside className={styles.sidebar}>
      <Searchbar
        mode="manual"
        value={localSearch}
        onChange={(value) => setLocalSearch(value)}
        onSubmit={applySearch}
        placeholder="Szukaj"
      />

      {/* Categories section */}
      <nav className={styles.categories}>
        <h2 className={styles.sectionTitle}>Kategorie</h2>
        <Pill
          label="Wszystkie publikacje"
          count={totalCount}
          isActive={isAllPostsActive && !currentYear}
          href="/blog/"
        />
        {categories.map((category) => {
          const categorySlug = category.slug
            ?.replace("/blog/kategoria/", "")
            .replace("/", "");

          const isActive = currentCategory === categorySlug;

          return (
            <Pill
              key={category._id}
              label={category.name!}
              count={category.count}
              isActive={isActive}
              href={`/blog/kategoria/${categorySlug}/`}
            />
          );
        })}
      </nav>

      {/* Year filter section */}
      {availableYears.length > 0 && (
        <div className={styles.yearFilter}>
          <h2 className={styles.sectionTitle}>Filtruj według roku</h2>
          <div className={styles.yearPills}>
            {availableYears.map((year) => (
              <button
                key={year}
                type="button"
                className={`${styles.yearPill} ${currentYear === year ? styles.yearPillActive : ""}`}
                onClick={() => handleYearClick(year)}
                aria-pressed={currentYear === year}
              >
                {year}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className={styles.clearFilters}
              onClick={clearAllFilters}
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
```

#### Task 2.2: Update BlogAside Styles

**File**: `apps/web/src/components/ui/BlogAside/styles.module.scss`

Add styles for the new year filter pills:

```scss
// Add to existing styles

.sectionTitle {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.yearFilter {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.yearPills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.yearPill {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  cursor: pointer;
  transition:
    background-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
    border-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
    color 200ms cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--color-background-hover);
    border-color: var(--color-border-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
}

.yearPillActive {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-on-primary);

  &:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }
}

.clearFilters {
  display: block;
  margin-top: 1rem;
  padding: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 200ms cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    color: var(--color-text-primary);
  }
}
```

---

### Phase 3: Update BlogListing Component

#### Task 3.1: Update BlogListing to Accept searchParams

Similar to ProductsListing, update BlogListing to optionally accept `searchParams` directly for PPR mode.

**File**: `apps/web/src/components/blog/BlogListing/index.tsx`

```typescript
import { notFound } from "next/navigation";

import { fetchEmbeddings } from "@/src/app/actions/embeddings";
import { logWarn } from "@/src/global/logger";
import { sanityFetch } from "@/src/global/sanity/fetch";
import { getBlogArticlesQuery } from "@/src/global/sanity/query";
import type { QueryBlogArticlesNewestResult } from "@/src/global/sanity/sanity.types";
import { BLOG_ITEMS_PER_PAGE } from "@/src/global/constants";

import EmptyState from "../../ui/EmptyState";
import Pagination from "../../ui/Pagination";
import PublicationCard from "../../ui/PublicationCard";
import styles from "./styles.module.scss";

type SearchParamsType = {
  page?: string;
  search?: string;
  year?: string;
};

type BlogListingProps = {
  // Option A: Pass searchParams directly (for PPR pages)
  searchParams?: Promise<SearchParamsType>;

  // Option B: Pass explicit props (for backward compatibility)
  currentPage?: number;
  itemsPerPage?: number;
  searchTerm?: string;
  category?: string;
  year?: string;
  sortBy?: string;
  embeddingResults?: Array<{
    score: number;
    value: { documentId: string; type: string };
  }> | null;

  // Required for both options
  basePath: string;
};

export default async function BlogListing(props: BlogListingProps) {
  // Determine which mode we're in
  let currentPage: number;
  let itemsPerPage: number;
  let searchTerm: string;
  let category: string;
  let year: string;
  let sortBy: string;
  let embeddingResults: Array<{
    score: number;
    value: { documentId: string; type: string };
  }> | null;

  if (props.searchParams) {
    // Mode A: Parse from searchParams (PPR mode)
    const params = await props.searchParams;

    currentPage = Number(params.page) || 1;
    itemsPerPage = props.itemsPerPage || BLOG_ITEMS_PER_PAGE;
    searchTerm = params.search || "";
    category = props.category || "";
    year = params.year || "";

    const hasSearchQuery = Boolean(searchTerm);

    // Fetch embeddings if search exists
    embeddingResults = hasSearchQuery
      ? (await fetchEmbeddings(searchTerm, "blog")) || []
      : [];

    // Determine sort order
    sortBy = hasSearchQuery ? "relevance" : "newest";
  } else {
    // Mode B: Use explicit props (backward compatibility)
    currentPage = props.currentPage || 1;
    itemsPerPage = props.itemsPerPage || BLOG_ITEMS_PER_PAGE;
    searchTerm = props.searchTerm || "";
    category = props.category || "";
    year = props.year || "";
    sortBy = props.sortBy || "newest";
    embeddingResults = props.embeddingResults || null;
  }

  const offset = (currentPage - 1) * itemsPerPage;
  const limit = offset + itemsPerPage;

  // Get the correct query based on sortBy parameter
  const query = getBlogArticlesQuery(sortBy);

  const articlesData = await sanityFetch<QueryBlogArticlesNewestResult>({
    query,
    params: {
      category: category || "",
      search: searchTerm || "",
      year: year || "",
      offset,
      limit,
      embeddingResults: embeddingResults || [],
    },
    tags: ["blog-article"],
  });

  if (!articlesData) {
    logWarn("Blog articles data not found");
    notFound();
  }

  const hasArticles = articlesData.articles && articlesData.articles.length > 0;

  // Create URLSearchParams for Pagination
  const urlSearchParams = new URLSearchParams();
  if (searchTerm) urlSearchParams.set("search", searchTerm);
  if (year) urlSearchParams.set("year", year);

  const ITEMS_PER_ROW = 2;
  const ROW_DELAY = 80;

  return (
    <>
      {!hasArticles ? (
        <EmptyState
          searchTerm={searchTerm}
          category={category}
          year={year}
          type="blog"
        />
      ) : (
        <>
          <div className={styles.articlesGrid}>
            {articlesData.articles!.map((article, index) => {
              const row = Math.floor(index / ITEMS_PER_ROW);
              const delay = row * ROW_DELAY;

              return (
                <div
                  key={article._id}
                  className={styles.articleItem}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <PublicationCard
                    headingLevel="h2"
                    publication={article}
                    layout="vertical"
                    imageSizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 440px"
                    priority={index === 0}
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>
              );
            })}
          </div>
          <Pagination
            totalItems={articlesData.totalCount || 0}
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

---

### Phase 4: Update Page Components

#### Task 4.1: Update `/blog/(listing)/page.tsx`

**File**: `apps/web/src/app/blog/(listing)/page.tsx`

```typescript
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import BlogListing from "@/src/components/blog/BlogListing";
import BlogListingSkeleton from "@/src/components/blog/BlogListing/BlogListingSkeleton";
import styles from "@/src/components/blog/BlogListing/styles.module.scss";
import HeroStatic from "@/src/components/pageBuilder/HeroStatic";
import CollectionPageSchema from "@/src/components/schema/CollectionPageSchema";
import { PageBuilder } from "@/src/components/shared/PageBuilder";
import BlogAside from "@/src/components/ui/BlogAside";
import Breadcrumbs from "@/src/components/ui/Breadcrumbs";
import { logWarn } from "@/src/global/logger";
import { sanityFetch } from "@/src/global/sanity/fetch";
import { queryBlogPageContent } from "@/src/global/sanity/query";
import type { QueryBlogPageContentResult } from "@/src/global/sanity/sanity.types";
import { getSEOMetadata } from "@/src/global/seo";

type BlogPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    year?: string;
  }>;
};

// Cached static data fetcher
async function getStaticPageData() {
  "use cache";
  cacheLife("hours");

  return sanityFetch<QueryBlogPageContentResult>({
    query: queryBlogPageContent,
    params: { category: "" },
    tags: ["blog"],
  });
}

export async function generateMetadata() {
  const contentData = await getStaticPageData();
  const pageData = contentData?.defaultContent;

  if (!pageData) {
    logWarn("Blog page data not found");
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  // Fetch cached static data (instant after first load)
  const contentData = await getStaticPageData();
  const pageData = contentData?.defaultContent;

  if (!pageData || !contentData) {
    logWarn("Blog page data not found");
    notFound();
  }

  const breadcrumbsData = [
    {
      name: pageData.name || "Blog",
      path: "/blog/",
    },
  ];

  return (
    <>
      <CollectionPageSchema
        name={pageData.name || "Blog"}
        url="/blog/"
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
        _key={""}
        _type={"heroStatic"}
        button={null}
      />
      <section className={`${styles.blogListing} max-width`}>
        {/* Static sidebar with year filter */}
        <BlogAside
          categories={contentData.categories || []}
          totalCount={contentData.totalCount || 0}
          availableYears={contentData.availableYears || []}
          basePath="/blog/"
          currentCategory={null}
        />

        {/* Blog listing in Suspense - only this shows skeleton */}
        <Suspense fallback={<BlogListingSkeleton />}>
          <BlogListing
            searchParams={searchParams}
            basePath="/blog/"
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={pageData.pageBuilder || []} />
    </>
  );
}
```

#### Task 4.2: Update `/blog/(listing)/kategoria/[category]/page.tsx`

**File**: `apps/web/src/app/blog/(listing)/kategoria/[category]/page.tsx`

```typescript
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import BlogListing from "@/src/components/blog/BlogListing";
import BlogListingSkeleton from "@/src/components/blog/BlogListing/BlogListingSkeleton";
import styles from "@/src/components/blog/BlogListing/styles.module.scss";
import HeroStatic from "@/src/components/pageBuilder/HeroStatic";
import CollectionPageSchema from "@/src/components/schema/CollectionPageSchema";
import { PageBuilder } from "@/src/components/shared/PageBuilder";
import BlogAside from "@/src/components/ui/BlogAside";
import Breadcrumbs from "@/src/components/ui/Breadcrumbs";
import { logWarn } from "@/src/global/logger";
import { sanityFetch } from "@/src/global/sanity/fetch";
import { queryBlogPageContent } from "@/src/global/sanity/query";
import type { QueryBlogPageContentResult } from "@/src/global/sanity/sanity.types";
import { getSEOMetadata } from "@/src/global/seo";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    year?: string;
  }>;
};

// Cached static data fetcher for main blog data
async function getStaticBlogData() {
  "use cache";
  cacheLife("hours");

  return sanityFetch<QueryBlogPageContentResult>({
    query: queryBlogPageContent,
    params: { category: "" },
    tags: ["blog"],
  });
}

// Cached page content fetcher (handles category-specific content)
async function getPageContent(categorySlug: string) {
  "use cache";
  cacheLife("hours");

  return sanityFetch<QueryBlogPageContentResult>({
    query: queryBlogPageContent,
    params: { category: `/blog/kategoria/${categorySlug}/` },
    tags: ["blog", "blog-category"],
  });
}

export async function generateStaticParams() {
  const blogData = await getStaticBlogData();

  return (
    blogData?.categories
      ?.filter((cat) => cat.count > 0)
      .map((cat) => ({
        category:
          cat.slug?.replace("/blog/kategoria/", "").replace("/", "") || "",
      })) || []
  );
}

export async function generateMetadata(props: CategoryPageProps) {
  const { category: categorySlug } = await props.params;
  const contentData = await getPageContent(categorySlug);

  if (!contentData || !contentData.categoryContent) {
    logWarn(`Category not found: ${categorySlug}`);
    return getSEOMetadata();
  }

  const category = contentData.categoryContent;

  return getSEOMetadata({
    seo: category.seo,
    slug: category.slug,
    openGraph: category.openGraph,
  });
}

export default async function CategoryPage(props: CategoryPageProps) {
  const { category: categorySlug } = await props.params;

  // Fetch all cached static data in parallel
  const [blogData, contentData] = await Promise.all([
    getStaticBlogData(),
    getPageContent(categorySlug),
  ]);

  const defaultContent = blogData?.defaultContent;
  const categoryContent = contentData?.categoryContent;

  if (!defaultContent || !blogData) {
    logWarn(`Blog page data not found`);
    notFound();
  }

  // Check if category exists and has articles
  const categoryInfo = blogData.categories?.find(
    (cat) =>
      cat.slug?.replace("/blog/kategoria/", "").replace("/", "") === categorySlug
  );

  if (!categoryInfo || categoryInfo.count === 0) {
    logWarn(`Category "${categorySlug}" not found or has no articles`);
    notFound();
  }

  const breadcrumbsData = [
    {
      name: defaultContent.name || "Blog",
      path: "/blog/",
    },
    {
      name: categoryContent?.name || categorySlug,
      path: categoryContent?.slug || `/blog/kategoria/${categorySlug}/`,
    },
  ];

  // Use category's custom title/description if available
  const heroTitle = categoryContent?.title || defaultContent.title;
  const heroDescription = categoryContent?.description || defaultContent.description;
  const heroImage = defaultContent.heroImage;

  return (
    <>
      <CollectionPageSchema
        name={categoryContent?.name || categorySlug}
        url={`/blog/kategoria/${categorySlug}/`}
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
        _key={""}
        _type={"heroStatic"}
        button={null}
      />
      <section className={`${styles.blogListing} max-width`}>
        {/* Static sidebar with year filter */}
        <BlogAside
          categories={blogData.categories || []}
          totalCount={blogData.totalCount || 0}
          availableYears={blogData.availableYears || []}
          basePath={`/blog/kategoria/${categorySlug}/`}
          currentCategory={categorySlug}
        />

        {/* Blog listing in Suspense */}
        <Suspense fallback={<BlogListingSkeleton />}>
          <BlogListing
            searchParams={props.searchParams}
            basePath={`/blog/kategoria/${categorySlug}/`}
            category={`/blog/kategoria/${categorySlug}/`}
          />
        </Suspense>
      </section>
      <PageBuilder pageBuilder={defaultContent.pageBuilder || []} />
    </>
  );
}
```

---

### Phase 5: Update Blog Post Page (Already Has `"use cache"`)

The individual blog post page at `/blog/[slug]/page.tsx` already has `"use cache"` at the top, so it's already optimized for caching. **No changes needed** for PPR.

However, ensure it continues to work correctly:

```typescript
'use cache'; // Already present - good!

// ... existing implementation is fine
```

---

### Phase 6: Update EmptyState Component

#### Task 6.1: Add Year Support to EmptyState

**File**: `apps/web/src/components/ui/EmptyState/index.tsx`

Add support for displaying year in the empty state message:

```typescript
type EmptyStateProps = {
  searchTerm?: string;
  category?: string;
  year?: string; // NEW
  type: 'products' | 'blog';
};

export default function EmptyState({
  searchTerm,
  category,
  year,
  type,
}: EmptyStateProps) {
  // Build the message based on active filters
  const filterParts: string[] = [];

  if (searchTerm) {
    filterParts.push(`"${searchTerm}"`);
  }
  if (year) {
    filterParts.push(`rok ${year}`);
  }
  if (category) {
    filterParts.push(`kategoria`);
  }

  // ... rest of component
}
```

---

### Phase 7: Type Generation

#### Task 7.1: Run Sanity Type Generation

After adding new queries, regenerate types:

```bash
cd apps/web
bun sanity:typegen
```

This will generate:

- `QueryBlogPageContentResult`

---

## File Structure Summary

### New Files

None - we're modifying existing files.

### Modified Files

```
apps/web/src/
├── global/sanity/
│   └── query.ts                                    # Add queryBlogPageContent, update filter conditions
│
├── app/blog/(listing)/
│   ├── page.tsx                                    # Full rewrite for PPR
│   └── kategoria/[category]/
│       └── page.tsx                                # Full rewrite for PPR
│
├── components/
│   ├── blog/BlogListing/
│   │   └── index.tsx                               # Add searchParams support, year filter
│   └── ui/
│       ├── BlogAside/
│       │   ├── index.tsx                           # Simplify, add year filter UI
│       │   └── styles.module.scss                  # Add year pill styles
│       └── EmptyState/
│           └── index.tsx                           # Add year support
```

---

## Migration Path

### Step 1: Update Sanity Queries

1. Add `queryBlogPageContent` query
2. Update `blogArticlesFilterConditions` with year filter
3. Run `bun sanity:typegen` to generate types

### Step 2: Update BlogAside

1. Remove `articlesByYear` (full article data)
2. Add `availableYears` (just year strings)
3. Add year filter UI with pills
4. Update styles

### Step 3: Update BlogListing

1. Add `searchParams` prop option
2. Add `year` filtering support
3. Update Pagination to include year param

### Step 4: Update Page Components

1. Update `/blog/(listing)/page.tsx` with PPR pattern
2. Update `/blog/(listing)/kategoria/[category]/page.tsx` with PPR pattern

### Step 5: Update EmptyState

1. Add year support to message

### Step 6: Test

1. Test main blog listing with PPR
2. Test category pages with PPR
3. Test year filtering
4. Test search + year combination
5. Test pagination with filters

---

## Testing Checklist

### Functional Tests

- [ ] `/blog` loads instantly (static shell)
- [ ] `/blog?year=2024` filters articles to 2024
- [ ] `/blog?search=audio` semantic search works
- [ ] `/blog?search=audio&year=2024` combines filters
- [ ] `/blog/kategoria/recenzje/` works with PPR
- [ ] `/blog/kategoria/recenzje/?year=2023` filters within category
- [ ] Year pills show correct active state
- [ ] "Clear filters" button works
- [ ] Pagination preserves year and search params
- [ ] Category switching clears year filter (navigates to new category)
- [ ] Back/forward navigation works correctly
- [ ] `generateStaticParams` generates all category pages

### Performance Tests

- [ ] Initial page load < 100ms (after cache warm)
- [ ] Filter changes show skeleton, resolve quickly
- [ ] No CLS (Cumulative Layout Shift)
- [ ] LCP (Largest Contentful Paint) < 2.5s

### PPR Verification

- [ ] Build output shows PPR for `/blog` route
- [ ] View page source shows pre-rendered static shell
- [ ] Network tab shows streaming for blog listing

---

## Rollback Plan

If issues arise:

1. Revert page.tsx files to original implementation
2. Restore `articlesByYear` in BlogAside
3. Remove year filter conditions from queries

---

## Migration Notes

### Breaking Changes

None - URLs and behavior remain backward compatible.

- `/blog` works as before
- `/blog?search=audio` works as before
- `/blog/kategoria/[category]` works as before
- **New**: `/blog?year=2024` now filters by year

### SEO Impact

Positive - PPR improves Core Web Vitals (LCP, CLS).

### Removed Feature

The expandable year lists with article links are replaced by year filter pills. If you want to keep both:

1. Keep the expandable year lists (articlesByYear) for navigation
2. Add year pills for filtering (both can coexist)

---

## Estimated Effort

| Phase                    | Estimated Time |
| ------------------------ | -------------- |
| Phase 1: Queries         | 1 hour         |
| Phase 2: BlogAside       | 1.5 hours      |
| Phase 3: BlogListing     | 1 hour         |
| Phase 4: Page Components | 1.5 hours      |
| Phase 5: Blog Post       | N/A (done)     |
| Phase 6: EmptyState      | 30 mins        |
| Phase 7: Type Generation | 15 mins        |
| Testing                  | 1.5 hours      |
| **Total**                | **~7.5 hours** |

---

## Alternative: Keep Year Navigation AND Add Filter

If you want to keep the expandable year navigation (showing article links) AND add year filtering:

### BlogAside Structure

```tsx
{
  /* Year Filter Pills */
}
{
  availableYears.length > 0 && (
    <div className={styles.yearFilter}>
      <h2 className={styles.sectionTitle}>Filtruj według roku</h2>
      <div className={styles.yearPills}>
        {availableYears.map((year) => (
          <button
            key={year}
            type='button'
            className={`${styles.yearPill} ${currentYear === year ? styles.yearPillActive : ''}`}
            onClick={() => handleYearClick(year)}>
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}

{
  /* Expandable Year Navigation (optional, for quick article access) */
}
{
  articlesByYear && articlesByYear.length > 0 && (
    <div className={styles.yearNavigation}>
      <h2 className={styles.sectionTitle}>Przeglądaj według lat</h2>
      {/* ... existing expandable year lists ... */}
    </div>
  );
}
```

This requires keeping `articlesByYear` in the query and props, which adds ~5-10KB to the static shell. Decide based on UX requirements.
