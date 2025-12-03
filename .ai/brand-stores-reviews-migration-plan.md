# Brand Stores & Reviews Migration Plan

## Overview

This document outlines the comprehensive strategy for adding **stores (dealers)** and updating **reviews** relationships on brand documents, along with implementing the **store inheritance** pattern where products fallback to brand stores when no product-specific stores are defined.

---

## Current State Analysis

### Brand Schema (Current)

```typescript
// apps/studio/schemaTypes/documents/collections/brand.ts
// Current fields:
- name (string)
- slug (slug)
- logo (image)
- description (portableText)
- heroImage (image, optional)
- bannerImage (image, optional)
- brandContentBlocks (array of content blocks)
- distributionYear (object, optional)
- imageGallery (array of images, optional)
- featuredReviews (array of review references) ✅ ALREADY EXISTS with filter
- seo (object)
```

### Brand Page Query (Current)

The current `queryBrandBySlug` fetches stores by **aggregating from all products** of that brand:

```groq
"stores": array::unique(
  *[
    _type == "product" && 
    !(_id in path("drafts.**")) && 
    brand._ref == ^._id &&
    defined(availableInStores)
  ].availableInStores[]->{...}
)
```

### Product Schema (Current)

```typescript
// apps/studio/schemaTypes/documents/collections/product.ts
availableInStores: {
  type: 'array',
  of: [{ type: 'reference', to: [{ type: 'store' }] }],
  validation: Rule.min(1).error('Produkt musi być dostępny w co najmniej jednym salonie')
}
// Currently REQUIRED (min 1)
```

### Legacy Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `Dealer_ProducerPage` | Brand-Dealer relationships | `DealerID`, `ProducerPageID` |
| `Dealer` | Store data | `ID` → already migrated to Sanity |
| `ReviewProduct` | Product-Review relationships | `ProductID`, `ReviewID` |
| `BoxReviews` | Reviews in product boxes | `ProductID`, `ReviewPageID`, `BoxID` |

---

## Target State

### 1. Brand Schema (Updated)

Add `stores` field - array of store references:

```typescript
defineField({
  name: 'stores',
  title: 'Salony dystrybucji',
  type: 'array',
  description: 'Wybierz salony, w których dostępne są produkty tej marki.',
  of: [{ type: 'reference', to: [{ type: 'store' }] }],
  // Optional, unlimited
})
```

### 2. Product Schema (Updated)

Make `availableInStores` **optional** (remove min validation):

```typescript
defineField({
  name: 'availableInStores',
  title: 'Dostępny w salonach (opcjonalny)',
  type: 'array',
  description: 'Opcjonalnie wybierz salony dla tego produktu. Jeśli puste, używane są salony marki.',
  of: [{ type: 'reference', to: [{ type: 'store' }] }],
  // NO validation - fully optional
})
```

### 3. Store Inheritance Logic

```
Product Page Store Display Logic:
┌─────────────────────────────────────────────────────────────┐
│  IF product.availableInStores has stores                   │
│  THEN → Display product.availableInStores                  │
├─────────────────────────────────────────────────────────────┤
│  ELSE IF brand.stores has stores                           │
│  THEN → Display brand.stores                               │
├─────────────────────────────────────────────────────────────┤
│  ELSE → Don't render StoreLocations component              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Schema Changes

### 1.1 Update Brand Schema

**File:** `apps/studio/schemaTypes/documents/collections/brand.ts`

**Changes:**
1. Add `stores` field (array of store references, optional, unlimited)
2. Keep `featuredReviews` field as-is (already has correct filter validation)

```typescript
// Add after imageGallery field:
defineField({
  name: 'stores',
  title: 'Salony dystrybucji',
  type: 'array',
  description:
    'Wybierz salony, w których dostępne są produkty tej marki. Produkty bez własnych salonów odziedziczą te salony.',
  group: GROUP.MAIN_CONTENT,
  of: [
    {
      type: 'reference',
      to: [{ type: 'store' }],
      options: {
        filter: ({ document }) => {
          const selectedIds = Array.isArray(document?.stores)
            ? document.stores.map((item: any) => item._ref).filter(Boolean)
            : [];
          return {
            filter: '!(_id in $selectedIds)',
            params: { selectedIds },
          };
        },
      },
    },
  ],
}),
```

### 1.2 Update Product Schema

**File:** `apps/studio/schemaTypes/documents/collections/product.ts`

**Changes:**
1. Make `availableInStores` optional (remove min(1) validation)
2. Update description to explain inheritance

```typescript
defineField({
  name: 'availableInStores',
  title: 'Dostępny w salonach (opcjonalny)',
  type: 'array',
  description:
    'Opcjonalnie wybierz salony dla tego produktu. Jeśli puste, na stronie produktu wyświetlone zostaną salony przypisane do marki.',
  of: [
    {
      type: 'reference',
      to: [{ type: 'store' }],
      options: {
        filter: ({ document }) => {
          const selectedIds = Array.isArray(document?.availableInStores)
            ? document.availableInStores.map((item: any) => item._ref).filter(Boolean)
            : [];
          return {
            filter: '!(_id in $selectedIds)',
            params: { selectedIds },
          };
        },
      },
    },
  ],
  // NO validation - fully optional (inherits from brand)
  group: GROUP.MAIN_CONTENT,
}),
```

---

## Phase 2: Query Updates

### 2.1 Update Brand Query

**File:** `apps/web/src/global/sanity/query.ts`

**Update `queryBrandBySlug`:**
- Fetch `stores` directly from brand document
- Remove dynamic aggregation from products

```groq
// Before (dynamic aggregation):
"stores": array::unique(
  *[_type == "product" && brand._ref == ^._id].availableInStores[]->{...}
)

// After (direct from brand):
stores[]->{
  _id,
  name,
  "slug": slug.current,
  address { postalCode, city, street },
  phone,
  website
},
```

### 2.2 Update Product Query

**File:** `apps/web/src/global/sanity/query.ts`

**Update `queryProductBySlug`:**
- Add brand stores to the query
- Fetch both product stores and brand stores for fallback logic

```groq
// In queryProductBySlug, update brand-> to include stores:
brand->{
  _id,
  name,
  "slug": slug.current,
  ${imageFragment('logo')},
  stores[]->{
    _id,
    name,
    "slug": slug.current,
    address { postalCode, city, street },
    phone,
    website
  }
},
// Keep existing availableInStores fetch
availableInStores[]->{...},
```

---

## Phase 3: Frontend Updates

### 3.1 Update Product Page

**File:** `apps/web/src/app/produkty/[slug]/page.tsx`

**Changes:**
1. Implement store inheritance logic
2. Pass correct stores to `StoreLocations` component

```typescript
// Determine which stores to display
const effectiveStores = 
  (product.availableInStores && product.availableInStores.length > 0)
    ? product.availableInStores
    : (product.brand?.stores && product.brand.stores.length > 0)
      ? product.brand.stores
      : null;

// Update sections visibility
const sections = [
  // ... other sections
  {
    id: 'gdzie-kupic',
    label: 'Gdzie kupić',
    visible: !!effectiveStores && effectiveStores.length > 0,
  },
  // ...
];

// Render with effective stores
{effectiveStores && effectiveStores.length > 0 && (
  <StoreLocations
    customId="gdzie-kupic"
    stores={effectiveStores.filter((s) => s !== null)}
  />
)}
```

### 3.2 Update Brand Page

**File:** `apps/web/src/app/marki/[slug]/page.tsx`

**Changes:**
1. Update to use `brand.stores` directly (already rendering correctly)
2. Ensure proper null checks

The brand page already has:
```tsx
{brand.stores && Array.isArray(brand.stores) && brand.stores.length > 0 && (
  <StoreLocations
    customId="gdzie-kupic"
    stores={brand.stores.filter((s) => s !== null)}
  />
)}
```

This will work once we update the query to fetch `stores` directly from brand.

### 3.3 Update TypeScript Types

**Run typegen after schema changes:**

```bash
cd apps/studio
bun run sanity typegen generate
```

---

## Phase 4: Data Migration

### 4.1 Migration Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Extract Brand-Dealer relationships from legacy DB     │
│  • Table: Dealer_ProducerPage                                  │
│  • Output: brands-dealers.csv                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Map legacy Dealer IDs to Sanity Store IDs             │
│  • Query existing stores in Sanity                             │
│  • Build mapping: legacyDealerId → sanityStoreId               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Map legacy Brand IDs to Sanity Brand IDs              │
│  • Query existing brands in Sanity                             │
│  • Build mapping: legacyBrandId → sanityBrandId                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Update each brand with stores array                   │
│  • For each brand, find all associated dealers                 │
│  • Create store references array                               │
│  • Patch brand document                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Clear product.availableInStores where appropriate     │
│  • Products inheriting from brand don't need their own stores  │
│  • Optional: Remove duplicate store assignments                │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 CSV Export: Brand-Dealer Relationships

**SQL Query for phpMyAdmin:**

```sql
SELECT
  dp.ID,
  dp.DealerID,
  dp.ProducerPageID as BrandID,
  st_brand.URLSegment as BrandSlug,
  st_brand.Title as BrandName,
  d.Company as DealerName
FROM Dealer_ProducerPage dp
JOIN SiteTree st_brand ON dp.ProducerPageID = st_brand.ID
JOIN Dealer d ON dp.DealerID = d.ID
WHERE st_brand.ClassName = 'ProducerPage'
ORDER BY st_brand.Title, d.Company;
```

**Expected CSV columns:**
| Column | Description |
|--------|-------------|
| `ID` | Relationship ID |
| `DealerID` | Legacy dealer/store ID |
| `BrandID` | Legacy brand ID |
| `BrandSlug` | Brand URL segment |
| `BrandName` | Brand name |
| `DealerName` | Dealer/store name |

**Save as:** `csv/brands/brands-dealers.csv`

### 4.3 Migration Script Architecture

```
apps/studio/scripts/migration/brands/
├── migrate-brand-stores.ts           # Main migration script
├── update-brand-stores.ts            # Update stores on existing brands
├── parser/
│   └── csv-parser.ts                 # CSV parsing (reuse existing)
├── utils/
│   ├── store-resolver.ts             # Resolve legacy dealer → Sanity store
│   └── brand-resolver.ts             # Resolve legacy brand → Sanity brand
├── types.ts                          # TypeScript interfaces
└── README.md                         # Usage documentation
```

### 4.4 Migration Script: Update Brand Stores

```typescript
// apps/studio/scripts/migration/brands/update-brand-stores.ts

interface BrandDealerRelation {
  dealerId: number;
  brandId: number;
  brandSlug: string;
  brandName: string;
  dealerName: string;
}

interface StoreMapping {
  legacyDealerId: number;
  sanityStoreId: string;
}

interface BrandMapping {
  legacyBrandId: number;
  sanityBrandId: string;
  brandSlug: string;
}

async function migrateBrandStores() {
  // 1. Load CSV data
  const relations = await parseCSV<BrandDealerRelation>('csv/brands/brands-dealers.csv');
  
  // 2. Query Sanity for all stores and brands
  const stores = await client.fetch(`*[_type == "store"]{_id, name}`);
  const brands = await client.fetch(`*[_type == "brand"]{"id": _id, "slug": slug.current, name}`);
  
  // 3. Build store mapping (using store migration pattern)
  // Stores were migrated with deterministic UUIDs from dealer IDs
  const storeMap = new Map<number, string>();
  // Map by matching names or using migration ID pattern
  
  // 4. Build brand mapping
  const brandMap = new Map<string, string>(); // brandSlug → sanityBrandId
  brands.forEach(b => {
    const slug = b.slug?.replace('/marki/', '').replace(/\/$/, '');
    brandMap.set(slug, b.id);
  });
  
  // 5. Group relations by brand
  const brandStores = new Map<string, string[]>(); // brandSlug → storeIds[]
  relations.forEach(rel => {
    const brandId = brandMap.get(rel.brandSlug);
    const storeId = storeMap.get(rel.dealerId);
    if (brandId && storeId) {
      if (!brandStores.has(rel.brandSlug)) {
        brandStores.set(rel.brandSlug, []);
      }
      brandStores.get(rel.brandSlug)!.push(storeId);
    }
  });
  
  // 6. Update each brand
  for (const [brandSlug, storeIds] of brandStores) {
    const brandId = brandMap.get(brandSlug);
    if (!brandId) continue;
    
    const storeRefs = storeIds.map((id, idx) => ({
      _type: 'reference',
      _ref: id,
      _key: `store-${idx}`,
    }));
    
    await client.patch(brandId)
      .set({ stores: storeRefs })
      .commit();
  }
}
```

### 4.5 Usage Commands

```bash
# Dry run - preview brand-store assignments
bun run apps/studio/scripts/migration/brands/update-brand-stores.ts --dry-run

# Migrate all brand stores
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/brands/update-brand-stores.ts

# Migrate single brand by slug
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/brands/update-brand-stores.ts --brand="audio-research"

# Verbose output
SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/brands/update-brand-stores.ts --verbose
```

---

## Phase 5: Product Store Cleanup (Optional)

### 5.1 Overview

After migrating stores to brands, we can optionally clean up product `availableInStores` for products that have the same stores as their brand. This simplifies data management.

### 5.2 Cleanup Logic

```typescript
// For each product:
// 1. Get product.availableInStores
// 2. Get product.brand.stores
// 3. If identical (same stores), clear product.availableInStores
// 4. Product will then inherit from brand

async function cleanupProductStores() {
  const products = await client.fetch(`
    *[_type == "product" && defined(availableInStores)]{
      _id,
      "productStores": availableInStores[]._ref,
      "brandStores": brand->stores[]._ref
    }
  `);
  
  for (const product of products) {
    const productStores = new Set(product.productStores || []);
    const brandStores = new Set(product.brandStores || []);
    
    // If product stores exactly match brand stores, clear them
    if (setsEqual(productStores, brandStores) && brandStores.size > 0) {
      await client.patch(product._id)
        .unset(['availableInStores'])
        .commit();
    }
  }
}
```

---

## Phase 6: Validation

### 6.1 Validation Queries (GROQ)

```groq
// Count brands with stores
count(*[_type == "brand" && count(stores) > 0])

// Brands without stores
*[_type == "brand" && (!defined(stores) || count(stores) == 0)]{name, _id}

// Count total brand-store relationships
{
  "totalBrands": count(*[_type == "brand"]),
  "brandsWithStores": count(*[_type == "brand" && count(stores) > 0]),
  "totalStoreRefs": count(*[_type == "brand"].stores[])
}

// Products with own stores vs inheriting
{
  "productsWithOwnStores": count(*[_type == "product" && count(availableInStores) > 0]),
  "productsInheritingFromBrand": count(*[_type == "product" && (!defined(availableInStores) || count(availableInStores) == 0)])
}

// Verify store references are valid
*[_type == "brand" && count(stores[!defined(@->)]) > 0]{
  name,
  _id,
  "brokenRefs": count(stores[!defined(@->)])
}
```

### 6.2 Frontend Validation

After all changes:
1. [ ] Brand pages show stores in "Gdzie kupić" section
2. [ ] Product pages with own stores show those stores
3. [ ] Product pages without stores show brand stores
4. [ ] Product pages with no brand stores hide "Gdzie kupić" section
5. [ ] Sticky navigation updates correctly based on store visibility

---

## Implementation Checklist

### Phase 1: Schema Changes
- [ ] Add `stores` field to brand schema
- [ ] Make `availableInStores` optional in product schema
- [ ] Run `sanity typegen generate`

### Phase 2: Query Updates
- [ ] Update `queryBrandBySlug` to fetch `stores` directly
- [ ] Update `queryProductBySlug` to include `brand->stores`

### Phase 3: Frontend Updates
- [ ] Update product page with store inheritance logic
- [ ] Verify brand page works with direct stores
- [ ] Update TypeScript types if needed

### Phase 4: Data Migration
- [ ] Export `brands-dealers.csv` from legacy database
- [ ] Create `update-brand-stores.ts` migration script
- [ ] Run migration dry-run
- [ ] Execute migration
- [ ] Validate results

### Phase 5: Cleanup (Optional)
- [ ] Run product store cleanup script
- [ ] Verify inheritance works correctly

### Phase 6: Final Validation
- [ ] Run GROQ validation queries
- [ ] Test brand pages
- [ ] Test product pages with various store configurations
- [ ] Verify StoreLocations component renders correctly

---

## Success Criteria

### Quantitative
- [ ] All brands have stores from legacy `Dealer_ProducerPage` relationships
- [ ] 100% of valid brand-dealer relationships migrated
- [ ] <1% broken store references

### Qualitative
- [ ] Brand pages display stores correctly
- [ ] Product pages inherit stores from brand when not specified
- [ ] Product pages with specific stores override brand stores
- [ ] StoreLocations component hidden when no stores available
- [ ] Sanity Studio shows stores field on brand documents

---

## Rollback Strategy

### Schema Rollback
Revert schema changes:
- Remove `stores` field from brand
- Re-add validation to product `availableInStores`

### Data Rollback
```groq
// Clear all brand stores
*[_type == "brand" && defined(stores)] | {
  _id,
  stores
} → patch each with unset(['stores'])
```

---

**Document Version**: 1.0  
**Created**: 2025-12-03  
**Status**: Ready for Implementation

### Related Documents
- `product-migration-plan.md` - Product migration details
- `award-migration-plan.md` - Award migration details
- `data-migration-strategy.md` - Overall migration strategy
- `brand-migration-flow.md` - Original brand migration

