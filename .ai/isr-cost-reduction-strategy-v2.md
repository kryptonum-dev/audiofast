# ISR Cost Reduction Strategy v2

## Problem Statement

After implementing v1 changes (specific tags + reverse lookup + simplified dependency map), ISR costs remain at ~$3-9/day. Vercel observability shows **1.6M write units** over 30 days with write-to-read ratios as high as 26:1 on some routes.

### Why v1 Didn't Work

The v1 changes added specific tags **alongside** broad tags but never stopped the broad tags from firing. Three root causes were missed:

1. **Denormalization cascade** — A brand edit patches N products via Sanity API. Each patched product fires a new webhook (the filter `!(_id in path("drafts.**"))` doesn't exclude these). A brand with 30 products creates 31 webhooks instead of 1, multiplying every other problem.
2. **`brand` broad tag on product edits** — `product: ['products', 'brand']` means every product webhook (including 30 denorm-triggered ones) invalidates ALL ~30 brand pages. One brand edit = 31 × 30 = ~930 brand page invalidations.
3. **Time-based revalidations** — `cacheLife('hours')` on 5 functions causes ~11K time-based regenerations (~367/day) even when nothing changes.

### Current Top Offenders (from Vercel Observability)

| Route | Writes | Reads | Ratio | Write Units |
|-------|--------|-------|-------|-------------|
| `/ [slug]` (CMS pages) | 250 | 83 | 3:1 | 23K |
| `/marki/dan-dagostino` | 266 | 10 | 26:1 | 11K |
| `/produkty` | 486 | 24 | 20:1 | 9.2K |
| `/marki/shunyata-research` | 176 | 9 | 19:1 | 6.7K |
| + PPR segments | ~150 each | — | — | ~3K each |

---

## Changes Overview

| # | Change | Est. Impact |
|---|--------|-------------|
| 1 | Kill denormalization cascade (webhook filter) | ~50-60% reduction |
| 2 | Targeted brand invalidation (slug-specific brand tags) | ~15-20% reduction |
| 3 | Slug-specific CMS page tags | ~5-10% reduction |
| 4 | Kill `cacheLife('hours')` on 5 functions | ~367 writes/day saved |
| 5 | Narrow reverse lookup scope | Small (prevents future bloat) |
| 6 | Fix `ProductsListing` tag bug (`product` vs `products`) | Correctness fix |

---

## Change 1: Kill the Denormalization Cascade

### Problem

When a brand is edited, the revalidation route patches products with denormalized fields (`denormBrandSlug`, `denormBrandName`, `denormLastSync`). Each patch fires a new Sanity webhook because the filter only excludes drafts. This creates a cascade:

```
Brand edited → 1 webhook → patches 30 products → 30 more webhooks → each revalidates `products` + `brand`
```

### Fix

Update the Sanity webhook filter in the Sanity dashboard to exclude denorm-only mutations. Add a condition that detects when only denormalization fields changed:

```groq
!(_id in path("drafts.**"))
&& !(_type == "product" && delta::changedAny("denormLastSync") && !delta::changedAny("name", "slug", "subtitle", "shortDescription", "brand", "categories", "previewImage", "basePriceCents", "seo", "relatedProducts", "pageBuilder", "technicalData", "details", "awards", "downloadablePdfs", "availableInStores", "imageGallery", "additionalImages", "compareSection", "orderRank"))
```

The logic: if a product document changed and `denormLastSync` changed but NO user-editable field changed, it's a denorm-only mutation — skip the webhook.

### Alternative (simpler)

If the delta syntax causes issues, a simpler approach: check for `denormLastSync` only:

```groq
!(_id in path("drafts.**")) && !(_type == "product" && delta::changedAny("denormLastSync") && !delta::changedAny("name"))
```

This skips webhooks for any product mutation that touches `denormLastSync` without also touching `name` (which a real user edit would almost always include along with other fields).

### Expected Result

Brand edit: 1 webhook instead of 31. Product listing and brand pages invalidated once instead of 31 times.

---

## Change 2: Targeted Brand Invalidation

### Problem

Brand pages all share `cacheTag('brand')`. The product dependency map includes `brand`, so every product edit invalidates ALL ~30 brand pages. Only the 1-2 relevant brand pages need updating.

### Fix

**Step A** — Make brand pages use slug-specific tags:

```typescript
// apps/web/src/app/marki/[slug]/page.tsx
async function getBrandContent(slug: string) {
  'use cache';
  cacheTag('brand', `brand:${slug}`);  // Add slug-specific tag
  cacheLife('weeks');
  // ...
}
```

**Step B** — Remove `brand` from product dependency map:

```typescript
product: ['products'],  // Was: ['products', 'brand']
```

**Step C** — Add a brand lookup in the revalidation route for product edits. When a product is edited, query its current brand slug and revalidate only that brand page:

```typescript
// In the revalidation route, for product type changes:
const productBrand = await client.fetch(
  `*[_type == "product" && _id == $id][0]{ "brandSlug": brand->slug.current }`,
  { id: doc._id }
);
if (productBrand?.brandSlug) {
  const slug = extractSlug(productBrand.brandSlug);
  if (slug) tags.add(`brand:${slug}`);
}
```

**Step D** — For brand type changes, keep broad `brand` tag so all brand pages update when a brand document itself is edited:

```typescript
brand: ['brands', 'products', 'brand'],  // Unchanged — brand edits still hit all brand pages
```

### Edge Case: Product Moves Between Brands

When a product moves from Brand A to Brand B, we only know Brand B (current). Brand A's page may show a stale product count until the next brand edit or time-based expiration. This is acceptable because brand reassignment is rare.

### Expected Result

Product edit: 1 brand page invalidated instead of 30.

---

## Change 3: Slug-Specific CMS Page Tags

### Problem

All CMS pages under `/ [slug]` share the broad `page` tag. Editing any CMS page invalidates all of them. Plus, the reverse lookup from product edits adds `page:${slug}` tags, causing CMS pages to regenerate frequently. These are the largest pages (550KB-896KB each), making them the #1 offender by write units.

### Fix

**Step A** — Remove the broad `page` tag from data fetching:

```typescript
// apps/web/src/app/[slug]/page.tsx
async function fetchPageData(slug: string) {
  return await sanityFetch<...>({
    query: queryPageBySlug,
    params: { slug: sanitySlug },
    tags: [`page:${slug}`],  // Was: ['page', `page:${slug}`]
  });
}
```

Same for `generateMetadata` in the same file.

**Step B** — Update the dependency map for `page` type changes. Instead of the broad `page` tag, use the specific slug from the webhook payload:

```typescript
// In the revalidation route, for page type changes:
if (doc._type === 'page' && doc.slug) {
  const slug = extractSlug(doc.slug);
  if (slug) tags.add(`page:${slug}`);
}
```

Keep `page: []` in the static dependency map (no broad cascade) and handle it dynamically using the slug from the webhook.

### Expected Result

CMS page edit: 1 page invalidated instead of all ~15. Saves ~23K write units/month.

---

## Change 4: Kill `cacheLife('hours')`

### Problem

Five functions use `cacheLife('hours')`, causing ~11K time-based revalidations over 30 days (~367/day). Since all of these functions already have cache tags for on-demand revalidation, the time-based expiration is redundant.

### Files to Change

| File | Function | Current | New |
|------|----------|---------|-----|
| `apps/web/src/app/blog/(listing)/page.tsx` | `getStaticPageData` | `'hours'` | `'weeks'` |
| `apps/web/src/app/blog/(listing)/kategoria/[category]/page.tsx` | `getStaticBlogData` | `'hours'` | `'weeks'` |
| `apps/web/src/app/blog/(listing)/kategoria/[category]/page.tsx` | `getPageContent` | `'hours'` | `'weeks'` |
| `apps/web/src/app/produkty/(listing)/kategoria/[category]/page.tsx` | `getStaticFilterMetadata` | `'hours'` | `'weeks'` |
| `apps/web/src/app/produkty/(listing)/kategoria/[category]/page.tsx` | `getPageContent` | `'hours'` | `'weeks'` |

### Expected Result

Eliminates ~367 unnecessary ISR writes per day.

---

## Change 5: Narrow Reverse Lookup Scope

### Problem

The reverse lookup query `*[references($id)]` searches the entire Sanity dataset. With the denorm cascade (#1) generating many lookups, this amplifies damage to CMS pages and other documents.

### Fix

Limit the query to only document types that matter:

```groq
*[references($id) && _type in ["product", "page", "homePage", "cpoPage", "review", "blog-article"] && !(_id in path("drafts.**"))]
{ _type, "slug": slug.current }
```

This prevents the lookup from accidentally pulling in studio-only documents, draft references, or other irrelevant types.

### Expected Result

Small reduction in ISR writes, prevents future issues as the dataset grows.

---

## Change 6: Fix `ProductsListing` Tag Bug

### Problem

The `ProductsListing` component (used on brand pages, products listing, category pages) fetches products with `tags: ['product']` (singular). But the dependency map revalidates `products` (plural) for product type changes. The `product` singular tag is **never revalidated** by the dependency map, meaning the product listing data relies solely on `cacheLife('weeks')` expiration.

### Fix

Change the tag in `ProductsListing`:

```typescript
// apps/web/src/components/products/ProductsListing/index.tsx
const productsData = await sanityFetch<...>({
  query,
  params: { ... },
  tags: ['products'],  // Was: ['product'] (singular — never revalidated)
});
```

### Expected Result

Product listings on brand pages and listing pages now correctly invalidate when the `products` tag is revalidated. This is a correctness fix, not a cost reduction.

---

## Implementation Order

| Step | Change | Risk |
|------|--------|------|
| 1 | Kill denorm cascade (Sanity webhook filter) | Low — dashboard config only |
| 2 | Targeted brand invalidation (code changes) | Medium — needs testing |
| 3 | Slug-specific CMS page tags | Low — straightforward |
| 4 | Kill `cacheLife('hours')` | Low — 5 simple edits |
| 5 | Narrow reverse lookup scope | Low — query tweak |
| 6 | Fix `ProductsListing` tag bug | Low — 1 line change |

---

## Expected Outcome

| Metric | Before (v1) | After (v2) |
|--------|-------------|------------|
| Brand edit ISR writes | ~930 (31 webhooks × 30 brand pages) | ~32 (1 webhook × 30 brand pages + listings) |
| Product edit ISR writes | ~30+ brand pages + listings | ~3-5 (1 brand page + listing + related) |
| Time-based writes/day | ~367 | 0 |
| Daily ISR cost | ~$3-9 | Target: <$0.50 |
