# ISR Cost Reduction Strategy

## Problem Statement

Current Vercel ISR costs are ~$5/day due to excessive cache invalidation. When a single product is edited, the current system invalidates **612+ pages** instead of the ~37 pages that actually need updating.

### Root Causes Identified

| Issue | Impact | Severity |
|-------|--------|----------|
| Broad cache tags (`product` for all 551 products) | One edit invalidates ALL pages of that type | **Critical** |
| Aggressive `TYPE_DEPENDENCY_MAP` | One product edit triggers 10 tag revalidations | **High** |
| Denormalization webhook loop | Brand edit → patches products → triggers more webhooks | **High** |

### Current vs Target

| Metric | Current | Target |
|--------|---------|--------|
| Pages invalidated per product edit | ~612 | ~37 |
| Daily ISR writes (5 edits, 10% visited) | ~306 | ~19 |
| Daily ISR cost | ~$5 | ~$0.30 |

---

## Solution Overview

### Key Changes

1. **Hybrid tag strategy** - Specific tags for products (`product:${slug}`), broad tags for brands (`brand`)
2. **Reverse lookup for references** - Find pages that reference the edited document
3. **Simplified dependency map** - Remove unnecessary cascades
4. **Webhook filter for denorm** - Prevent webhook cascade from denormalization

### Why Hybrid Tags (Not Fully Specific)?

When a product's brand changes (e.g., Product X moves from Suniata to Yamaha):
- The **new brand page** (Yamaha) needs to show Product X
- The **old brand page** (Suniata) needs to stop showing Product X

**Problem:** The webhook only provides the NEW brand, not the OLD brand. We can't know which old brand page to invalidate.

**Solution:** Keep brand pages on a broad `brand` tag. When any product is edited, all ~30 brand pages are invalidated. This is acceptable because:
- Only ~30 brand pages (not 551 products)
- Brand membership changes require full brand page updates anyway

---

## Phase 1: Hybrid Cache Tags

### Concept

| Page Type | Tag Strategy | Reason |
|-----------|--------------|--------|
| Product pages | Specific (`product:${slug}`) | 551 pages, must be specific |
| Brand pages | Broad (`brand`) | ~30 pages, brand membership changes |
| Blog pages | Specific (`blog-article:${slug}`) | No cross-references |
| Review pages | Specific (`review:${slug}`) | No cross-references |
| CMS pages | Specific (`page:${slug}`) | Few pages |

### Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/produkty/[slug]/page.tsx` | Add `product:${slug}` tag |
| `apps/web/src/app/marki/[slug]/page.tsx` | Keep broad `brand` tag (no change needed) |
| `apps/web/src/app/blog/[slug]/page.tsx` | Add `blog-article:${slug}` tag |
| `apps/web/src/app/recenzje/[slug]/page.tsx` | Add `review:${slug}` tag |
| `apps/web/src/app/[slug]/page.tsx` | Add `page:${slug}` tag |

### Implementation Pattern

```typescript
// Product page - specific tag
export default async function ProductPage({ params }) {
  const { slug } = await params;
  
  const product = await sanityFetch({
    query: queryProductBySlug,
    params: { slug: `/produkty/${slug}/` },
    tags: ['product', `product:${slug}`],  // Specific tag added
  });
  
  // ...
}

// Brand page - broad tag (unchanged)
export default async function BrandPage({ params }) {
  const { slug } = await params;
  
  const brand = await sanityFetch({
    query: queryBrandBySlug,
    params: { slug },
    tags: ['brand'],  // Broad tag - all brand pages
  });
  
  // ...
}
```

---

## Phase 2: Reverse Lookup in Webhook Handler

### Concept

When Product X is edited, query Sanity to find all documents that reference Product X, then revalidate only those specific pages.

### What Gets Revalidated (Product Edit)

| Target | Tag | Condition |
|--------|-----|-----------|
| Product X's page | `product:${slug}` | Always |
| Products listing | `products` | Always |
| **All brand pages** | `brand` | **Always (hybrid approach)** |
| Products referencing X | `product:${refSlug}` | Found via reverse lookup |
| Home page | `homePage` | If references X |
| CMS pages | `page:${refSlug}` | If reference X |

### Expected Impact (Real Data)

Based on actual usage: **max 4 products reference any given product**

| Component | Pages Revalidated |
|-----------|------------------|
| Product's own page | 1 |
| Products listing | 1 |
| Brand pages (all) | ~30 |
| Related products | 0-4 |
| Home page (if ref) | 0-1 |
| **Total** | **~37 max** |
| **Current system** | **~612** |

### Implementation

```typescript
// In webhook handler
async function handleProductEdit(doc: { _id: string; slug: string }) {
  const tags: string[] = [];
  
  // 1. This product's page
  tags.push(`product:${doc.slug}`);
  
  // 2. Products listing
  tags.push('products');
  
  // 3. ALL brand pages (hybrid approach - can't know old brand)
  tags.push('brand');
  
  // 4. Reverse lookup - find documents referencing this product
  const references = await sanityClient.fetch<Array<{
    _type: string;
    slug: string | null;
  }>>(
    `*[references($id) && !(_id in path("drafts.**"))]{ _type, "slug": slug.current }`,
    { id: doc._id }
  );
  
  for (const ref of references) {
    if (ref._type === 'product' && ref.slug) {
      tags.push(`product:${extractSlug(ref.slug)}`);
    } else if (ref._type === 'homePage') {
      tags.push('homePage');
    } else if (ref._type === 'page' && ref.slug) {
      tags.push(`page:${extractSlug(ref.slug)}`);
    } else if (ref._type === 'cpoPage') {
      tags.push('cpoPage');
    }
    // Add other types as needed
  }
  
  // Revalidate all collected tags with immediate expiration
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }
}
```

### Latency Consideration

| Operation | Time |
|-----------|------|
| Current (no lookup) | ~50-100ms |
| With reverse lookup | ~200-500ms |

The +300ms latency is acceptable because:
- Sanity webhooks timeout at 30s
- Editor doesn't wait (async after Publish)
- Query is simple and indexed

### Sanity API Cost

- Adds 1 query per webhook
- At 600 webhooks/month = 600 extra requests
- Negligible compared to typical API quotas

---

## Phase 3: Update Sanity Webhook Projection

### Current Projection (Sanity Dashboard)

```groq
{
  "_type": _type,
  "_id": _id,
  "slug": slug.current
}
```

### New Projection

```groq
{
  "_type": _type,
  "_id": _id,
  "slug": slug.current,
  "operation": delta::operation()
}
```

Note: We no longer need `brandSlug` in projection since we revalidate all brand pages anyway.

---

## Phase 4: Simplified Dependency Map

### New TYPE_DEPENDENCY_MAP

The dependency map should only include **listing tags**, not specific document tags. Specific document tags are handled by the reverse lookup.

```typescript
const TYPE_DEPENDENCY_MAP: Record<string, string[]> = {
  // Core content - listings and related
  product: ['products', 'brand'],  // brand = all brand pages (hybrid)
  brand: ['brands', 'products', 'brand'],  // affects all brand pages + products filter
  review: [],
  'blog-article': ['blog'],
  
  // Categories
  productCategorySub: ['products', 'productCategorySub'],
  productCategoryParent: ['products'],
  'blog-category': ['blog', 'blog-category'],
  
  // Singletons - only themselves
  homePage: ['homePage'],
  cpoPage: ['cpoPage'],
  blog: ['blog'],
  products: ['products'],
  brands: ['brands'],
  page: ['page'],
  
  // Global - these affect all pages
  settings: ['settings'],
  navbar: ['navbar'],
  footer: ['footer'],
  
  // Legal
  privacyPolicy: ['privacyPolicy'],
  termsAndConditions: ['termsAndConditions'],
  notFound: ['notFound'],
};
```

### Key Removals

**From `product`:** Removed `homePage`, `page`, `review`, `blog-article`, `cpoPage`, `comparatorConfig`
- These are now handled by reverse lookup if they actually reference the product

**From `brand`:** Removed specific product tags
- All brand pages use broad `brand` tag

---

## Phase 5: Webhook Filter for Denormalization

### Problem

Current flow creates webhook cascade:
```
Brand edited → Webhook fires → Handler patches 50 products → 50 more webhooks fire
```

### Solution

Keep denormalization in webhook handler, but configure Sanity webhook to NOT fire for denorm-only changes.

### Sanity Webhook Filter (Dashboard)

```groq
!(_id in path("drafts.**"))
&& delta::changedAny('name', 'slug', 'title', 'content', 'brand', 'categories', 'previewImage', 'seo', 'basePriceCents', 'shortDescription', 'additionalImages', 'compareSection', 'reviewSection', 'relatedProducts')
```

This prevents webhooks from firing when only `denormBrandSlug`, `denormBrandName`, `denormLastSync` change.

### New Flow

```
Editor publishes brand
    ↓
Webhook fires (once, for brand)
    ↓
Handler denormalizes products (patches denorm fields)
    ↓
Products are patched but NO webhook fires (denorm fields filtered)
    ↓
Handler revalidates brand tag + products listing
```

---

## Implementation Order

| Step | Task | Risk | Time |
|------|------|------|------|
| 1 | Simplify `TYPE_DEPENDENCY_MAP` with hybrid approach | Low | 30 min |
| 2 | Add specific tags to product/blog/review/page detail pages | Medium | 2 hours |
| 3 | Update webhook handler with reverse lookup | Medium | 2 hours |
| 4 | Update Sanity webhook projection (Dashboard) | Low | 15 min |
| 5 | Configure webhook filter for denorm (Dashboard) | Low | 15 min |

**Total estimated time:** ~5 hours

---

## Testing Plan

### Before Deployment

1. **Unit test reverse lookup query** - Verify it returns correct references
2. **Test specific tag invalidation** - Edit product, verify only that page + brand pages are stale

### After Deployment

1. **Edit a product** → Verify ~37 pages become stale (not 612)
2. **Change product's brand** → Verify both old and new brand pages show correct products
3. **Edit a brand** → Verify denormalization works, no webhook cascade
4. **Monitor Vercel dashboard** → Track ISR writes for 48 hours
5. **Verify content accuracy** → Check that related products show updated data

### Success Criteria

- ISR writes reduced by 90%+ (from ~300/day to ~20/day)
- No stale content on pages that should be updated
- Webhook response time < 1 second
- No errors in Vercel function logs
- **Brand membership changes work correctly** (product appears in new brand, disappears from old)

---

## Rollback Plan

Each phase can be rolled back independently:

| Phase | Rollback Action |
|-------|----------------|
| 1 | Restore original `TYPE_DEPENDENCY_MAP` |
| 2 | Pages work with or without specific tags |
| 3 | Remove reverse lookup, use broad tags |
| 4 | Restore original webhook projection |
| 5 | Remove webhook filter |

---

## Appendix: ISR Write Mechanics

### When Does an ISR Write Happen?

ISR writes occur when a **user visits a stale page**, NOT when `revalidateTag()` is called.

```
revalidateTag('product:x') → Cache entry marked as stale (no write)
revalidateTag('product:x') → Already stale (no write)
revalidateTag('product:x') → Already stale (no write)
User visits page → Regeneration happens (1 ISR write)
```

Multiple revalidateTag calls to the same tag = still only 1 ISR write when visited.

### Cost Driver

The cost comes from **how many different pages become stale**, not how many times you call revalidateTag.

| Strategy | Pages Stale | ISR Writes (if 10% visited) |
|----------|-------------|----------------------------|
| Current (broad tags) | 612 | 61 |
| Hybrid (specific products, broad brands) | 37 | 4-7 |

---

## Appendix: Related Products Analysis

### Data Point

Maximum products referencing any given product: **4**

### Impact on Reverse Lookup

| Products Referencing | Additional ISR Writes |
|---------------------|----------------------|
| 0 | 0 |
| 1-2 | 1-2 |
| 3-4 | 3-4 |

This makes reverse lookup very cost-effective for this codebase.

---

## Appendix: Why Keep `{ expire: 0 }`?

The client prefers immediate content updates over stale-while-revalidate:

| Profile | Behavior | User Experience |
|---------|----------|-----------------|
| `{ expire: 0 }` | Immediate expiration, blocking regeneration | User waits for regeneration (sees fresh content) |
| `'max'` | Stale-while-revalidate | User gets instant response (but may see stale content briefly) |

**Important:** Both profiles result in the **same number of ISR writes**. The difference is only in user experience.

---

## Summary

| Before | After |
|--------|-------|
| 1 product edit = 612 pages stale | 1 product edit = ~37 pages stale |
| ~$5/day ISR cost | ~$0.30/day ISR cost |
| Product brand change = stale data on old brand | Product brand change = both brands updated correctly |
| Denormalization causes webhook cascade | Webhook filter prevents cascade |
