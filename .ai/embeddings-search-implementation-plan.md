# Sanity Embeddings Index Implementation Plan for Next.js

## Overview

This document outlines the comprehensive end-to-end implementation plan for integrating Sanity's Embeddings Index API into the products listing and blog listing pages to enable semantic search (AI-powered search based on meaning and context, not just keywords).

**Current State:** Basic text-based filtering that searches for keyword matches  
**Target State:** Semantic search using Sanity Embeddings Index with relevance scoring

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [Sanity Embeddings Index Configuration](#2-sanity-embeddings-index-configuration)
3. [Backend Implementation (API Routes)](#3-backend-implementation-api-routes)
4. [Data Layer Updates (GROQ Queries)](#4-data-layer-updates-groq-queries)
5. [Frontend Integration](#5-frontend-integration)
6. [Testing Strategy](#6-testing-strategy)
7. [Performance Considerations](#7-performance-considerations)
8. [Rollback Plan](#8-rollback-plan)

---

## 1. Prerequisites & Setup

### 1.1 Environment Variables

Add to `.env.local` (development) and Vercel environment variables (production):

```env
# Existing Sanity variables
NEXT_PUBLIC_SANITY_PROJECT_ID=fsw3likv
NEXT_PUBLIC_SANITY_DATASET=production

# New: Embeddings Index Bearer Token
EMBEDDINGS_INDEX_BEARER_TOKEN=your-bearer-token-here
```

**Action Items:**

- [x] ~~Obtain bearer token from Sanity dashboard (Project Settings → API → Tokens)~~
- [ ] Create a token with read access to embeddings (or use existing token)
- [ ] Add `EMBEDDINGS_INDEX_BEARER_TOKEN` to `.env.local` for development
- [ ] Add `EMBEDDINGS_INDEX_BEARER_TOKEN` to Vercel environment variables for production
- [ ] Document token permissions in team documentation

### 1.2 Dependencies

No new dependencies needed! We'll use:

- Existing `@sanity/client` for API requests
- Built-in Next.js Route Handlers (App Router)
- Native `fetch` API

---

## 2. Sanity Embeddings Index Configuration

### 2.1 Create Embeddings Indexes

We need TWO separate indexes:

1. **Products Index** - for product search
2. **Blog Index** - for blog post search

#### Option A: Using Sanity CLI

```bash
# Install CLI globally if not already installed
npm install -g @sanity/embeddings-index-cli

# Create Products Index
npx @sanity/embeddings-index-cli create \
  --indexName "products" \
  --dataset "production" \
  --filter "_type == 'product'" \
  --projection "{_id, name, description, shortDescription, seo}"

# Create Blog Index
npx @sanity/embeddings-index-cli create \
  --indexName "blog" \
  --dataset "production" \
  --filter "_type == 'blog'" \
  --projection "{_id, title, excerpt, seo}"
```

#### Option B: Using Sanity Studio Plugin

```bash
# Install the embeddings UI plugin
npm install @sanity/embeddings-index-ui

# Add to sanity.config.ts
import { embeddingsIndexDashboard } from '@sanity/embeddings-index-ui'

export default defineConfig({
  // ...
  plugins: [embeddingsIndexDashboard()]
})
```

Then create indexes via the Studio UI.

### 2.2 Index Configuration Details

#### Products Index Configuration

```json
{
  "indexName": "products",
  "dataset": "production",
  "filter": "_type == 'product'",
  "projection": {
    "_id": true,
    "name": true,
    "description": true,
    "shortDescription": true,
    "seo": {
      "metaTitle": true,
      "metaDescription": true
    }
  }
}
```

**Rationale:** Including name, descriptions, and SEO fields gives the embedding model rich context about each product.

#### Blog Index Configuration

```json
{
  "indexName": "blog",
  "dataset": "production",
  "filter": "_type == 'blog'",
  "projection": {
    "_id": true,
    "title": true,
    "excerpt": true,
    "seo": {
      "metaTitle": true,
      "metaDescription": true
    }
  }
}
```

**Rationale:** Blog posts are primarily text-based, so title, excerpt, and SEO metadata provide sufficient context.

### 2.3 Index Initialization

**Important:** After creating indexes, they need time to process existing documents:

- Small datasets (< 100 docs): ~1-5 minutes
- Medium datasets (100-1000 docs): ~10-30 minutes
- Large datasets (> 1000 docs): ~1+ hours

**Action Items:**

- [ ] Create both indexes
- [ ] Wait for initial processing to complete
- [ ] Verify indexes are active via CLI: `npx @sanity/embeddings-index-cli list`
- [ ] Test sample queries via CLI or Studio UI

---

## 3. Backend Implementation (API Routes)

### 3.1 Create Embeddings API Route

**File:** `apps/web/src/app/api/embeddings/route.ts`

This route will handle embedding searches for both products AND blog posts.

```typescript
import { NextRequest, NextResponse } from "next/server";

// Type definitions
type EmbeddingResult = {
  score: number;
  value: {
    documentId: string;
    type: string;
  };
};

type EmbeddingsResponse = EmbeddingResult[];

type SearchType = "products" | "blog";

const INDEX_NAMES: Record<SearchType, string> = {
  products: "products",
  blog: "blog",
};

const TYPE_FILTERS: Record<SearchType, string> = {
  products: "product",
  blog: "blog",
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { searchQuery, type } = body as {
      searchQuery: string;
      type: SearchType;
    };

    // Validation
    if (!searchQuery || typeof searchQuery !== "string") {
      return NextResponse.json(
        { error: "Search query is required and must be a string" },
        { status: 400 },
      );
    }

    if (!type || !["products", "blog"].includes(type)) {
      return NextResponse.json(
        { error: "Valid type (products or blog) is required" },
        { status: 400 },
      );
    }

    // Environment variables
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const bearerToken = process.env.EMBEDDINGS_INDEX_BEARER_TOKEN;

    if (!projectId || !bearerToken) {
      console.error("Missing required environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // Get index name and type filter
    const indexName = INDEX_NAMES[type];
    const typeFilter = TYPE_FILTERS[type];

    // Call Sanity Embeddings Index API
    const embeddingsUrl = `https://${projectId}.api.sanity.io/vX/embeddings-index/query/${dataset}/${indexName}`;

    const response = await fetch(embeddingsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        query: searchQuery,
        maxResults: 50, // Fetch top 50 matches
        filter: {
          _type: [typeFilter],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Embeddings API error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: "Failed to fetch embeddings" },
        { status: response.status },
      );
    }

    const data: EmbeddingsResponse = await response.json();

    // Return results
    return NextResponse.json({ data, count: data.length }, { status: 200 });
  } catch (error) {
    console.error("Embeddings API route error:", error);
    return NextResponse.json(
      { error: "Internal server error during embeddings search" },
      { status: 500 },
    );
  }
}

// Optionally support GET for testing
export async function GET() {
  return NextResponse.json(
    {
      message: "Embeddings API - POST only",
      usage: {
        method: "POST",
        body: {
          searchQuery: "string (required)",
          type: "'products' | 'blog' (required)",
        },
      },
    },
    { status: 200 },
  );
}
```

### 3.2 Create Type Definitions

**File:** `apps/web/src/types/embeddings.ts`

```typescript
export type EmbeddingResult = {
  score: number;
  value: {
    documentId: string;
    type: string;
  };
};

export type EmbeddingsResponse = EmbeddingResult[];

export type SearchType = "products" | "blog";
```

### 3.3 Error Handling Strategy

The API route should handle:

- **400 Bad Request:** Invalid/missing parameters
- **401 Unauthorized:** Invalid bearer token
- **404 Not Found:** Index doesn't exist
- **429 Rate Limited:** Too many requests
- **500 Server Error:** Unexpected errors

**Action Items:**

- [ ] Create `apps/web/src/app/api/embeddings/route.ts`
- [ ] Create `apps/web/src/types/embeddings.ts`
- [ ] Add error logging (consider integrating with existing logger)
- [ ] Test API route with Postman/Thunder Client

---

## 4. Data Layer Updates (GROQ Queries)

### 4.1 Helper Function: Fetch Embeddings

**File:** `apps/web/src/global/utils/embeddings.ts`

```typescript
import type { EmbeddingsResponse, SearchType } from "@/src/types/embeddings";

export async function fetchEmbeddings(
  searchQuery: string,
  type: SearchType,
): Promise<EmbeddingsResponse | null> {
  if (!searchQuery || !searchQuery.trim()) {
    return null;
  }

  try {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchQuery: searchQuery.trim(),
        type,
      }),
    });

    if (!response.ok) {
      console.error(
        `Embeddings fetch failed (${response.status}):`,
        await response.text(),
      );
      return null;
    }

    const result = await response.json();
    return result.data || null;
  } catch (error) {
    console.error("Error fetching embeddings:", error);
    return null;
  }
}
```

### 4.2 Update Products Page GROQ Query

**File:** `apps/web/src/global/sanity/query.ts`

**Current pattern:**

```typescript
// Current search filter (basic text matching)
search != "" => [
  name match $search + "*",
  shortDescription match $search + "*",
  description match $search + "*"
]
```

**New pattern with embeddings:**

```typescript
// Add embeddings filter parameter to existing query
export const queryProductsData = groq`
  *[
    _type == "product" 
    && (!defined($embeddingResults) || _id in $embeddingResults[].value.documentId)
    && (
      // Other existing filters (brands, price, category, etc.)
    )
  ] {
    // ... existing fields
    "_score": select(
      defined($embeddingResults) => $embeddingResults[value.documentId == ^._id][0].score,
      0
    )
  } | order(
    select(
      defined($embeddingResults) => _score desc,
      // Fallback to existing sort logic when no embeddings
    )
  )
`;
```

**Key Changes:**

1. Add `$embeddingResults` parameter to query
2. Filter by document IDs from embeddings: `_id in $embeddingResults[].value.documentId`
3. Calculate `_score` field for each product
4. Sort by `_score desc` when embeddings are present

### 4.3 Update Blog Page GROQ Query

Similar pattern for blog posts:

```typescript
export const queryBlogPosts = groq`
  *[
    _type == "blog"
    && (!defined($embeddingResults) || _id in $embeddingResults[].value.documentId)
  ] {
    // ... existing fields
    "_score": select(
      defined($embeddingResults) => $embeddingResults[value.documentId == ^._id][0].score,
      0
    )
  } | order(
    select(
      defined($embeddingResults) => _score desc,
      _createdAt desc // Fallback sort
    )
  )
`;
```

### 4.4 Integration Pattern

**In Server Component (page.tsx):**

```typescript
// 1. Parse search term from URL
const searchTerm = searchParams.search || "";

// 2. Fetch embeddings if search exists
const embeddingResults = searchTerm
  ? await fetchEmbeddings(searchTerm, "products")
  : null;

// 3. Pass to GROQ query
const productsData = await sanityFetch({
  query: queryProductsData,
  params: {
    search: searchTerm,
    embeddingResults, // NEW: Pass embeddings results
    // ... other params
  },
});

// 4. When embeddings exist, force sort to 'relevance'
const sortBy = embeddingResults ? "relevance" : searchParams.sortBy || "newest";
```

**Action Items:**

- [ ] Create `apps/web/src/global/utils/embeddings.ts`
- [ ] Update `queryProductsPageData` in query.ts
- [ ] Update `queryBlogPageData` in query.ts
- [ ] Update related TypeScript types

---

## 5. Frontend Integration

### 5.1 Update Products Listing Page

**File:** `apps/web/src/app/produkty/(listing)/page.tsx`

**Changes needed:**

```typescript
export default async function ProductsPage(props: ProductsPageProps) {
  const searchParams = await props.searchParams;
  const searchTerm = searchParams.search || '';

  // NEW: Fetch embeddings when search term exists
  const embeddingResults = searchTerm
    ? await fetchEmbeddings(searchTerm, 'products')
    : null;

  // Determine sortBy - force 'relevance' when embeddings exist
  const hasEmbeddings = Boolean(embeddingResults && embeddingResults.length > 0);
  const sortBy = hasEmbeddings
    ? 'relevance'
    : (searchParams.sortBy || 'newest');

  // Fetch products data with embeddings
  const productsData = await sanityFetch<QueryProductsPageDataResult>({
    query: queryProductsPageData,
    params: {
      category: '',
      search: searchTerm,
      embeddingResults, // NEW: Pass embeddings
      brands,
      minPrice,
      maxPrice,
      customFilters: [],
    },
    tags: ['products', 'productCategorySub', 'product', 'brand'],
  });

  // Update SortDropdown to handle 'relevance' option
  const sortOptions = hasEmbeddings
    ? [
        { value: 'relevance', label: 'Najlepsze dopasowanie' }, // Best match
        ...PRODUCT_SORT_OPTIONS,
      ]
    : PRODUCT_SORT_OPTIONS;

  return (
    <>
      {/* ... existing components */}
      <SortDropdown
        options={sortOptions}
        basePath="/produkty/"
        defaultValue={sortBy}
        hasSearchQuery={hasEmbeddings}
      />
      <ProductsListing
        currentPage={currentPage}
        itemsPerPage={PRODUCTS_ITEMS_PER_PAGE}
        searchTerm={searchTerm}
        category=""
        sortBy={sortBy}
        brands={brands}
        minPrice={minPrice}
        maxPrice={maxPrice}
        basePath="/produkty/"
      />
    </>
  );
}
```

### 5.2 Update Blog Listing Page

**File:** `apps/web/src/app/blog/(listing)/page.tsx`

Similar changes:

```typescript
export default async function BlogPage(props: BlogPageProps) {
  const searchParams = await props.searchParams;
  const searchTerm = searchParams.search || "";

  // NEW: Fetch embeddings
  const embeddingResults = searchTerm
    ? await fetchEmbeddings(searchTerm, "blog")
    : null;

  const blogData = await sanityFetch<QueryBlogPageDataResult>({
    query: queryBlogPageData,
    params: {
      category: "",
      embeddingResults, // NEW: Pass embeddings
    },
    tags: ["blog", "blog-category"],
  });

  // ... rest of component
}
```

### 5.3 Update Sort Options

**File:** `apps/web/src/global/constants.ts`

```typescript
export const PRODUCT_SORT_OPTIONS = [
  { value: "newest", label: "Najnowsze" },
  { value: "oldest", label: "Najstarsze" },
  { value: "priceAsc", label: "Cena: rosnąco" },
  { value: "priceDesc", label: "Cena: malejąco" },
  { value: "nameAsc", label: "Nazwa: A-Z" },
  { value: "nameDesc", label: "Nazwa: Z-A" },
  // 'relevance' will be dynamically added when search is active
] as const;
```

### 5.4 UI/UX Considerations

**Search Results Indicator:**
When using embeddings, show users that results are relevance-based:

```tsx
{
  hasEmbeddings && (
    <div className={styles.searchIndicator}>
      <span>Wyniki wyszukiwania dla: "{searchTerm}"</span>
      <span className={styles.sortInfo}>Sortowanie: według trafności</span>
    </div>
  );
}
```

**No Results Handling:**

```tsx
{
  totalCount === 0 && searchTerm && (
    <div className={styles.noResults}>
      <p>Nie znaleziono produktów dla: "{searchTerm}"</p>
      <p>Spróbuj wyszukać inaczej lub przejrzyj wszystkie produkty.</p>
      <button onClick={() => router.push("/produkty/")}>
        Zobacz wszystkie produkty
      </button>
    </div>
  );
}
```

**Action Items:**

- [ ] Update `apps/web/src/app/produkty/(listing)/page.tsx`
- [ ] Update `apps/web/src/app/blog/(listing)/page.tsx`
- [ ] Add 'relevance' sort option dynamically
- [ ] Add search results indicator UI
- [ ] Update TypeScript types for sort options

---

## 6. Testing Strategy

### 6.1 Unit Tests

**Test Cases:**

1. **API Route Tests** (`route.test.ts`):
   - ✅ Valid request returns embeddings
   - ✅ Missing searchQuery returns 400
   - ✅ Invalid type returns 400
   - ✅ Missing bearer token returns 500
   - ✅ Sanity API error is handled gracefully

2. **Helper Function Tests** (`embeddings.test.ts`):
   - ✅ Empty search query returns null
   - ✅ Valid search returns EmbeddingsResponse
   - ✅ Network error returns null
   - ✅ Invalid JSON response returns null

### 6.2 Integration Tests

**Test Scenarios:**

1. **Products Search Flow:**

   ```
   User enters "słuchawki bezprzewodowe"
   → API fetches embeddings
   → GROQ filters by document IDs
   → Results sorted by relevance score
   → UI displays top matches first
   ```

2. **Blog Search Flow:**

   ```
   User enters "porady audio"
   → API fetches embeddings
   → GROQ filters by document IDs
   → Results sorted by relevance
   → UI displays blog posts
   ```

3. **Fallback Behavior:**

   ```
   API returns empty results
   → Show "no results" message
   → Suggest browsing all items
   ```

4. **Combined Filters:**
   ```
   User searches "słuchawki" + filters by brand
   → Embeddings fetch top matches
   → Additional filters applied in GROQ
   → Results respect both search and filters
   ```

### 6.3 Manual Testing Checklist

- [ ] Search with single word (e.g., "słuchawki")
- [ ] Search with phrase (e.g., "bezprzewodowe słuchawki bluetooth")
- [ ] Search with typos (e.g., "sluchawki") - embeddings should still work
- [ ] Search with Polish special characters (ą, ć, ę, ł, ń, ó, ś, ź, ż)
- [ ] Search + brand filter combination
- [ ] Search + price filter combination
- [ ] Search + category selection
- [ ] Empty search query (should show all products)
- [ ] Very long search query (> 100 characters)
- [ ] Special characters in search (@, #, $, %, etc.)
- [ ] Mobile device testing
- [ ] Slow network conditions

### 6.4 Performance Tests

- [ ] Measure API response time (target: < 500ms)
- [ ] Measure total page load time with search (target: < 2s)
- [ ] Test with concurrent users (simulate 10+ simultaneous searches)
- [ ] Monitor Sanity API rate limits

### 6.5 Acceptance Criteria

✅ **Definition of Done:**

- All unit tests pass
- Integration tests pass
- Manual test scenarios work as expected
- Performance targets met
- No console errors or warnings
- Accessibility requirements met (keyboard navigation, screen readers)
- Documentation updated

---

## 7. Performance Considerations

### 7.1 Caching Strategy

**Problem:** Each search query hits the embeddings API, which can be slow.

**Solution:** Implement caching at multiple levels:

1. **Server-side caching** (using Next.js cache):

```typescript
// In embeddings API route
import { unstable_cache } from "next/cache";

const getCachedEmbeddings = unstable_cache(
  async (searchQuery: string, type: SearchType) => {
    // Fetch from Sanity
  },
  ["embeddings-search"],
  {
    revalidate: 3600, // 1 hour
    tags: ["embeddings"],
  },
);
```

2. **Client-side debouncing** (for real-time search):

```typescript
// Debounce search input
const debouncedSearch = useDebouncedCallback(
  (query: string) => {
    // Trigger search
  },
  500, // 500ms delay
);
```

### 7.2 Optimization Strategies

1. **Limit embedding results:**
   - Fetch max 50 results from embeddings API
   - Apply filters in GROQ to narrow down further

2. **Pagination:**
   - Only fetch embeddings once per search term
   - Use pagination for displaying results

3. **Progressive enhancement:**
   - Show basic text search results immediately
   - Enhance with embeddings in background
   - Update UI when embeddings load

### 7.3 Monitoring

**Metrics to track:**

- Average embeddings API response time
- Cache hit rate
- Error rate (4xx, 5xx responses)
- User engagement (click-through rate on search results)

**Tools:**

- Next.js built-in analytics
- Vercel Analytics (if deployed on Vercel)
- Custom logging to track search queries

**Action Items:**

- [ ] Implement caching strategy
- [ ] Add debouncing to search input
- [ ] Set up monitoring dashboard
- [ ] Create performance baseline metrics

---

## 8. Rollback Plan

### 8.1 Feature Flag Approach

**Option 1: Environment Variable**

```typescript
// In page.tsx
const USE_EMBEDDINGS = process.env.NEXT_PUBLIC_USE_EMBEDDINGS === "true";

const embeddingResults =
  USE_EMBEDDINGS && searchTerm
    ? await fetchEmbeddings(searchTerm, "products")
    : null;
```

**Option 2: Configuration File**

```typescript
// apps/web/src/config/features.ts
export const FEATURES = {
  USE_EMBEDDINGS_SEARCH: true,
  // ... other feature flags
} as const;
```

### 8.2 Rollback Steps

**If embeddings cause issues:**

1. **Immediate rollback:**

   ```bash
   # Set environment variable
   NEXT_PUBLIC_USE_EMBEDDINGS=false

   # Redeploy
   vercel deploy --prod
   ```

2. **Code-level rollback:**
   - Remove embeddings fetching logic
   - Keep basic text search
   - Remove `_score` from GROQ queries

3. **Partial rollback:**
   - Keep embeddings for products only
   - Disable for blog (or vice versa)

### 8.3 Emergency Contacts

- **Sanity Support:** support@sanity.io
- **Team Lead:** [Name]
- **DevOps:** [Name]

---

## Implementation Timeline

### Phase 1: Setup & Configuration (Day 1-2) ✅ COMPLETE

- [x] ~~Create embeddings indexes in Sanity~~
- [ ] Add environment variables (need bearer token)
- [x] ~~Verify indexes are processing~~ (41 products, 20 blog posts)

### Phase 2: Backend Development (Day 3-4) ✅ COMPLETE

- [x] ~~Create Server Action~~ (`/app/actions/embeddings.ts` with `'use server'` directive)
- [x] ~~Add types~~ (added to `types.ts`)
- [ ] Write unit tests
- [ ] Test Server Action manually

**Note:** Switched from API Route to Server Actions for better integration with Server Components and simpler architecture.

### Phase 3: Data Layer Integration (Day 5-6) ✅ COMPLETE

- [x] ~~Update GROQ queries~~ (added embeddings filtering and relevance sorting)
- [x] ~~Add embeddings parameters~~ (`$embeddingResults`)
- [x] ~~Add relevance sort option~~ (dynamic sort options based on search)
- [x] ~~Create separate queries for different sort orders~~ (products & blog)
- [x] ~~Test queries with typegen~~

**Note:** Blog query simplified - removed `_score` projection as it's not needed for frontend display, only for sorting which is handled in GROQ.

### Phase 4: Frontend Integration (Day 7-8) ✅ COMPLETE

- [x] ~~Update products page~~ (added embeddings fetching and relevance sort)
- [x] ~~Update blog page~~ (added embeddings fetching and relevance sort)
- [x] ~~Add dynamic sort options~~ (relevance only shown when search is active)
- [x] ~~Update components to pass embeddings~~ (ProductsListing, BlogListing)

### Phase 5: Testing & Optimization (Day 9-10)

- [ ] Integration testing
- [ ] Performance testing
- [ ] Manual testing
- [ ] Bug fixes

### Phase 6: Deployment & Monitoring (Day 11)

- [ ] Deploy to staging
- [ ] Stakeholder review
- [ ] Deploy to production
- [ ] Monitor metrics

---

## Success Metrics

**Quantitative:**

- Search usage increase by 20%+
- Click-through rate improvement by 15%+
- Average search-to-purchase time decreased by 10%+
- API response time < 500ms (p95)

**Qualitative:**

- Users find products/posts more easily
- Reduced "no results" scenarios
- Positive user feedback

---

## Additional Resources

- [Sanity Embeddings Index Documentation](https://www.sanity.io/docs/compute-and-ai/embeddings-index-api-overview)
- [Sanity Embeddings Index CLI Reference](https://www.sanity.io/docs/compute-and-ai/embeddings-index-cli-reference)
- [Sanity Embeddings HTTP API Reference](https://www.sanity.io/docs/compute-and-ai/embeddings-index-http-api-reference)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Reference Implementation (Astro)](../../../fabryka-atrakcji/apps/astro/src/pages/api/embeddings.ts)

---

## Notes & Decisions

### Why not use client-side fetching?

- Bearer token must remain secret (server-side only)
- Better performance with server-side caching
- Reduced client bundle size

### Why separate indexes for products and blog?

- Different document structures
- Different projection fields
- Better performance (smaller indexes)
- Easier to manage and update independently

### Why use Route Handlers vs Server Actions?

- RESTful API pattern (easier to test)
- Can be called from anywhere (not just React)
- Better error handling
- Standard HTTP semantics

---

## Appendix

### A. Example API Request

```bash
curl -X POST http://localhost:3000/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "searchQuery": "słuchawki bezprzewodowe",
    "type": "products"
  }'
```

### B. Example API Response

```json
{
  "data": [
    {
      "score": 0.923,
      "value": {
        "documentId": "product-123",
        "type": "product"
      }
    },
    {
      "score": 0.891,
      "value": {
        "documentId": "product-456",
        "type": "product"
      }
    }
  ],
  "count": 2
}
```

### C. Example GROQ Query with Embeddings

```groq
*[
  _type == "product"
  && (!defined($embeddingResults) || _id in $embeddingResults[].value.documentId)
  && (!defined($brands) || brand->slug.current in $brands)
] {
  _id,
  name,
  slug,
  price,
  brand->,
  "_score": select(
    defined($embeddingResults) => $embeddingResults[value.documentId == ^._id][0].score,
    0
  )
} | order(
  select(
    defined($embeddingResults) => _score desc,
    _createdAt desc
  )
) [0...20]
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-12  
**Author:** AI Assistant  
**Approved By:** [Pending]
