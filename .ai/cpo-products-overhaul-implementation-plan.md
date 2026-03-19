# CPO Products Overhaul — Implementation Plan

## Overview

Replace the current CPO system (a simple `isCPO` boolean flag on existing `product` documents) with a fully dedicated `cpoProduct` collection. Each CPO document represents an individual used specimen — with its own photos, descriptions, condition notes, and pricing — similar to a listing on Otomoto.

**Key change**: CPO products are no longer regular products with a flag. They are a separate document type with their own detail pages at `/certyfikowany-sprzet-uzywany/[slug]/`.

### Core Architectural Decision: Internal vs External CPO Products

The top-level field on every `cpoProduct` is `productType`: **"internal"** or **"external"**.

- **Internal** = an Audiofast-distributed product. Gets a full dedicated subpage at `/certyfikowany-sprzet-uzywany/[slug]/` with image gallery, long description, technical data, etc. References an existing `product` document. On the listing, clicking the card navigates to this detail page.
- **External** = a third-party product taken in trade. Has **no detail page** on Audiofast. On the listing, clicking the card navigates directly to the external URL. Only needs: name, preview image, short description, brand name, price, and external URL.

This toggle controls field visibility throughout the schema — internal products show slug, gallery, long description, technical data, and `internalProduct` reference; external products show only `externalUrl`, `externalLinkLabel`, and `otherBrandName`.

### What's Deferred

**Pricing / Cennik integration** is deferred until the client provides the Excel spreadsheet structure for CPO products. For now, CPO products will store price directly in Sanity as a simple `priceCents` number field (dummy content). The Supabase/Excel pipeline integration will be implemented later.

---

## Phase 1: Sanity Schema — New `cpoProduct` Document Type

### Step 1.1: Create the `cpoProduct` schema

**New file**: `apps/studio/schemaTypes/documents/collections/cpo-product.ts`

Create a new document type `cpoProduct`. The **first field after name** is `productType` — the top-level toggle that controls the entire document's behavior and field visibility.

#### Fields — Always Visible

| Field | Type | Description |
|---|---|---|
| `name` | `string` (from `defineSlugForDocument`) | Specimen name (e.g. "Momentum Z - egzemplarz #2") |
| `productType` | `string` (radio list) | **`"internal"`** or **`"external"`** — top-level architectural toggle. Default: `"internal"` |
| `previewImage` | `image` | Main preview image for listing cards and hero. Same definition as `product.previewImage` |
| `shortDescription` | `customPortableText` | Short description. Same config as `product.shortDescription` (optional, with default PT settings) |
| `priceCents` | `number` | Price in grosz (PLN × 100). Temporary direct field until cennik integration |
| `publishedDate` | `datetime` | Publication date for sorting. Same config as `product.publishedDate` |
| `isArchived` | `boolean` | Mark as sold/unavailable without deleting |
| SEO fields | via `getSEOFields` | Standard SEO fields |

#### Fields — Internal Only (hidden when `productType === "external"`)

| Field | Type | Description |
|---|---|---|
| `slug` | via `defineSlugForDocument` | Slug with prefix `/certyfikowany-sprzet-uzywany/`. Only internal products need a URL |
| `subtitle` | `string` | Optional subtitle (e.g. "Stan: bardzo dobry"). Same as `product.subtitle` |
| `brand` | `reference` to `brand` | Brand reference. Same as `product.brand` but not required |
| `internalProduct` | `reference` to `product` | Reference to the main Audiofast catalog product |
| `imageGallery` | `array` of `image` | Specimen photos. **Same structure as `product.imageGallery`** (array of image, lines 263–271 of product schema) |
| `details` | `object` | **Same structure as `product.details`** — contains `heading` (optional heading PT) and `productDetailContent` (rich PT with styles h3, lists, decorators, annotations, and components: ptMinimalImage, ptInlineImage, ptHeading, ptYoutubeVideo, ptVimeoVideo, ptPageBreak, ptTwoColumnLine, ptHorizontalLine, ptReviewEmbed). Lines 138–200 of product schema |
| `technicalData` | `object` | **Same structure as `product.technicalData`** — with `variants` (array of string), `groups` (array of sections with `title` and `rows`, where each row has `title` and `values` as Portable Text cells). Lines 580–768 of product schema. Managed via the same Technical Data tab editor |

#### Fields — External Only (hidden when `productType === "internal"`)

| Field | Type | Description |
|---|---|---|
| `otherBrandName` | `string` | Free-text brand name for non-distributed brands (e.g. "Naim Audio") |
| `externalUrl` | `url` | URL to manufacturer/distributor page. Required when external |
| `externalLinkLabel` | `string` | Label for external link (e.g. "Zobacz na stronie producenta"). Defaults to "Zobacz opis produktu" |

#### Conditional Visibility Rules

```typescript
// Internal-only fields: hidden when productType === "external"
hidden: ({ document }) => document?.productType === "external"

// External-only fields: hidden when productType === "internal" (or undefined/default)
hidden: ({ document }) => document?.productType !== "external"
```

**Slug handling**: The `defineSlugForDocument` helper generates both a `name` field and a `slug` field. Since we always need `name`, we use `defineSlugForDocument` with `source: "name"` and `prefix: "/certyfikowany-sprzet-uzywany/"`, but apply `hidden` to the slug field only (not the name field) for external products. External products still have a name (for the card), just no slug/URL.

**Preview**:

```typescript
preview: {
  select: {
    title: "name",
    brandName: "brand.name",
    otherBrandName: "otherBrandName",
    productType: "productType",
    media: "previewImage",
    isArchived: "isArchived",
  },
  prepare: ({ title, brandName, otherBrandName, productType, media, isArchived }) => ({
    title: `${isArchived ? "[ARCHIWUM] " : ""}${productType === "external" ? "[ZEW] " : ""}${title}`,
    subtitle: productType === "external" ? otherBrandName : brandName,
    media,
  }),
}
```

### Step 1.2: Register the schema

**File**: `apps/studio/schemaTypes/index.ts`

Add `cpoProduct` to the exported schema types array, alongside existing types like `product`, `brand`, etc.

### Step 1.3: Update `cpoPageBuilder` definition

**File**: `apps/studio/schemaTypes/definitions/pagebuilder.ts`

The `cpoPageBuilder` currently includes the `productsListing` block (which uses the old `isCPO` filter). We need to either:

- **Option A**: Create a new `cpoProductsListing` block that queries `cpoProduct` documents instead of `product` documents with `isCPO == true`.
- **Option B**: Modify the existing `productsListing` block to support a mode that queries `cpoProduct` documents.

**Recommended: Option A** — cleaner separation, no risk of breaking the existing products listing.

### Step 1.4: Create `cpoProductsListing` block

**New file**: `apps/studio/schemaTypes/blocks/cpo-products-listing.ts`

A new page builder block specifically for CPO product listings. Fields:

| Field | Type | Description |
|---|---|---|
| `heading` | `customPortableText` (heading type) | Section heading |

This block replaces `productsListing` with `cpoOnly: true` on the CPO page. No `cpoOnly` boolean needed — this block always queries `cpoProduct` documents.

Register this block in `cpoPageBuilder` (replace `productsListing` with `cpoProductsListing`).

---

## Phase 2: Sanity Studio Desk Structure

### Step 2.1: Update CPO section in studio structure

**File**: `apps/studio/structure.ts`

Current (lines 635–655):

```typescript
S.listItem()
  .title("CPO")
  .icon(BadgeCheck)
  .child(
    S.list()
      .title("CPO - Certyfikowany sprzęt używany")
      .items([
        createSingleTon({ S, type: "cpoPage" }),
        S.listItem()
          .title("Produkty CPO")
          .icon(Folder)
          .child(
            S.documentList()
              .title("Produkty CPO")
              .filter('_type == "product" && isCPO == true')
              // ...
          ),
      ]),
  ),
```

Replace the `Produkty CPO` list item to filter by `_type == "cpoProduct"` instead of `_type == "product" && isCPO == true`:

```typescript
S.listItem()
  .title("Produkty CPO")
  .icon(Folder)
  .child(
    S.documentList()
      .title("Produkty CPO")
      .filter('_type == "cpoProduct"')
      .defaultOrdering([{ field: "_createdAt", direction: "desc" }])
  ),
```

### Step 2.2: Hide `cpoProduct` from default "All Documents"

Ensure `cpoProduct` doesn't appear in the default document list by adding it to the type exclusion filter (if one exists), or by adding it to the custom structure so it only appears under the CPO section.

---

## Phase 3: GROQ Queries

### Step 3.1: Create CPO product fragment

**File**: `apps/web/src/global/sanity/query.ts`

Create a new `cpoProductFragment` for listing cards. This fragment must include `productType` so the card component knows whether to link internally or externally:

```groq
{
  _id,
  _createdAt,
  "publishDate": coalesce(publishedDate, _createdAt),
  "slug": slug.current,
  name,
  subtitle,
  priceCents,
  isArchived,
  productType,
  brand->{
    name,
    "slug": slug.current,
    ${imageFragment('logo')},
  },
  otherBrandName,
  externalUrl,
  ${imageFragment('"mainImage": previewImage')},
  ${portableTextFragment('shortDescription')},
}
```

### Step 3.2: Create listing query for CPO products

**File**: `apps/web/src/global/sanity/query.ts`

Note: the listing includes both internal and external products. Internal products have `defined(slug.current)`, external products don't — so the filter should NOT require `defined(slug.current)`:

```groq
// Query: all CPO products for listing (sorted by newest)
*[
  _type == "cpoProduct"
  && isArchived != true
] | order(coalesce(publishedDate, _createdAt) desc) [$offset...$limit] {
  ${cpoProductFragment}
}
```

### Step 3.3: Create detail page query (internal products only)

This query is only used for internal CPO products (those with their own subpage). The `details` field uses the same structure as `product.details` (with `heading` and `productDetailContent`):

```groq
// queryCpoProductBySlug
*[_type == "cpoProduct" && slug.current == $slug && productType == "internal"][0] {
  _id,
  _type,
  "slug": slug.current,
  name,
  subtitle,
  priceCents,
  productType,
  brand->{
    name,
    "slug": slug.current,
    ${imageFragment('logo')},
  },
  internalProduct->{
    _id,
    "slug": slug.current,
    name,
    subtitle,
    ${imageFragment('"mainImage": previewImage')},
    brand->{ name, "slug": slug.current },
  },
  ${imageFragment('previewImage')},
  imageGallery[]{
    ${imageFragment()}
  },
  ${portableTextFragment('shortDescription')},
  details {
    ${portableTextFragment('heading')},
    ${portableTextFragment('productDetailContent')},
  },
  technicalData,
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  },
}
```

### Step 3.4: Create slugs query for `generateStaticParams`

Only internal products have slugs/detail pages:

```groq
// queryAllCpoProductSlugs
*[_type == "cpoProduct" && defined(slug.current) && productType == "internal" && isArchived != true] {
  "slug": slug.current
}
```

### Step 3.5: Create SEO-only query

```groq
// queryCpoProductSeoBySlug
*[_type == "cpoProduct" && slug.current == $slug && productType == "internal"][0] {
  "slug": slug.current,
  name,
  brand->{ name },
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  },
}
```

### Step 3.6: Update `cpoProductsListing` block query in `pageBuilderFragment`

Replace the existing `productsListingBlock` (which filters `product` documents by `isCPO`) with a new `cpoProductsListingBlock` that queries `cpoProduct` documents:

```groq
_type == "cpoProductsListing" => {
  ...,
  ${portableTextFragment('heading')},
  "totalCount": count(*[
    _type == "cpoProduct"
    && defined(slug.current)
    && isArchived != true
  ]),
}
```

### Step 3.7: Update `queryCpoPage`

**File**: `apps/web/src/global/sanity/query.ts` (lines 802–818)

The query itself doesn't need to change (it fetches the `cpoPage` singleton and its `pageBuilder`). The change happens in the `pageBuilderFragment` where the new `cpoProductsListingBlock` replaces the old `productsListingBlock`.

---

## Phase 4: CPO Listing Page — Rewire to New Collection

### Step 4.1: Create new `CpoProductsListing` page builder component

**New file**: `apps/web/src/components/pageBuilder/CpoProductsListing/index.tsx`

This replaces the current `ProductsListing` component (when used with `cpoOnly: true`). It:

1. Fetches CPO products from the new `cpoProduct` collection
2. Renders a grid of CPO product cards
3. Supports pagination
4. Supports basic category filtering (via the brand reference on each CPO product, or via a simplified filter)

The component should follow the same patterns as the existing `ProductsListing` but query `cpoProduct` documents.

**Key differences from regular `ProductsListing`:**

- No `ProductsAside` with complex filters — CPO listing is simpler
- No price range filter, no custom dropdown filters
- Possibly: simple search, brand filter, or "brand type" filter (ours vs. other)
- Cards link to `/certyfikowany-sprzet-uzywany/[slug]/` instead of `/produkty/[slug]/`

### Step 4.2: Create `CpoProductCard` component (or adapt `ProductCard`)

**Decision**: Either create a new `CpoProductCard` or extend `ProductCard` with a `variant` prop.

**Recommended: Create a new `CpoProductCard`** since CPO cards have different data and link behavior:

- **Internal products**: card wraps in `<Link href="/certyfikowany-sprzet-uzywany/[slug]/">` — navigates to the detail page
- **External products**: card wraps in `<a href={externalUrl} target="_blank" rel="noopener noreferrer">` — navigates directly to the external URL
- Brand name comes from `brand.name` (internal) or `otherBrandName` (external)
- Brand logo: shown for internal (from `brand` reference), not available for external
- Price comes from `priceCents` directly (no `hasMultiplePrices`)
- No comparison button (CPO products are one-off specimens)
- Possibly a "CPO" badge or "Używany" label

### Step 4.3: Register in `PageBuilder`

**File**: `apps/web/src/components/shared/PageBuilder.tsx`

Add the new `cpoProductsListing` block type to the PageBuilder's component map:

```typescript
cpoProductsListing: CpoProductsListing,
```

### Step 4.4: Update the CPO page route

**File**: `apps/web/src/app/certyfikowany-sprzet-uzywany/page.tsx`

The page itself doesn't need major changes — it already fetches `queryCpoPage` and renders `PageBuilder`. The change flows through the PageBuilder block mapping: `cpoProductsListing` block → `CpoProductsListing` component → queries `cpoProduct` documents.

The `searchParams` handling may need adjustment if we change the filter/pagination approach.

---

## Phase 5: CPO Product Detail Page (Internal Products Only)

External CPO products have **no detail page** — they link directly to external URLs from the listing. This phase applies only to internal CPO products.

### Step 5.1: Create the route

**New file**: `apps/web/src/app/certyfikowany-sprzet-uzywany/[slug]/page.tsx`

Follow the exact pattern from `apps/web/src/app/produkty/[slug]/page.tsx`:

```typescript
// generateStaticParams — fetch only internal CPO product slugs
export async function generateStaticParams() {
  const products = await sanityFetch<QueryAllCpoProductSlugsResult>({
    query: queryAllCpoProductSlugs,
    tags: ['cpoProduct'],
  });
  return products
    .filter((p) => p.slug)
    .map((p) => ({
      slug: p.slug!.replace('/certyfikowany-sprzet-uzywany/', '').replace(/\/$/, ''),
    }));
}

// generateMetadata — SEO metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const seoData = await sanityFetch<QueryCpoProductSeoBySlugResult>({
    query: queryCpoProductSeoBySlug,
    params: { slug: `/certyfikowany-sprzet-uzywany/${slug}/` },
    tags: ['cpoProduct', `cpoProduct:${slug}`],
  });
  // ... generate metadata
}

// Page component
export default async function CpoProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await sanityFetch<QueryCpoProductBySlugResult>({
    query: queryCpoProductBySlug,
    params: { slug: `/certyfikowany-sprzet-uzywany/${slug}/` },
    tags: ['cpoProduct', `cpoProduct:${slug}`],
  });
  if (!product) notFound();

  // Render CPO product detail page
}
```

### Step 5.2: CPO Product Detail Page — Sections

The detail page should look **almost identical to a regular product page**, reusing the same components and data structures. The only differences are: no comparison button, no pricing configurator (just a flat price), and an "original product" link section.

**Layout:**

1. **Breadcrumbs** — `CPO - Certyfikowany sprzęt używany` → `Product Name`
2. **Hero section** — Create `CpoProductHero` (adapted from `ProductHero`):
   - Preview image (same `previewImage` field as product)
   - Brand logo (from `brand` reference)
   - Product name + subtitle
   - Flat price display (from `priceCents` — no configurator, no "od" prefix)
   - Short description (same `shortDescription` PT as product)
   - "Original product" link (mini card linking to the referenced `internalProduct`)
   - No comparison button, no awards
3. **PillsStickyNav** — Reuse as-is (same pattern as product page for section navigation)
4. **TwoColumnContent** — Reuse **as-is** with `product.details` data:
   - `unifiedContent={product.details?.productDetailContent}` (same PT structure)
   - `heading={product.details?.heading}` (same heading PT)
   - `gallery={product.imageGallery}` (same gallery structure → uses `ProductGallery` internally)
5. **TechnicalData** — Reuse **as-is**. Same `technicalData` structure with variants, groups, rows — the existing `TechnicalData` component works directly
6. **Contact CTA** — Inquiry form or link to contact page

**Components reused directly (no changes needed):**

- `Breadcrumbs` — as-is
- `ProductGallery` — as-is (accepts `images: SanityRawImage[]`, same data shape)
- `TwoColumnContent` — as-is (same `details` object structure with `heading` and `productDetailContent`)
- `TechnicalData` — as-is (same `technicalData` structure with `variants`, `groups`, `rows`)
- `PillsStickyNav` — as-is
- Portable Text renderer — as-is

**New components:**

- `CpoProductHero` — adapted from `ProductHero`: flat price display, "original product" link, no comparison/awards/configurator

### Step 5.3: "Original Product" link component

For internal CPO products, show a mini product card linking to the referenced Audiofast catalog product page (`internalProduct` reference). This could be a small component inside the hero or below it:

```
┌─────────────────────────────────────────┐
│ Zobacz pełny opis produktu              │
│ ┌───────────────────────────────────┐   │
│ │ [image] Brand Name ProductName    │   │ (link to /produkty/slug/)
│ │         Podtytuł produktu         │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

This component only appears on internal CPO product pages (external products don't have detail pages at all).

---

## Phase 6: Revalidation, SEO & Sitemap

### Step 6.1: Update revalidation webhook

**File**: `apps/web/src/app/api/revalidate/route.ts`

Add `cpoProduct` to `TYPE_DEPENDENCY_MAP`:

```typescript
const TYPE_DEPENDENCY_MAP: Record<string, string[]> = {
  // ... existing entries
  cpoProduct: ['cpoProduct', 'cpoPage'],  // invalidate the CPO listing + individual product
  // product already exists
};
```

Add `cpoProduct` to the reverse lookup query (line ~136) and add a handler for it:

```typescript
// In the references query
`*[references($id) && _type in ["product", "page", "homePage", "cpoPage", "cpoProduct", ...]]`

// In the handler
if (ref._type === 'cpoProduct') {
  const slug = ref.slug?.replace('/certyfikowany-sprzet-uzywany/', '').replace(/\/$/, '');
  if (slug) tags.push(`cpoProduct:${slug}`);
  tags.push('cpoPage'); // also invalidate the listing
  continue;
}
```

Also handle when a `brand` document changes — if it's referenced by `cpoProduct` documents, invalidate those too.

### Step 6.2: Update sitemap

**File**: `apps/web/src/app/sitemap.ts`

Add a dynamic query for CPO product slugs. Only internal products have detail pages, so only they go in the sitemap:

```typescript
// Existing static route for the listing page is already there:
// '/certyfikowany-sprzet-uzywany/'

// Add dynamic CPO product pages (internal only):
const cpoProducts = await sanityFetch<{ slug: string }[]>({
  query: queryAllCpoProductSlugsForSitemap, // filters productType == "internal"
  tags: ['cpoProduct'],
});

const cpoProductRoutes = cpoProducts
  .filter((p) => p.slug)
  .map((p) => ({
    url: `${BASE_URL}${p.slug}`,
    lastModified: new Date().toISOString(),
  }));
```

### Step 6.3: Generate TypeScript types

Run `bun run typegen` in the studio to regenerate `sanity.types.ts` after adding the new schema and queries.

---

## Phase 7: Cleanup — Remove Old CPO System

### Step 7.1: Remove `isCPO` from product schema

**File**: `apps/studio/schemaTypes/documents/collections/product.ts` (lines 301–307)

Remove the `isCPO` field definition. This will also require a Sanity migration to clean up the field from existing documents (or leave it as a no-op ghost field).

### Step 7.2: Remove old `productsListing` CPO logic

**File**: `apps/studio/schemaTypes/blocks/products-listing.ts`

Remove the `cpoOnly` field from the `productsListing` block (lines 22–29). This block should only be used for regular product listings.

### Step 7.3: Remove `productsListing` from `cpoPageBuilder`

**File**: `apps/studio/schemaTypes/definitions/pagebuilder.ts`

The `cpoPageBuilder` should include `cpoProductsListing` instead of `productsListing`. Remove `productsListing` from `pagebuilderBlockTypesWithProductsListing` (or rename it for clarity).

### Step 7.4: Clean up GROQ queries

**File**: `apps/web/src/global/sanity/query.ts`

- Remove `isCPO` from `productsFilterConditions` (line ~1368)
- Remove `isCPO` from `queryAllProductsFilterMetadata` projection (line ~1114)
- Remove `^.cpoOnly` logic from `productsListingBlock` (lines ~545–572)
- Remove `brandsDisplayMode == "cpoOnly"` from `brandsListBlock` (line ~525)
- Remove old `productsListingBlock` CPO-related conditionals

### Step 7.5: Clean up filter system

**Files**:
- `apps/web/src/global/filters/types.ts` — Remove `isCPO` from `ActiveFilters` type (lines 71–73)
- `apps/web/src/global/filters/computeFilters.ts` — Remove `isCPO` filter logic (lines 131–134) and all other `isCPO` references (~lines 22, 166, 185, 216, 237, 253, 273)
- `apps/web/src/components/products/ProductsAside/index.tsx` — Remove `isCPO: false` from `activeFilters` (lines ~198, ~233)

### Step 7.6: Clean up `ProductsListing` component

**File**: `apps/web/src/components/products/ProductsListing/index.tsx`

Remove the `isCPO` prop and its usage in the query params.

### Step 7.7: Clean up `ProductsListing` page builder component

**File**: `apps/web/src/components/pageBuilder/ProductsListing/index.tsx`

Remove all CPO-related logic:
- Remove `cpoOnly` prop handling (lines ~47, 56–58)
- Remove CPO-specific `visibleFilters` configuration (lines ~100–106)
- Remove `isCPO={cpoOnly}` prop pass (line ~122)

### Step 7.8: Update product migration transformer

**File**: `apps/studio/scripts/migration/products/transformers/product-transformer.ts`

Remove `isCPO: false` from the transformer (line ~354).

### Step 7.9: Update studio desk structure

Already handled in Phase 2 — the CPO section now uses `_type == "cpoProduct"`.

---

## Phase Summary & Dependencies

```
Phase 1: Sanity Schema (new cpoProduct type + cpoProductsListing block)
  │
  ├──► Phase 2: Studio Desk Structure (can run in parallel with Phase 3)
  │
  ├──► Phase 3: GROQ Queries (depends on Phase 1 for types)
  │      │
  │      ├──► Phase 4: CPO Listing Page (depends on Phase 3 for queries)
  │      │
  │      └──► Phase 5: CPO Detail Page (depends on Phase 3 for queries)
  │
  └──► Phase 6: Revalidation, SEO, Sitemap (depends on Phase 1 for types, Phase 3 for queries)

Phase 7: Cleanup (run LAST — only after Phases 1–6 are verified working)
```

### Estimated Effort

| Phase | Estimate |
|---|---|
| Phase 1: Sanity Schema | ~1h |
| Phase 2: Studio Structure | ~15min |
| Phase 3: GROQ Queries | ~1h |
| Phase 4: CPO Listing Page | ~1.5h |
| Phase 5: CPO Detail Page | ~2h |
| Phase 6: Revalidation + SEO | ~30min |
| Phase 7: Cleanup | ~45min |
| **Total** | **~7h** |

---

## Files to Create

| File | Purpose |
|---|---|
| `apps/studio/schemaTypes/documents/collections/cpo-product.ts` | CPO product document schema |
| `apps/studio/schemaTypes/blocks/cpo-products-listing.ts` | CPO products listing page builder block |
| `apps/web/src/app/certyfikowany-sprzet-uzywany/[slug]/page.tsx` | CPO product detail page route (internal products only) |
| `apps/web/src/components/pageBuilder/CpoProductsListing/index.tsx` | CPO listing page builder component |
| `apps/web/src/components/pageBuilder/CpoProductsListing/styles.module.scss` | Styles for CPO listing |
| `apps/web/src/components/ui/CpoProductCard/index.tsx` | CPO product card (handles both internal `<Link>` and external `<a target="_blank">`) |
| `apps/web/src/components/ui/CpoProductCard/styles.module.scss` | Styles for CPO card |
| `apps/web/src/components/cpo/CpoProductHero/index.tsx` | CPO product hero (adapted from ProductHero — flat price, no configurator/comparison) |
| `apps/web/src/components/cpo/CpoProductHero/styles.module.scss` | Styles for CPO hero |
| `apps/web/src/components/cpo/OriginalProductLink/index.tsx` | Mini card linking to the referenced catalog product |
| `apps/web/src/components/cpo/OriginalProductLink/styles.module.scss` | Styles for original product link |

**Components reused as-is (no new files needed):**

- `TechnicalData` — same data structure, works directly
- `TwoColumnContent` — same `details` object, works directly
- `ProductGallery` — same `imageGallery` array, works directly
- `PillsStickyNav` — same section pattern, works directly
- `Breadcrumbs` — as-is

## Files to Modify

| File | Change |
|---|---|
| `apps/studio/schemaTypes/index.ts` | Register `cpoProduct` and `cpoProductsListing` |
| `apps/studio/schemaTypes/definitions/pagebuilder.ts` | Add `cpoProductsListing` to `cpoPageBuilder`, remove `productsListing` from it |
| `apps/studio/structure.ts` | Update CPO section to use `cpoProduct` type |
| `apps/web/src/global/sanity/query.ts` | Add CPO queries, remove `isCPO` references |
| `apps/web/src/global/sanity/fetch.ts` | No changes needed |
| `apps/web/src/components/shared/PageBuilder.tsx` | Register `cpoProductsListing` component |
| `apps/web/src/app/api/revalidate/route.ts` | Add `cpoProduct` type handling |
| `apps/web/src/app/sitemap.ts` | Add CPO product pages |
| `apps/web/src/global/filters/types.ts` | Remove `isCPO` |
| `apps/web/src/global/filters/computeFilters.ts` | Remove `isCPO` filter logic |
| `apps/web/src/components/products/ProductsAside/index.tsx` | Remove `isCPO` references |
| `apps/web/src/components/products/ProductsListing/index.tsx` | Remove `isCPO` prop |
| `apps/web/src/components/pageBuilder/ProductsListing/index.tsx` | Remove `cpoOnly` logic |
| `apps/studio/schemaTypes/documents/collections/product.ts` | Remove `isCPO` field |
| `apps/studio/schemaTypes/blocks/products-listing.ts` | Remove `cpoOnly` field |
| `apps/studio/scripts/migration/products/transformers/product-transformer.ts` | Remove `isCPO` |
