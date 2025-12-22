# Product Denormalization Implementation Plan

## Overview

This document outlines the end-to-end implementation strategy for denormalizing product data in Sanity to optimize products listing query performance.

### Key Constraints & Solutions

| Constraint                                            | Solution                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| **Webhook limit (4 max)**                             | Extend existing revalidation webhook instead of creating a new one         |
| **CustomFiltersConfigView bypasses document actions** | Inline denormalization in `handleSaveProductValue` to update `_filterKeys` |
| **Brand/category renames need to cascade**            | Extended webhook handles brand/category types and updates products         |

### Problem Statement

The current products listing query takes **1.2-1.5 seconds** due to expensive GROQ operations:

- Reference dereferencing (`brand->`, `categories[]->`)
- String operations on every product (`string::split()`)
- Nested array filtering for custom filters

### Solution

Add pre-computed, denormalized fields to product documents that are:

### What Gets Denormalized vs What Doesn't

| Field                 | Denormalized?                        | Why                                          |
| --------------------- | ------------------------------------ | -------------------------------------------- |
| Brand slug            | ✅ Yes (`denormBrandSlug`)           | Avoids `brand->` deref and `string::split()` |
| Brand name            | ✅ Yes (`denormBrandName`)           | Avoids `brand->` deref                       |
| Category slugs        | ✅ Yes (`denormCategorySlugs`)       | Avoids `categories[]->` deref                |
| Parent category slugs | ✅ Yes (`denormParentCategorySlugs`) | Avoids nested deref                          |
| Dropdown filters      | ✅ Yes (`denormFilterKeys`)          | Pre-computed string keys for fast matching   |
| **Range filters**     | ❌ No                                | Require dynamic numeric comparison (min/max) |
| **Price**             | ❌ No                                | Already fast (simple numeric comparison)     |
| **CPO flag**          | ❌ No                                | Already fast (simple boolean)                |

> **Note on field naming**: Field names use `denorm` prefix instead of `_` prefix because Sanity reserves `_` for system fields.

> **Note**: Range filters (like "Impedancja: 4-16Ω") cannot be pre-computed because they require dynamic min/max comparison at query time. They still use `customFilterValues[].numericValue`, which is fine since it doesn't require dereferencing.

Add pre-computed, denormalized fields to product documents that are:

1. Populated automatically when products are saved
2. Updated via webhooks when referenced documents (brands, categories) change
3. Used in optimized GROQ queries that avoid dereferencing

### Expected Improvement

| Metric            | Before           | After (Expected) |
| ----------------- | ---------------- | ---------------- |
| Query time        | 1.2-1.5s         | 200-400ms        |
| Dereferencing     | On every query   | None             |
| String operations | On every product | Pre-computed     |

---

## Phase 1: Schema Changes

### Task 1.1: Add Denormalized Fields to Product Schema

**File**: `apps/studio/schemaTypes/documents/collections/product.ts`

Add the following hidden, computed fields after the existing `categories` field:

```typescript
// ----------------------------------------
// Denormalized Fields (Computed)
// ----------------------------------------
// These fields are automatically populated by document actions
// and used for optimized filtering in GROQ queries.
// DO NOT edit manually - they are kept in sync automatically.

defineField({
  name: "_brandSlug",
  title: "Brand Slug (computed)",
  type: "string",
  description: "Extracted brand slug without prefix (e.g., 'yamaha' from '/marki/yamaha/'). Auto-computed on save.",
  hidden: true,
  readOnly: true,
  group: GROUP.MAIN_CONTENT,
}),

defineField({
  name: "_brandName",
  title: "Brand Name (computed)",
  type: "string",
  description: "Denormalized brand name for display. Auto-computed on save.",
  hidden: true,
  readOnly: true,
  group: GROUP.MAIN_CONTENT,
}),

defineField({
  name: "_categorySlugs",
  title: "Category Slugs (computed)",
  type: "array",
  of: [{ type: "string" }],
  description: "Array of all category slugs this product belongs to. Auto-computed on save.",
  hidden: true,
  readOnly: true,
  group: GROUP.MAIN_CONTENT,
}),

defineField({
  name: "_parentCategorySlugs",
  title: "Parent Category Slugs (computed)",
  type: "array",
  of: [{ type: "string" }],
  description: "Array of parent category slugs. Auto-computed on save.",
  hidden: true,
  readOnly: true,
  group: GROUP.MAIN_CONTENT,
}),

defineField({
  name: "_filterKeys",
  title: "Filter Keys (computed)",
  type: "array",
  of: [{ type: "string" }],
  description: "Pre-computed filter keys for DROPDOWN filters only (e.g., 'kolor:czarny'). Range filters (numeric values) are not included - they still use customFilterValues.numericValue for numeric comparison. Auto-computed on save.",
  hidden: true,
  readOnly: true,
  group: GROUP.MAIN_CONTENT,
}),

defineField({
  name: "_lastDenormSync",
  title: "Last Denormalization Sync",
  type: "datetime",
  description: "Timestamp of last denormalization sync. Used for debugging.",
  hidden: true,
  readOnly: true,
  group: GROUP.MAIN_CONTENT,
}),
```

### Task 1.2: Update TypeScript Types

After adding schema fields, regenerate Sanity types:

```bash
cd apps/studio
bun sanity schema extract
```

---

## Phase 2: Document Action for Auto-Population

### Task 2.1: Create Denormalization Utility

**File**: `apps/studio/utils/denormalize-product.ts`

```typescript
import { SanityClient } from 'sanity';

export type DenormalizedProductFields = {
  _brandSlug: string | null;
  _brandName: string | null;
  _categorySlugs: string[];
  _parentCategorySlugs: string[];
  _filterKeys: string[]; // Only dropdown filters, not range filters
  _lastDenormSync: string;
};

/**
 * Computes denormalized fields for a product document.
 * Call this when a product is created or updated.
 */
export async function computeDenormalizedFields(
  client: SanityClient,
  document: {
    brand?: { _ref: string };
    categories?: Array<{ _ref: string }>;
    customFilterValues?: Array<{
      filterName?: string;
      value?: string;
      numericValue?: number;
    }>;
  }
): Promise<DenormalizedProductFields> {
  const now = new Date().toISOString();

  // Default empty values
  let brandSlug: string | null = null;
  let brandName: string | null = null;
  let categorySlugs: string[] = [];
  let parentCategorySlugs: string[] = [];
  let filterKeys: string[] = []; // Only dropdown filters

  // Fetch brand data if brand reference exists
  if (document.brand?._ref) {
    const brand = await client.fetch<{ name: string; slug: string } | null>(
      `*[_id == $id][0]{ name, "slug": slug.current }`,
      { id: document.brand._ref }
    );

    if (brand) {
      // Extract slug without prefix: "/marki/yamaha/" -> "yamaha"
      brandSlug = brand.slug?.replace('/marki/', '').replace(/\/$/, '') || null;
      brandName = brand.name || null;
    }
  }

  // Fetch category data if categories exist
  if (document.categories?.length) {
    const categoryRefs = document.categories.map((c) => c._ref).filter(Boolean);

    const categories = await client.fetch<
      Array<{
        slug: string;
        parentSlug: string | null;
      }>
    >(
      `*[_id in $ids]{
        "slug": slug.current,
        "parentSlug": parentCategory->slug.current
      }`,
      { ids: categoryRefs }
    );

    categorySlugs = categories.map((c) => c.slug).filter(Boolean);
    parentCategorySlugs = categories
      .map((c) => c.parentSlug)
      .filter((s): s is string => Boolean(s));
  }

  // Compute filter keys from customFilterValues
  // ONLY for dropdown filters (string values), NOT range filters (numeric values)
  // Range filters still use customFilterValues[].numericValue for numeric comparison
  if (document.customFilterValues?.length) {
    filterKeys = document.customFilterValues
      .filter((fv) => {
        // Only include dropdown filters (have string value, not just numericValue)
        return fv.filterName && fv.value;
      })
      .map((fv) => {
        const slug = slugify(fv.filterName!);
        return `${slug}:${fv.value!.toLowerCase()}`;
      });
  }

  return {
    _brandSlug: brandSlug,
    _brandName: brandName,
    _categorySlugs: categorySlugs,
    _parentCategorySlugs: parentCategorySlugs,
    _filterKeys: filterKeys, // Dropdown filters only
    _lastDenormSync: now,
  };
}

/**
 * Slugify a string for filter key matching
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

### Task 2.2: Create Document Action

**File**: `apps/studio/actions/denormalize-product-action.ts`

```typescript
import { DocumentActionComponent, useClient } from 'sanity';
import { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { computeDenormalizedFields } from '../utils/denormalize-product';

/**
 * Document action that syncs denormalized fields for a product.
 * Shows a "Sync" button that recomputes brand/category/filter data.
 */
export const DenormalizeProductAction: DocumentActionComponent = (props) => {
  const { draft, published, id, type } = props;
  const client = useClient({ apiVersion: '2024-01-01' });
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    const doc = draft || published;
    if (!doc) return;

    setSyncing(true);

    try {
      const denormalized = await computeDenormalizedFields(client, doc as any);

      // Patch the document with denormalized fields
      await client.patch(id).set(denormalized).commit({ visibility: 'async' });

      // If there's a draft, patch that too
      if (draft) {
        await client
          .patch(`drafts.${id}`)
          .set(denormalized)
          .commit({ visibility: 'async' });
      }

      props.onComplete?.();
    } catch (error) {
      console.error('Failed to sync denormalized fields:', error);
    } finally {
      setSyncing(false);
    }
  }, [client, id, draft, published, props]);

  // Only show for product documents
  if (type !== 'product') {
    return null;
  }

  return {
    label: syncing ? 'Syncing...' : 'Sync Filter Data',
    icon: RefreshCw,
    disabled: syncing || (!draft && !published),
    onHandle: handleSync,
    tone: 'positive',
  };
};
```

### Task 2.3: Auto-Sync on Publish

**File**: `apps/studio/actions/publish-with-denorm-action.ts`

```typescript
import {
  DocumentActionComponent,
  useClient,
  useDocumentOperation,
} from 'sanity';
import { useCallback, useState } from 'react';
import { CheckCircle } from 'lucide-react';

import { computeDenormalizedFields } from '../utils/denormalize-product';

/**
 * Custom publish action that auto-syncs denormalized fields before publishing.
 * Replaces the default publish action for product documents.
 */
export const PublishWithDenormAction: DocumentActionComponent = (props) => {
  const { draft, published, id, type, onComplete } = props;
  const client = useClient({ apiVersion: '2024-01-01' });
  const { publish } = useDocumentOperation(id, type);
  const [publishing, setPublishing] = useState(false);

  const handlePublish = useCallback(async () => {
    if (!draft) return;

    setPublishing(true);

    try {
      // Step 1: Compute denormalized fields
      const denormalized = await computeDenormalizedFields(
        client,
        draft as any
      );

      // Step 2: Patch the draft with denormalized fields
      await client
        .patch(`drafts.${id}`)
        .set(denormalized)
        .commit({ visibility: 'async' });

      // Step 3: Execute the publish operation
      publish.execute();

      onComplete?.();
    } catch (error) {
      console.error('Failed to publish with denormalization:', error);
    } finally {
      setPublishing(false);
    }
  }, [client, id, draft, publish, onComplete]);

  // Only show for product documents
  if (type !== 'product') {
    return null;
  }

  return {
    label: publishing ? 'Publishing...' : 'Publish',
    icon: CheckCircle,
    disabled: publishing || publish.disabled || !draft,
    onHandle: handlePublish,
    tone: 'positive',
  };
};
```

### Task 2.4: Register Document Actions

**File**: `apps/studio/sanity.config.ts` (or where document actions are configured)

```typescript
import { defineConfig } from 'sanity';
import { DenormalizeProductAction } from './actions/denormalize-product-action';
import { PublishWithDenormAction } from './actions/publish-with-denorm-action';

export default defineConfig({
  // ... existing config

  document: {
    actions: (prev, context) => {
      // For product documents, add custom actions
      if (context.schemaType === 'product') {
        return [
          // Replace default publish with our custom publish
          ...prev.filter((action) => action.action !== 'publish'),
          PublishWithDenormAction,
          DenormalizeProductAction,
          // Keep other actions (delete, duplicate, etc.)
        ];
      }
      return prev;
    },
  },
});
```

---

## Phase 3: Migration Script

### Task 3.1: Create Bulk Migration Script

**File**: `apps/studio/scripts/migrate-denormalized-fields.ts`

```typescript
import { createClient } from '@sanity/client';
import { computeDenormalizedFields } from '../utils/denormalize-product';

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_WRITE_TOKEN!,
  useCdn: false,
});

async function migrateAllProducts() {
  console.log('🚀 Starting product denormalization migration...');

  // Fetch all products
  const products = await client.fetch<
    Array<{
      _id: string;
      brand?: { _ref: string };
      categories?: Array<{ _ref: string }>;
      customFilterValues?: Array<{
        filterName?: string;
        value?: string;
        numericValue?: number;
      }>;
    }>
  >(`
    *[_type == "product" && !(_id in path("drafts.**"))] {
      _id,
      brand,
      categories,
      customFilterValues
    }
  `);

  console.log(`📦 Found ${products.length} products to migrate`);

  let successCount = 0;
  let errorCount = 0;

  // Process in batches of 10 to avoid rate limits
  const BATCH_SIZE = 10;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    const patches = await Promise.all(
      batch.map(async (product) => {
        try {
          const denormalized = await computeDenormalizedFields(client, product);
          return {
            id: product._id,
            patch: denormalized,
          };
        } catch (error) {
          console.error(`❌ Error processing ${product._id}:`, error);
          errorCount++;
          return null;
        }
      })
    );

    // Apply patches
    const validPatches = patches.filter(
      (p): p is NonNullable<typeof p> => p !== null
    );

    const transaction = client.transaction();

    for (const { id, patch } of validPatches) {
      transaction.patch(id, (p) => p.set(patch));
    }

    await transaction.commit({ visibility: 'async' });

    successCount += validPatches.length;
    console.log(`✅ Migrated ${successCount}/${products.length} products`);

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
}

// Run migration
migrateAllProducts().catch(console.error);
```

### Task 3.2: Add Migration Script to package.json

**File**: `apps/studio/package.json`

```json
{
  "scripts": {
    "migrate:denormalize": "npx tsx scripts/migrate-denormalized-fields.ts"
  }
}
```

---

## Phase 4: Cascading Updates via Existing Webhook

> **Constraint**: The Sanity plan has a limit of 4 webhooks, and all slots are currently in use.
> **Solution**: Extend the existing revalidation webhook to also handle denormalization.

### Task 4.1: Extend Existing Revalidation Webhook

Instead of creating a new webhook, we'll extend the existing revalidation webhook handler to also handle denormalization when brand or category documents are updated.

**Find the existing revalidation webhook route** (likely `apps/web/src/app/api/revalidate/route.ts` or similar) and extend it:

```typescript
import { createClient } from '@sanity/client';
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_WEBHOOK_SECRET_TOKEN!,
  useCdn: false,
});

export async function POST(request: NextRequest) {
  // ... existing signature verification ...

  const payload = JSON.parse(body);
  const { _type, _id, operation } = payload;

  // ========================================
  // EXISTING: Cache revalidation logic
  // ========================================
  if (_type === 'product') {
    revalidateTag('product');
  }
  // ... other existing revalidation logic ...

  // ========================================
  // NEW: Denormalization for brand/category changes
  // ========================================
  if (_type === 'brand' && operation !== 'delete') {
    await updateProductsForBrand(_id);
    revalidateTag('product'); // Also revalidate after denorm
  }

  if (_type === 'productCategorySub' && operation !== 'delete') {
    await updateProductsForCategory(_id);
    revalidateTag('product'); // Also revalidate after denorm
  }

  return NextResponse.json({ success: true });
}

// ========================================
// Denormalization Helper Functions
// ========================================

async function updateProductsForBrand(brandId: string) {
  // Fetch brand data
  const brand = await client.fetch<{ name: string; slug: string } | null>(
    `*[_id == $id][0]{ name, "slug": slug.current }`,
    { id: brandId }
  );

  if (!brand) return;

  const brandSlug =
    brand.slug?.replace('/marki/', '').replace(/\/$/, '') || null;

  // Find all products referencing this brand
  const productIds = await client.fetch<string[]>(
    `*[_type == "product" && brand._ref == $brandId]._id`,
    { brandId }
  );

  console.log(
    `[Denorm] Updating ${productIds.length} products for brand ${brand.name}`
  );

  // Update products in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE);
    const transaction = client.transaction();

    for (const id of batch) {
      transaction.patch(id, (p) =>
        p.set({
          _brandSlug: brandSlug,
          _brandName: brand.name,
          _lastDenormSync: new Date().toISOString(),
        })
      );
    }

    await transaction.commit({ visibility: 'async' });
  }
}

async function updateProductsForCategory(categoryId: string) {
  // Fetch category data
  const category = await client.fetch<{
    slug: string;
    parentSlug: string | null;
  } | null>(
    `*[_id == $id][0]{
      "slug": slug.current,
      "parentSlug": parentCategory->slug.current
    }`,
    { id: categoryId }
  );

  if (!category) return;

  // Find all products referencing this category
  const products = await client.fetch<
    Array<{
      _id: string;
      categories: Array<{ _ref: string }>;
    }>
  >(
    `*[_type == "product" && $categoryId in categories[]._ref]{
      _id,
      categories
    }`,
    { categoryId }
  );

  console.log(
    `[Denorm] Updating ${products.length} products for category ${category.slug}`
  );

  // For each product, recompute all category slugs
  for (const product of products) {
    const categoryRefs = product.categories.map((c) => c._ref);

    const categories = await client.fetch<
      Array<{ slug: string; parentSlug: string | null }>
    >(
      `*[_id in $ids]{
        "slug": slug.current,
        "parentSlug": parentCategory->slug.current
      }`,
      { ids: categoryRefs }
    );

    const categorySlugs = categories.map((c) => c.slug).filter(Boolean);
    const parentCategorySlugs = categories
      .map((c) => c.parentSlug)
      .filter((s): s is string => Boolean(s));

    await client
      .patch(product._id)
      .set({
        _categorySlugs: categorySlugs,
        _primaryCategorySlug: categorySlugs[0] || null,
        _parentCategorySlugs: parentCategorySlugs,
        _lastDenormSync: new Date().toISOString(),
      })
      .commit({ visibility: 'async' });
  }
}
```

### Task 4.2: Update Existing Webhook Filter in Sanity Dashboard

Modify the existing revalidation webhook filter to include brand and category types:

1. Go to **Sanity Dashboard** → **API** → **Webhooks**
2. Edit the existing revalidation webhook
3. Update the **Filter** to include brand and category:

   **Before:**

   ```groq
   _type == "product"
   ```

   **After:**

   ```groq
   _type in ["product", "brand", "productCategorySub"]
   ```

4. Ensure the **Projection** includes the operation:

   ```groq
   {_type, _id, operation: delta::operation()}
   ```

5. Save the webhook

> **Note**: This approach avoids creating a new webhook while still enabling automatic denormalization when brands or categories are renamed.

---

## Phase 4.5: Handle Custom Filters Config View

### Problem

The `CustomFiltersConfigView` component allows editors to update product filter values directly from the category document view. This bypasses the normal document action flow because:

1. Products are patched directly via `client.patch()`
2. The product document action never fires
3. Denormalized `_filterKeys` field is never updated

**Location**: `apps/studio/components/custom-filters-config/custom-filters-config-view.tsx`

### Solution

Extend the `handleSaveProductValue` function to also update the `_filterKeys` denormalized field whenever filter values are saved.

### Task 4.5.1: Update handleSaveProductValue

**File**: `apps/studio/components/custom-filters-config/custom-filters-config-view.tsx`

Find the `handleSaveProductValue` callback and extend it to also compute and save `_filterKeys`:

```typescript
// Add this helper function at the top of the file or import from utils
function slugifyFilterName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Update the handleSaveProductValue callback
const handleSaveProductValue = useCallback(
  async (
    productId: string,
    filterName: string,
    value: string | undefined,
    numericValue: number | undefined
  ): Promise<void> => {
    try {
      // ... existing code to build newFilterValues ...

      // ========================================
      // NEW: Compute _filterKeys from newFilterValues
      // ========================================
      const _filterKeys = newFilterValues
        .filter((fv) => fv.filterName && fv.value)
        .map((fv) => {
          const slug = slugifyFilterName(fv.filterName);
          return `${slug}:${fv.value!.toLowerCase()}`;
        });

      // ========================================
      // Update the patch to include _filterKeys
      // ========================================
      if (isCurrentlyDraft) {
        // Draft exists - just patch it
        await client
          .patch(draftProductId)
          .set({
            customFilterValues:
              newFilterValues.length > 0 ? newFilterValues : [],
            _filterKeys: _filterKeys.length > 0 ? _filterKeys : [], // NEW
            _lastDenormSync: new Date().toISOString(), // NEW
          })
          .commit();
      } else {
        // No draft exists - create draft from published document, then patch
        const { _rev, ...documentWithoutRev } = currentProduct;

        const transaction = client.transaction();

        transaction.createIfNotExists({
          ...documentWithoutRev,
          _id: draftProductId,
        });

        transaction.patch(draftProductId, (patch) =>
          patch.set({
            customFilterValues:
              newFilterValues.length > 0 ? newFilterValues : [],
            _filterKeys: _filterKeys.length > 0 ? _filterKeys : [], // NEW
            _lastDenormSync: new Date().toISOString(), // NEW
          })
        );

        await transaction.commit();
      }

      // ... existing loadProductStats() call ...
    } catch (error) {
      // ... existing error handling ...
    }
  },
  [client, toast, loadProductStats]
);
```

### Why This Works

1. **Immediate sync**: When an editor sets a filter value from the category view, `_filterKeys` is updated in the same transaction
2. **Draft state preserved**: The product remains a draft (not auto-published), matching the existing behavior
3. **No extra step**: Editors don't need to do anything different—it just works
4. **Full sync on publish**: When the product is eventually published, the document action runs and validates all denormalized fields (brand, category, filters)

### Task 4.5.2: Add Manual "Sync All Products" Button (Optional)

For rare cases where an editor wants to ensure all products in a category have their denormalized data in sync, add an optional button to the CustomFiltersConfigView:

```typescript
// Add to CustomFiltersConfigView component
const handleSyncAllProducts = useCallback(async () => {
  const categoryId = documentId.replace('drafts.', '');

  // Find all products in this category
  const products = await client.fetch<
    Array<{
      _id: string;
      customFilterValues?: Array<{
        filterName?: string;
        value?: string;
      }>;
    }>
  >(
    `*[_type == "product" && references($categoryId) && isArchived != true]{
      _id,
      customFilterValues
    }`,
    { categoryId }
  );

  let updatedCount = 0;

  for (const product of products) {
    const filterKeys = (product.customFilterValues || [])
      .filter((fv) => fv.filterName && fv.value)
      .map((fv) => {
        const slug = slugifyFilterName(fv.filterName!);
        return `${slug}:${fv.value!.toLowerCase()}`;
      });

    await client
      .patch(product._id)
      .set({
        _filterKeys: filterKeys,
        _lastDenormSync: new Date().toISOString(),
      })
      .commit({ visibility: 'async' });

    updatedCount++;
  }

  toast.push({
    status: 'success',
    title: `Zsynchronizowano ${updatedCount} produktów`,
  });
}, [client, documentId, toast]);

// Add button to the header
<Button
  text="Sync All Products"
  mode="ghost"
  tone="positive"
  onClick={handleSyncAllProducts}
/>
```

---

## Phase 5: Query Optimization

### Task 5.1: Update Products Filter Conditions

**File**: `apps/web/src/global/sanity/query.ts`

Update the `productsFilterConditions` to use denormalized fields:

```typescript
// BEFORE (slow - with dereferencing)
const productsFilterConditions = /* groq */ `
  _type == "product"
  && defined(slug.current)
  && isArchived != true
  && count(categories) > 0
  && ($category == "" || $category in categories[]->slug.current)
  && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
  // ... rest of conditions
`;

// AFTER (fast - using denormalized fields)
const productsFilterConditions = /* groq */ `
  _type == "product"
  && defined(slug.current)
  && isArchived != true
  && defined(_categorySlugs)
  && count(_categorySlugs) > 0
  
  // Category filter - uses denormalized _categorySlugs (no dereferencing)
  && ($category == "" || $category in _categorySlugs)
  
  // Brand filter - uses denormalized _brandSlug (no dereferencing, no string::split)
  && (count($brands) == 0 || _brandSlug in $brands)
  
  // Price filter - same as before (already fast, just numeric comparison)
  && (
    ($minPrice == 0 && $maxPrice == 999999999) ||
    (defined(basePriceCents) && basePriceCents >= $minPrice && basePriceCents <= $maxPrice)
  )
  
  // DROPDOWN FILTERS - uses denormalized _filterKeys (fast string matching)
  // $customFilters is now an array of strings like ["kolor:czarny", "material:drewno"]
  && (
    count($customFilters) == 0 ||
    count($customFilters) <= count(_filterKeys[@ in $customFilters])
  )
  
  // RANGE FILTERS - still uses customFilterValues (numeric comparison, no deref needed)
  // Range filters cannot be pre-computed as they require dynamic min/max comparison
  && (
    count($rangeFilters) == 0 ||
    count($rangeFilters) <= count(customFilterValues[
      select(
        count($rangeFilters[
          filterName == ^.filterName 
          && (minValue == null || ^.numericValue >= minValue)
          && (maxValue == null || ^.numericValue <= maxValue)
        ]) > 0 => true,
        false
      )
    ])
  )
  
  // CPO filter - same as before
  && ($isCPO == false || isCPO == true)
  
  // Embeddings search - same as before
  && (count($embeddingResults) == 0 || _id in $embeddingResults[].value.documentId)
`;

/**
 * Filter Types Summary:
 *
 * DENORMALIZED (fast):
 * - Category: _categorySlugs (no deref)
 * - Brand: _brandSlug (no deref, no string::split)
 * - Dropdown filters: _filterKeys (string matching)
 *
 * NOT DENORMALIZED (still uses customFilterValues, but that's okay):
 * - Range filters: require numeric comparison, can't be pre-computed
 * - Price: already fast (just numeric comparison on basePriceCents)
 */
```

### Task 5.2: Update Custom Filters Parameter Format

The `$customFilters` parameter should now be an array of strings matching the `_filterKeys` format:

**File**: `apps/web/src/components/products/ProductsListing/index.tsx`

```typescript
// Convert custom filters to filter key format for matching
const filterKeys = customFilters.map(({ filterName, value }) => {
  const slug = slugifyFilterName(filterName);
  return `${slug}:${value.toLowerCase()}`;
});

// Pass to query
const productsData = await sanityFetch<QueryProductsListingNewestResult>({
  query,
  params: {
    // ... other params
    customFilters: filterKeys, // Now an array of strings like ["kolor:czarny", "dlugosc-kabla:2m"]
    // ... rest
  },
  tags: ['product'],
});
```

---

## Phase 6: Testing Strategy

### Task 6.1: Unit Tests for Denormalization

**File**: `apps/studio/utils/__tests__/denormalize-product.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { computeDenormalizedFields } from '../denormalize-product';

describe('computeDenormalizedFields', () => {
  const mockClient = {
    fetch: vi.fn(),
  };

  it('should extract brand slug correctly', async () => {
    mockClient.fetch.mockResolvedValueOnce({
      name: 'Yamaha',
      slug: '/marki/yamaha/',
    });
    mockClient.fetch.mockResolvedValueOnce([]);

    const result = await computeDenormalizedFields(mockClient as any, {
      brand: { _ref: 'brand-123' },
      categories: [],
    });

    expect(result._brandSlug).toBe('yamaha');
    expect(result._brandName).toBe('Yamaha');
  });

  it('should collect all category slugs', async () => {
    mockClient.fetch.mockResolvedValueOnce(null); // No brand
    mockClient.fetch.mockResolvedValueOnce([
      {
        slug: '/kategoria/wzmacniacze/',
        parentSlug: '/kategoria-parent/audio/',
      },
      { slug: '/kategoria/sluchawki/', parentSlug: '/kategoria-parent/audio/' },
    ]);

    const result = await computeDenormalizedFields(mockClient as any, {
      categories: [{ _ref: 'cat-1' }, { _ref: 'cat-2' }],
    });

    expect(result._categorySlugs).toEqual([
      '/kategoria/wzmacniacze/',
      '/kategoria/sluchawki/',
    ]);
    // _primaryCategorySlug removed - use _categorySlugs[0] if needed
  });

  it('should generate filter keys for dropdown filters only', async () => {
    mockClient.fetch.mockResolvedValueOnce(null);
    mockClient.fetch.mockResolvedValueOnce([]);

    const result = await computeDenormalizedFields(mockClient as any, {
      customFilterValues: [
        // Dropdown filters (have string value) - INCLUDED in _filterKeys
        { filterName: 'Kolor', value: 'Czarny' },
        { filterName: 'Długość kabla', value: '2m' },
        // Range filters (have numericValue only) - NOT included in _filterKeys
        { filterName: 'Impedancja', numericValue: 8 },
        { filterName: 'Moc', numericValue: 100 },
      ],
    });

    // Only dropdown filters are in _filterKeys
    expect(result._filterKeys).toEqual(['kolor:czarny', 'dlugosc-kabla:2m']);
    // Range filters still use customFilterValues.numericValue (not denormalized)
  });
});
```

### Task 6.2: Integration Test Checklist

- [ ] Create new product → denormalized fields populated automatically
- [ ] Edit product brand → denormalized brand fields update
- [ ] Edit product categories → denormalized category fields update
- [ ] Rename brand → all referencing products update (via extended revalidation webhook)
- [ ] Rename category → all referencing products update (via extended revalidation webhook)
- [ ] **CustomFiltersConfigView**: Set filter value from category view → `_filterKeys` updates on product draft
- [ ] **CustomFiltersConfigView**: "Sync All Products" button works correctly (if implemented)
- [ ] Product listing query uses denormalized fields
- [ ] Filter by brand works with new query
- [ ] Filter by category works with new query
- [ ] Custom filters work with new query

### Task 6.3: Performance Verification

After implementation, verify query times:

```bash
# In dev tools or terminal, measure query times
# Target: < 400ms for products listing query
```

---

## Phase 7: Deployment Plan

### Step 1: Deploy Schema Changes (Non-breaking)

1. Deploy new schema fields to Sanity
2. Fields are hidden and optional, so no impact on existing data

### Step 2: Deploy Document Actions

1. Deploy document action code
2. Test manual sync on a few products
3. Verify fields are populated correctly

### Step 3: Run Migration

1. Run migration script in staging/dev first
2. Verify data integrity
3. Run migration in production

```bash
cd apps/studio
SANITY_PROJECT_ID=xxx SANITY_DATASET=production SANITY_WRITE_TOKEN=xxx bun run migrate:denormalize
```

### Step 4: Extend Revalidation Webhook

1. Deploy extended revalidation route (with denormalization handlers)
2. Update existing webhook filter in Sanity dashboard to include `brand` and `productCategorySub`
3. Test by updating a brand name and verifying products are updated

### Step 4.5: Deploy CustomFiltersConfigView Changes

1. Deploy updated `custom-filters-config-view.tsx`
2. Test by setting a filter value from category view and verifying `_filterKeys` is populated

### Step 5: Deploy Query Optimizations

1. Update GROQ queries to use denormalized fields
2. Update parameter transformation in ProductsListing
3. Deploy frontend changes

### Step 6: Monitor & Verify

1. Monitor query times in logs
2. Verify filtering still works correctly
3. Check for any edge cases

---

## Rollback Plan

If issues arise:

1. **Query rollback**: Revert `productsFilterConditions` to use original dereferencing
2. **Schema fields remain**: Denormalized fields can stay (they're hidden/unused)
3. **Document actions**: Can be disabled without breaking functionality

---

## Estimated Effort

| Phase     | Task                                | Time          |
| --------- | ----------------------------------- | ------------- |
| 1         | Schema changes                      | 30 min        |
| 2         | Document actions                    | 2 hours       |
| 3         | Migration script                    | 1 hour        |
| 4         | Extend revalidation webhook         | 1.5 hours     |
| 4.5       | CustomFiltersConfigView integration | 1 hour        |
| 5         | Query optimization                  | 1 hour        |
| 6         | Testing                             | 2 hours       |
| 7         | Deployment                          | 1 hour        |
| **Total** |                                     | **~10 hours** |

---

## Files Summary

### New Files

```
apps/studio/
├── utils/
│   └── denormalize-product.ts
├── actions/
│   ├── denormalize-product-action.ts
│   └── publish-with-denorm-action.ts
├── scripts/
│   └── migrate-denormalized-fields.ts
```

### Modified Files

```
apps/studio/
├── schemaTypes/documents/collections/product.ts  (add denormalized fields)
├── sanity.config.ts  (register document actions)
├── package.json  (add migration script)
└── components/custom-filters-config/
    └── custom-filters-config-view.tsx  (extend handleSaveProductValue to update _filterKeys)

apps/web/
├── src/global/sanity/query.ts  (optimized filter conditions)
├── src/components/products/ProductsListing/index.tsx  (filter key format)
└── src/app/api/revalidate/route.ts  (extend with denormalization handlers - NO NEW WEBHOOK)
```

### Sanity Dashboard Changes

```
API → Webhooks:
└── Existing revalidation webhook  (update filter to include brand, productCategorySub)
```
