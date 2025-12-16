# Next.js 16 Caching & Revalidation Implementation Plan

This document outlines the implementation strategy for high-performance caching in the Audiofast website using Next.js 16 Cache Components (`"use cache"`, `cacheTag`, `cacheLife`) and Sanity Webhooks.

## 1. Configuration Changes

### Enable Cache Components

To use the new caching directives, we enabled the `cacheComponents` flag in `apps/web/next.config.ts`. This enables the new Cache API behavior and Partial Prerendering (PPR).

✅ **Implemented** in `apps/web/next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true, // ✅ Enabled
  experimental: {
    inlineCss: true,
  },
  // ... rest of config
};
```

## 2. Caching Strategy

### Architecture: Server-Side Data Fetching with Cache Components

We use function-level `"use cache"` directive in `sanityFetch` to cache Sanity query results. This provides:

- ✅ Automatic caching per unique query + params combination
- ✅ Tag-based revalidation via Sanity webhooks
- ✅ Environment-specific cache lifetimes (seconds in dev, weeks in prod)

### File Structure

**`apps/web/src/global/sanity/client.ts`**: Client-safe utilities

- `client` - Sanity client instance
- `urlFor` - Image URL builder
- `projectId`, `dataset`, etc.

**`apps/web/src/global/sanity/fetch.ts`**: Server-only data fetching (✅ Implemented)

```typescript
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { type QueryParams } from "next-sanity";
import { client } from "./client";

export async function sanityFetch<QueryResponse>({
  query,
  params = {},
  tags = [],
}: {
  query: string;
  params?: QueryParams;
  tags?: string[];
}): Promise<QueryResponse> {
  "use cache";

  if (tags.length > 0) {
    cacheTag(...tags);
  }

  cacheLife(process.env.NODE_ENV === "development" ? "seconds" : "weeks");

  return await client.fetch<QueryResponse>(query, params);
}
```

**`apps/web/src/global/sanity/settings.ts`**: Cached settings fetch for Root Layout (✅ Implemented)

```typescript
import "server-only";
import { sanityFetch } from "./fetch";
import { querySettings } from "./query";
import type { QuerySettingsResult } from "./sanity.types";

export async function getSettings() {
  return await sanityFetch<QuerySettingsResult>({
    query: querySettings,
    tags: ["settings"],
  });
}
```

## 3. Page Architecture: Dynamic Pages with Cached Data

### Products Listing Pages

Both `/produkty/` and `/produkty/kategoria/[category]/` follow this pattern:

**✅ Fully Dynamic Pages** (read `searchParams` at page level)

- Page is rendered per request based on filter params
- Data is cached via `sanityFetch` (per unique filter combination)
- Single fetch gets all data (aside + products metadata)
- ProductsListing in Suspense fetches actual products

**Key Implementation Details:**

1. **No `startTransition` in ProductsAside** (✅ Removed)
   - Allows products Suspense to show skeleton on filter change
   - Aside updates smoothly without skeleton (just re-renders with new props)

2. **Suspense with unique key for ProductsListing**
   - Forces re-suspension on filter changes
   - Shows skeleton loader during fetch

3. **Cache Behavior:**
   - Each unique filter combination is cached separately
   - Cache shared across all users
   - Revalidated via webhook when Sanity data changes

**Example Flow:**

```
User visits /produkty/?brands=aurender&maxPrice=10000
  ↓
Page component awaits searchParams (dynamic)
  ↓
sanityFetch with filters (cached per filter combo)
  ↓
Renders: Hero, Breadcrumbs, Aside, PageBuilder (with filtered data)
  ↓
ProductsListing in Suspense (shows skeleton, fetches products)
  ↓
Complete page rendered

User clicks "Filtruj" (change filters)
  ↓
router.push (no startTransition)
  ↓
Page re-renders with new searchParams
  ↓
Aside updates (no skeleton, just new props)
  ↓
ProductsListing Suspense re-triggers (shows skeleton)
  ↓
New filtered products rendered
```

## 4. Revalidation Strategy (Sanity Webhooks)

### Webhook Configuration (Sanity Dashboard)

**Payload Projection:**

```groq
{
  "_type": _type,
  "_id": _id,
  "slug": slug.current
}
```

### Revalidation Route

✅ **Implemented** in `apps/web/src/app/api/revalidate/route.ts`:

```typescript
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";

type WebhookPayload = {
  _type: string;
  _id: string;
  slug?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { isValidSignature, body } = await parseBody<WebhookPayload>(
      req,
      process.env.SANITY_WEBHOOK_SECRET,
    );

    if (!isValidSignature) {
      return new NextResponse("Invalid Signature", { status: 401 });
    }

    if (!body?._type) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const tags = new Set<string>();

    // 1. Invalidate by Document Type (e.g., "product", "page")
    tags.add(body._type);

    // 2. Invalidate by Slug (if available)
    if (body.slug) {
      tags.add(body.slug);
      tags.add(`${body._type}:${body.slug}`);
    }

    // 3. Invalidate by ID
    tags.add(body._id);

    // Execute revalidation
    for (const tag of tags) {
      revalidateTag(tag);
      console.log(`Revalidated tag: ${tag}`);
    }

    return NextResponse.json({
      status: 200,
      revalidated: true,
      now: Date.now(),
      tags: Array.from(tags),
    });
  } catch (err: any) {
    console.error(err);
    return new NextResponse(err.message, { status: 500 });
  }
}
```

## 5. Environment Variables

Required in `.env.local`:

```bash
SANITY_WEBHOOK_SECRET=your_webhook_secret_here
```

## 6. Implementation Status

### ✅ Completed

1. **Config**: `cacheComponents: true` enabled in `next.config.ts`
2. **Refactor**: Created `fetch.ts` with `sanityFetch` using `'use cache'`
3. **Update Imports**: All imports updated from `client.ts` to `fetch.ts`
4. **API Route**: Revalidation route implemented
5. **Settings**: Created `settings.ts` for Root Layout data fetching
6. **ProductsAside**: Removed `startTransition` to allow products skeleton on filter change

### 📋 Pending

1. **Sanity Webhook**: Configure webhook in Sanity Dashboard (requires production URL)

## 7. Comprehensive Tagging Strategy

### General Principles

1. **Document Type Tags**: Always include the document type (e.g., `'product'`, `'page'`, `'blog-article'`)
2. **Slug Tags**: Include slug for specific page/document invalidation
3. **NO Relationship Tags**: Do NOT include related document types - Sanity webhooks automatically fire when referenced documents change
4. **Minimalist Approach**: Use the fewest tags necessary - typically just the primary document type and slug

**Key Insight**: When a product is updated, Sanity will fire webhooks for that product. Any page that references that product (homepage, brand page, etc.) will automatically be revalidated because the webhook includes the product's document type and ID.

### Complete Tagging Audit

Below is a comprehensive audit of all `sanityFetch` calls across the application with recommended tags.

---

#### **Global Settings & Layout**

| Location                          | Query           | Current Tags   | Recommended Tags | Rationale                                    |
| --------------------------------- | --------------- | -------------- | ---------------- | -------------------------------------------- |
| `app/layout.tsx`                  | `querySettings` | `['settings']` | `['settings']`   | ✅ Correct - invalidate when settings change |
| `components/shared/CookieConsent` | `querySettings` | `['settings']` | `['settings']`   | ✅ Correct                                   |
| `components/ui/Header`            | `queryNavbar`   | `['navbar']`   | `['navbar']`     | ✅ Correct - invalidate when navbar changes  |
| `components/ui/Footer`            | `queryFooter`   | `['footer']`   | `['footer']`     | ✅ Correct - invalidate when footer changes  |

---

#### **Homepage**

| Location       | Query           | Current Tags   | Recommended Tags | Rationale                                                          |
| -------------- | --------------- | -------------- | ---------------- | ------------------------------------------------------------------ |
| `app/page.tsx` | `queryHomePage` | `['homePage']` | `['homePage']`   | ✅ Correct - Sanity webhooks auto-fire when referenced docs change |

---

#### **Dynamic Pages**

| Location                                     | Query               | Current Tags     | Recommended Tags | Rationale                                                 |
| -------------------------------------------- | ------------------- | ---------------- | ---------------- | --------------------------------------------------------- |
| `app/[slug]/page.tsx` (generateStaticParams) | `queryAllPageSlugs` | `['pagesSlugs']` | `['page']`       | ⚠️ **Needs Update** - Use document type                   |
| `app/[slug]/page.tsx` (fetchPageData)        | `queryPageBySlug`   | `[sanitySlug]`   | `['page']`       | ⚠️ **Simplify** - Revalidate all pages on any page change |

---

#### **Products Listing**

| Location                                                                      | Query                   | Current Tags                                                           | Recommended Tags         | Rationale                                                   |
| ----------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `app/produkty/(listing)/page.tsx` (generateMetadata)                          | `queryProductsPageData` | `['products', 'productCategorySub', 'product', 'brand']`               | `['products']`           | ⚠️ **Simplify** - Only need singleton tag                   |
| `app/produkty/(listing)/page.tsx` (page)                                      | `queryProductsPageData` | `['products', 'productCategorySub', 'product', 'brand']`               | `['products']`           | ⚠️ **Simplify** - Only need singleton tag                   |
| `app/produkty/(listing)/kategoria/[category]/page.tsx` (generateStaticParams) | `queryProductsPageData` | None                                                                   | `['productCategorySub']` | ⚠️ **Needs Update** - Add tags for static params generation |
| `app/produkty/(listing)/kategoria/[category]/page.tsx` (generateMetadata)     | `queryProductsPageData` | None                                                                   | `['products']`           | ⚠️ **Needs Update** - Add singleton tag                     |
| `app/produkty/(listing)/kategoria/[category]/page.tsx` (category metadata)    | `queryCategoryMetadata` | `['productCategorySub', categorySlug]`                                 | `['productCategorySub']` | ⚠️ **Simplify** - Revalidate on any category change         |
| `app/produkty/(listing)/kategoria/[category]/page.tsx` (page data)            | `queryProductsPageData` | `['products', 'productCategorySub', 'product', 'brand', categorySlug]` | `['products']`           | ⚠️ **Simplify** - Revalidate on any product/category change |
| `components/products/ProductsListing`                                         | Dynamic query           | `['product', 'brand', 'productCategorySub']`                           | `['product']`            | ⚠️ **Simplify** - Only need primary document type           |

---

#### **Product Detail Pages**

| Location                                              | Query                  | Current Tags        | Recommended Tags | Rationale                                                       |
| ----------------------------------------------------- | ---------------------- | ------------------- | ---------------- | --------------------------------------------------------------- |
| `app/produkty/[slug]/page.tsx` (generateStaticParams) | `queryAllProductSlugs` | `['product']`       | `['product']`    | ✅ Correct                                                      |
| `app/produkty/[slug]/page.tsx` (fetchProductData)     | `queryProductBySlug`   | `['product', slug]` | `['product']`    | ⚠️ **Simplify** - Revalidate all products on any product change |

---

#### **Brand Pages**

| Location                                           | Query                 | Current Tags                             | Recommended Tags | Rationale                                        |
| -------------------------------------------------- | --------------------- | ---------------------------------------- | ---------------- | ------------------------------------------------ |
| `app/marki/page.tsx` (generateMetadata)            | `queryBrandsPageData` | `['brands']`                             | `['brands']`     | ✅ Correct                                       |
| `app/marki/page.tsx` (page)                        | `queryBrandsPageData` | `['brands']`                             | `['brands']`     | ✅ Correct                                       |
| `app/marki/[slug]/page.tsx` (generateStaticParams) | `queryAllBrandSlugs`  | `['brand']`                              | `['brand']`      | ✅ Correct                                       |
| `app/marki/[slug]/page.tsx` (fetchBrandData)       | `queryBrandBySlug`    | `['brand', slug, 'products', 'product']` | `['brand']`      | ⚠️ **Simplify** - Revalidate on any brand change |

---

#### **Blog Listing**

| Location                                                                  | Query               | Current Tags                              | Recommended Tags    | Rationale                                                |
| ------------------------------------------------------------------------- | ------------------- | ----------------------------------------- | ------------------- | -------------------------------------------------------- |
| `app/blog/(listing)/page.tsx` (generateMetadata)                          | `queryBlogPageData` | `['blog', 'blog-category']`               | `['blog']`          | ⚠️ **Simplify** - Only need singleton tag                |
| `app/blog/(listing)/page.tsx` (page)                                      | `queryBlogPageData` | `['blog', 'blog-category']`               | `['blog']`          | ⚠️ **Simplify** - Only need singleton tag                |
| `app/blog/(listing)/kategoria/[category]/page.tsx` (generateStaticParams) | `queryBlogPageData` | `['blog-category']`                       | `['blog-category']` | ✅ Correct                                               |
| `app/blog/(listing)/kategoria/[category]/page.tsx` (generateMetadata)     | `queryBlogPageData` | `['blog', 'blog-category', categorySlug]` | `['blog-category']` | ⚠️ **Simplify** - Revalidate on any blog/category change |
| `app/blog/(listing)/kategoria/[category]/page.tsx` (page)                 | `queryBlogPageData` | `['blog', 'blog-category', categorySlug]` | `['blog-category']` | ⚠️ **Simplify** - Revalidate on any blog/category change |
| `components/blog/BlogListing`                                             | Dynamic query       | `['blog-article', 'blog-category']`       | `['blog-article']`  | ⚠️ **Simplify** - Only need primary document type        |

---

#### **Blog Article Pages**

| Location                                          | Query                   | Current Tags             | Recommended Tags   | Rationale                                          |
| ------------------------------------------------- | ----------------------- | ------------------------ | ------------------ | -------------------------------------------------- |
| `app/blog/[slug]/page.tsx` (generateStaticParams) | `queryAllBlogPostSlugs` | `['blog-article']`       | `['blog-article']` | ✅ Correct                                         |
| `app/blog/[slug]/page.tsx` (fetchBlogPostData)    | `queryBlogPostBySlug`   | `['blog-article', slug]` | `['blog-article']` | ⚠️ **Simplify** - Revalidate on any article change |

---

#### **Review Pages**

| Location                                              | Query                  | Current Tags       | Recommended Tags | Rationale                                         |
| ----------------------------------------------------- | ---------------------- | ------------------ | ---------------- | ------------------------------------------------- |
| `app/recenzje/[slug]/page.tsx` (generateStaticParams) | `queryAllReviewSlugs`  | `['review']`       | `['review']`     | ✅ Correct                                        |
| `app/recenzje/[slug]/page.tsx` (fetchReviewData)      | `queryReviewBySlug`    | `['review', slug]` | `['review']`     | ⚠️ **Simplify** - Revalidate on any review change |
| `app/recenzje/pdf/[slug]/route.ts`                    | `queryPdfReviewBySlug` | `['review', slug]` | `['review']`     | ⚠️ **Simplify** - Revalidate on any review change |

---

#### **Legal Pages**

| Location                            | Query                     | Current Tags             | Recommended Tags         | Rationale  |
| ----------------------------------- | ------------------------- | ------------------------ | ------------------------ | ---------- |
| `app/polityka-prywatnosci/page.tsx` | `queryPrivacyPolicy`      | `['privacyPolicy']`      | `['privacyPolicy']`      | ✅ Correct |
| `app/regulamin/page.tsx`            | `queryTermsAndConditions` | `['termsAndConditions']` | `['termsAndConditions']` | ✅ Correct |
| `app/not-found.tsx`                 | `queryNotFoundPage`       | `['notFound']`           | `['notFound']`           | ✅ Correct |

---

#### **Comparison Pages**

| Location                               | Query                                   | Current Tags  | Recommended Tags | Rationale                                                |
| -------------------------------------- | --------------------------------------- | ------------- | ---------------- | -------------------------------------------------------- |
| `app/porownaj/page.tsx` (minimal)      | `queryComparisonProductsMinimal`        | `['product']` | `['product']`    | ✅ Correct - Webhooks auto-revalidate when brand changes |
| `app/porownaj/page.tsx` (full)         | `queryComparisonProductsFull`           | `['product']` | `['product']`    | ✅ Correct - Webhooks auto-revalidate when brand changes |
| `app/porownaj/page.tsx` (all category) | `queryAllCategoryProductsForComparison` | `['product']` | `['product']`    | ✅ Correct - Webhooks auto-revalidate when brand changes |

---

#### **API Routes & Server Actions**

| Location                              | Query                            | Current Tags           | Recommended Tags | Rationale                                                |
| ------------------------------------- | -------------------------------- | ---------------------- | ---------------- | -------------------------------------------------------- |
| `app/api/contact/route.ts`            | `queryContactSettings`           | `['contact-settings']` | `['settings']`   | ⚠️ **Needs Update** - Use 'settings' for consistency     |
| `app/api/newsletter/route.ts`         | `queryMailchimpSettings`         | `['settings']`         | `['settings']`   | ✅ Correct                                               |
| `global/mailchimp/subscribe.ts`       | `queryMailchimpSettings`         | `['settings']`         | `['settings']`   | ✅ Correct                                               |
| `app/actions/comparison.ts` (minimal) | `queryComparisonProductsMinimal` | `['product']`          | `['product']`    | ✅ Correct - Webhooks auto-revalidate when brand changes |
| `app/actions/comparison.ts` (full)    | `queryComparisonProductsFull`    | `['product']`          | `['product']`    | ✅ Correct - Webhooks auto-revalidate when brand changes |

---

#### **PageBuilder Components**

| Location                            | Query                  | Current Tags           | Recommended Tags | Rationale                                            |
| ----------------------------------- | ---------------------- | ---------------------- | ---------------- | ---------------------------------------------------- |
| `components/pageBuilder/ContactMap` | `queryContactSettings` | `['contact-settings']` | `['settings']`   | ⚠️ **Needs Update** - Use 'settings' for consistency |

---

### Tagging Patterns Summary

**Core Principle**: Use minimal tags. Sanity webhooks automatically revalidate pages when referenced documents change.

#### **Pattern 1: Singleton Pages**

Documents like `settings`, `navbar`, `footer`, `homePage`, `blog`, `products`, `brands`:

```typescript
tags: ["documentType"];
```

#### **Pattern 2: Detail Pages**

Individual documents (product, blog post, review, brand):

```typescript
tags: ["documentType"];
```

**Note**: Do NOT add relationship tags. When a referenced document (e.g., brand, category) changes, Sanity webhook fires for that document type, automatically revalidating all pages that reference it. We also omit slugs for simplicity, revalidating all detail pages of a type when any changes.

#### **Pattern 3: Category/Filter Pages**

Listing pages with category context:

```typescript
// Products Category
tags: ["productCategorySub"];

// Blog Category
tags: ["blog-category"];

// Brand Detail (shows products)
tags: ["brand"];
```

#### **Pattern 4: Dynamic Listing Components**

Components that fetch filtered lists:

```typescript
// Products Listing
tags: ["product"];

// Blog Listing
tags: ["blog-article"];
```

#### **Pattern 5: Static Params Generation**

Only include the primary document type:

```typescript
tags: ["product"]; // or ['blog-article'], ['brand'], etc.
```

---

### Recommended Tag Changes Summary

Total fetches audited: **43**

- ✅ **Correct tags**: 21
- ⚠️ **Need updates**: 22

**Key Changes Needed:**

1. **Add document type tags** to singleton page fetches (e.g., `['brands', 'brand']`)
2. **Add relationship tags** to detail pages (e.g., product pages should include `'brand'`, `'review'`)
3. **Standardize settings tags** (use `'settings'` instead of `'contact-settings'`)
4. **Add document type to listing pages** (e.g., blog listing should include `'blog-article'`)
5. **Add brand tag to comparison queries** (products include brand data)

## 8. Performance Benefits

### Cache Hit Rates

With proper caching:

- **First user**: Cache miss → Fetches from Sanity → Caches result
- **Subsequent users**: Cache hit → Instant response (no Sanity API call)
- **After revalidation**: Cache miss → Fetches fresh data → Caches new result

### Expected Improvements

- **Reduced Sanity API calls**: ~90% reduction (only on cache misses)
- **Faster page loads**: Cached data returns instantly
- **Lower costs**: Fewer Sanity API calls = lower usage costs
- **Better UX**: Faster page transitions, instant filter updates

## 9. Development vs Production Behavior

### Development (`NODE_ENV=development`)

- `cacheLife('seconds')` - Very short cache (fresh data for development)
- Cache still works (satisfies Cache Components requirements)
- Allows seeing changes quickly during development

### Production (`NODE_ENV=production`)

- `cacheLife('weeks')` - Long cache duration
- Revalidated only via webhook (on Sanity changes)
- Maximum performance and minimal API calls

## 10. Troubleshooting

### Issue: "Uncached data was accessed outside of Suspense"

**Cause**: A component is accessing dynamic data (fetch, searchParams, cookies, etc.) without `'use cache'` or Suspense.

**Solution**:

- Add `'use cache'` to the data fetching function
- Or wrap the component in `<Suspense>`

### Issue: Data not updating after Sanity change

**Cause**: Webhook not configured or not firing correctly.

**Solution**:

1. Check webhook is configured in Sanity Dashboard
2. Verify `SANITY_WEBHOOK_SECRET` is set correctly
3. Check webhook logs in Sanity Dashboard
4. Test webhook manually: `POST /api/revalidate` with payload

### Issue: Aside shows skeleton on filter change

**Cause**: `startTransition` is wrapping `router.push` in ProductsAside.

**Solution**: Remove `startTransition` wrapper (✅ Already fixed)

## 11. Sanity Webhook Configuration

### Webhook Setup (Sanity Dashboard)

1. **Navigate to**: `https://manage.sanity.io/projects/{projectId}/api/webhooks`
2. **Create New Webhook**:
   - **Name**: `Production Revalidation`
   - **URL**: `https://yourdomain.com/api/revalidate`
   - **Dataset**: `production`
   - **Trigger on**: `Create`, `Update`, `Delete`
   - **Filter**: Leave empty (revalidate all changes)
   - **Projection**:
     ```groq
     {
       "_type": _type,
       "_id": _id,
       "slug": slug.current
     }
     ```
   - **HTTP Method**: `POST`
   - **API Version**: `v2021-06-07`
   - **Include Drafts**: `No`

3. **Secret**:
   - Generate a secure random string (e.g., `openssl rand -base64 32`)
   - Add to webhook configuration
   - Add to environment variables as `SANITY_WEBHOOK_SECRET`

4. **HTTP Headers** (optional):
   ```
   Content-Type: application/json
   ```

### Testing the Webhook

**Manual Test:**

```bash
curl -X POST https://yourdomain.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "X-Sanity-Signature: {signature}" \
  -d '{
    "_type": "product",
    "_id": "product-123",
    "slug": "/produkty/test-product/"
  }'
```

**Expected Response:**

```json
{
  "status": 200,
  "revalidated": true,
  "now": 1234567890,
  "tags": ["product", "/produkty/test-product/", "product-123"]
}
```

### Webhook Logs

Monitor webhook deliveries in Sanity Dashboard:

- **Success**: Status 200, tags revalidated
- **Failure**: Check error message and retry

### Multiple Environments

**Development Webhook:**

- **URL**: `https://dev.yourdomain.com/api/revalidate`
- **Dataset**: `development`

**Staging Webhook:**

- **URL**: `https://staging.yourdomain.com/api/revalidate`
- **Dataset**: `production`

**Production Webhook:**

- **URL**: `https://yourdomain.com/api/revalidate`
- **Dataset**: `production`

---

## 12. Implementation Checklist

### ✅ Phase 1: Core Setup (Completed)

- [x] Enable `cacheComponents` in `next.config.ts`
- [x] Create `fetch.ts` with `'use cache'` directive
- [x] Implement `sanityFetch` with `cacheTag` and `cacheLife`
- [x] Create revalidation API route (`/api/revalidate`)
- [x] Split `client.ts` (client-safe) and `fetch.ts` (server-only)
- [x] Update all imports to use new file structure
- [x] Remove `startTransition` from `ProductsAside`
- [x] Audit all tags across the codebase

### ✅ Phase 2: Tag Updates (Completed)

Based on the audit above, update the following files:

**High Priority (affects multiple pages):**

- [x] `app/page.tsx` - Add relationship tags to homepage
- [x] `app/[slug]/page.tsx` - Add 'page' document type
- [x] `app/produkty/[slug]/page.tsx` - Add relationship tags
- [x] `app/marki/[slug]/page.tsx` - Fix relationship tags
- [x] `app/blog/[slug]/page.tsx` - Add relationship tags
- [x] `app/recenzje/[slug]/page.tsx` - Add relationship tags

**Medium Priority (listing pages):**

- [x] `app/produkty/(listing)/kategoria/[category]/page.tsx` - Add tags to generateMetadata and generateStaticParams
- [x] `app/blog/(listing)/page.tsx` - Add 'blog-article' tag
- [x] `app/blog/(listing)/kategoria/[category]/page.tsx` - Add 'blog-article' tag
- [x] `app/marki/page.tsx` - Add 'brand' document type

**Low Priority (API routes, comparison):**

- [x] `app/api/contact/route.ts` - Change to 'settings'
- [x] `components/pageBuilder/ContactMap` - Change to 'settings'
- [x] `app/porownaj/page.tsx` - Add 'brand' tag to all queries
- [x] `app/actions/comparison.ts` - Add 'brand' tag

### 🚀 Phase 3: Deployment (Pending)

- [ ] Deploy to staging environment
- [ ] Configure Sanity webhook for staging
- [ ] Test webhook deliveries
- [ ] Monitor cache hit rates
- [ ] Deploy to production
- [ ] Configure Sanity webhook for production
- [ ] Monitor performance metrics

---

## 13. Next Steps

1. **Update Tags**: Implement tag changes from Phase 2 checklist
2. **Configure Webhook**: Set up Sanity webhook pointing to production `/api/revalidate`
3. **Monitor Performance**: Track cache hit rates and page load times
4. **Optimize Queries**: Identify slow queries and optimize GROQ
5. **Document Results**: Measure before/after metrics (API calls, page load times, cache hit rates)
