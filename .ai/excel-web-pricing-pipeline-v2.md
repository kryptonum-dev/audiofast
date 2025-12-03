# Excel Web Pricing Pipeline v2 — Complete Strategy

## Overview

This document describes the complete migration from the current Excel Desktop (VBA + AppleScript) pricing pipeline to a simplified Excel Web (Office Scripts) solution, including support for related products and the new 4-sheet spreadsheet structure.

**Status**: Planning  
**Date**: December 2024  
**Previous Documentation**: `excel-to-supabase-pricing-pipeline.md`, `sanity-price-sync-implementation.md`

---

## Table of Contents

1. [Architecture Comparison](#1-architecture-comparison)
2. [New Spreadsheet Structure](#2-new-spreadsheet-structure)
3. [Data Flow & Connections](#3-data-flow--connections)
4. [Related Products Feature](#4-related-products-feature)
5. [Implementation Plan](#5-implementation-plan)
6. [Office Script Implementation](#6-office-script-implementation)
7. [Edge Function Updates](#7-edge-function-updates)
8. [Sanity Schema Updates](#8-sanity-schema-updates)
9. [Cleanup & Deprecation](#9-cleanup--deprecation)
10. [Testing Strategy](#10-testing-strategy)
11. [Rollout Plan](#11-rollout-plan)

---

## 1. Architecture Comparison

### Current Architecture (Excel Desktop on Mac)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Excel Desktop  │────▶│   AppleScript    │────▶│  curl command   │
│  (VBA Macro)    │     │  (Keychain +     │     │  (HTTP POST)    │
│                 │     │   HMAC signing)  │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────▼────────────────────────────────┐
                        │                    Supabase Edge Functions                        │
                        │  ┌──────────────────────┐    ┌────────────────────────────────┐  │
                        │  │ pricing-ingest-verify│    │ pricing-ingest                 │  │
                        │  │ (HMAC verification)  │    │ (Ingest + chain to Sanity)     │  │
                        │  └──────────────────────┘    └────────────────────────────────┘  │
                        └──────────────────────────────────────────────────────────────────┘
```

**Problems with Current Architecture:**

- ❌ AppleScript required (macOS sandbox workaround)
- ❌ HMAC authentication complexity
- ❌ Per-machine Keychain secrets
- ❌ VBA (legacy language)
- ❌ macOS-only
- ❌ Complex debugging

### New Architecture (Excel Web)

```
┌─────────────────────┐     ┌────────────────────────────────────────────────────┐
│    Excel Web        │     │              Supabase Edge Functions                │
│  (Office Script)    │────▶│  ┌────────────────────────────────────────────┐    │
│                     │     │  │ pricing-ingest (simplified)                │    │
│  - TypeScript       │     │  │  - Bearer token auth only                  │    │
│  - Native fetch()   │     │  │  - Ingest pricing data                     │    │
│  - No AppleScript   │     │  │  - Chain to sync-prices-to-sanity          │    │
│  - Cross-platform   │     │  │  - Chain to sync-related-products (NEW)    │    │
└─────────────────────┘     │  └────────────────────────────────────────────┘    │
                            └────────────────────────────────────────────────────┘
```

**Benefits of New Architecture:**

- ✅ Native `fetch()` in Office Scripts (no AppleScript)
- ✅ Simple Bearer token authentication
- ✅ TypeScript (modern, type-safe)
- ✅ Cross-platform (any browser)
- ✅ No per-machine setup
- ✅ Scripts stored in OneDrive (auto-sync)
- ✅ Better error handling & debugging

---

## 2. New Spreadsheet Structure

The client's spreadsheet has **4 sheets** that work together:

### Sheet 1: Produkty (Products)

Main product catalog with base prices and related products.

| Column | Name     | Description              | Example                          |
| ------ | -------- | ------------------------ | -------------------------------- |
| A      | Brand    | Brand name               | `Artesania Audio`                |
| B      | PRODUKT  | Product name             | `PRESTIGE rack`                  |
| C      | MODEL    | Model variant (optional) | `2-półkowy`                      |
| D      | (empty)  | -                        | -                                |
| E      | Cena WWW | Base price in PLN        | `16 730 zł`                      |
| F      | (empty)  | -                        | -                                |
| G      | URL      | Price key / product slug | `artesania-audio/prestige`       |
| H-Z    | (empty)  | -                        | -                                |
| AA     | P1       | Related product 1 URL    | `artesania-audio/exoteryc`       |
| AB     | P2       | Related product 2 URL    | `artesania-audio/shelves`        |
| AC     | P3       | Related product 3 URL    | `artesania-audio/audiovideo`     |
| AD     | P4       | Related product 4 URL    | `artesania-audio/platforma-aire` |

**Notes:**

- Delimiter: Semicolon (`;`)
- Price format: `16 730 zł` (space thousands, Polish currency suffix)
- URL format: `brand-slug/product-slug`
- Empty MODEL means the product has no variants

### Sheet 2: Opcje (Options)

Defines SELECT-type option groups and their values.

| Column | Name               | Description                              | Example             |
| ------ | ------------------ | ---------------------------------------- | ------------------- |
| A      | Produkt            | Product name (links to Produkty.PRODUKT) | `PRESTIGE rack`     |
| B      | Model              | Model variant (links to Produkty.MODEL)  | `2-półkowy`         |
| C      | Opcja              | Option group name                        | `Kolor`             |
| D      | Pozycja słownikowa | Option value name                        | `Premium black`     |
| E      | Cena               | Price delta for this value               | `18 403 zł`         |
| F      | Pod-opcja wartości | Link to Wartości sheet (numeric input)   | `Podaj długość (m)` |
| G      | Pod-opcja listy    | Link to Listy sheet (nested select)      | `Ilość półek`       |

**Option Types:**

1. **Simple SELECT**: Just Opcja + Pozycja słownikowa + Cena
2. **SELECT with numeric child**: Pod-opcja wartości references Wartości sheet
3. **SELECT with nested SELECT child**: Pod-opcja listy references Listy sheet

### Sheet 3: Wartości (Values / Numeric Rules)

Defines NUMERIC_STEP inputs for custom values (e.g., cable length).

| Column | Name    | Description                                 | Example              |
| ------ | ------- | ------------------------------------------- | -------------------- |
| A      | Produkt | Product name                                | `Vanta SP`           |
| B      | Model   | Model variant                               | `Przewód głośnikowy` |
| C      | Opcja   | Option name (from Opcje.Pod-opcja wartości) | `Długość`            |
| D      | Min     | Minimum value                               | `2,00`               |
| E      | Max     | Maximum value                               | `10,00`              |
| F      | Skok    | Step increment                              | `0,50`               |
| G      | Dopłata | Price per step                              | `10 500 zł`          |

**Notes:**

- Decimal separator: Comma (`,`) - Polish locale
- These rules are triggered when user selects "Długość własna" (custom length) in Opcje

### Sheet 4: Listy (Lists / Nested Selects)

Defines values for nested SELECT options (sub-options).

| Column | Name               | Description                              | Example                  |
| ------ | ------------------ | ---------------------------------------- | ------------------------ |
| A      | Produkt            | Product name                             | `MODULAR rack`           |
| B      | Model              | Model variant                            | `Półka z zestawem 4 nóg` |
| C      | Opcja              | Option name (from Opcje.Pod-opcja listy) | `Ilość półek`            |
| D      | Pozycja słownikowa | Nested value name                        | `3`                      |
| E      | Dopłata            | Price delta                              | `26 760 zł`              |

---

## 3. Data Flow & Connections

### How Sheets Connect

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PRODUKTY (Sheet 1)                                      │
│                                                                                      │
│  Brand | PRODUKT | MODEL | Price | URL | ... | P1 | P2 | P3 | P4                    │
│  ──────────────────────────────────────────────────────────────────────────────────  │
│  Artesania | PRESTIGE rack | 2-półkowy | 16730 | artesania-audio/prestige | ...     │
│                 │                                                                    │
│                 │  (Product + Model) is the foreign key                             │
└─────────────────│────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              OPCJE (Sheet 2)                                         │
│                                                                                      │
│  Produkt | Model | Opcja | Pozycja | Cena | Pod-opcja wartości | Pod-opcja listy    │
│  ──────────────────────────────────────────────────────────────────────────────────  │
│  PRESTIGE rack | 2-półkowy | Kolor | Standard grey | 0 zł | | |                     │
│  PRESTIGE rack | 2-półkowy | Kolor | Premium black | 18403 zł | | |                 │
│  Vanta SP | Przewód | Długość | 2m | 0 zł | | |                                     │
│  Vanta SP | Przewód | Długość | Długość własna | | Podaj długość (m) | |  ──────┐   │
│  MODULAR rack | Półka | Ilość półek | | | | Ilość półek |  ─────────────────┐  │   │
└──────────────────────────────────────────────────────────────────────────│──│───────┘
                                                                           │  │
                          ┌────────────────────────────────────────────────┘  │
                          │                                                    │
                          ▼                                                    ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐
│         WARTOŚCI (Sheet 3)               │  │            LISTY (Sheet 4)               │
│                                          │  │                                          │
│  Numeric rules for custom inputs         │  │  Nested SELECT values                    │
│  ────────────────────────────────────    │  │  ────────────────────────────────────    │
│  Vanta SP | Przewód | Długość:           │  │  MODULAR rack | Półka | Ilość półek:     │
│    Min: 2.00, Max: 10.00, Step: 0.50     │  │    1 = 0 zł                              │
│    Price/step: 10,500 zł                 │  │    2 = 13,380 zł                         │
│                                          │  │    3 = 26,760 zł                         │
│  Gamma RCA | | Długość:                  │  │    4 = 40,140 zł                         │
│    Min: 1.00, Max: 10.00, Step: 0.25     │  │    5 = 53,520 zł                         │
│    Price/step: 190 zł                    │  │    6 = 66,900 zł                         │
└──────────────────────────────────────────┘  └──────────────────────────────────────────┘
```

### Mapping to Database Schema

| Excel Sheet           | Supabase Table                                    | Sanity Field                      |
| --------------------- | ------------------------------------------------- | --------------------------------- |
| Produkty (base price) | `pricing_variants`                                | `product.basePriceCents`          |
| Produkty (P1-P4)      | -                                                 | `product.relatedProducts` **NEW** |
| Opcje                 | `pricing_option_groups` + `pricing_option_values` | -                                 |
| Wartości              | `pricing_numeric_rules`                           | -                                 |
| Listy                 | `pricing_option_values` (child)                   | -                                 |

---

## 4. Related Products Feature

### Current State

In `apps/studio/schemaTypes/documents/collections/product.ts`, related products are defined as manual references:

```typescript
// Currently NOT in schema - needs to be added
defineField({
  name: 'relatedProducts',
  title: 'Powiązane produkty',
  type: 'array',
  of: [{ type: 'reference', to: [{ type: 'product' }] }],
  validation: (Rule) => Rule.max(4),
});
```

### New Feature: Excel-Controlled Related Products

The client wants to control related products via Excel columns P1-P4.

**How it works:**

1. Each product row in Produkty sheet has 4 URL columns (P1-P4)
2. URLs are in format `brand-slug/product-slug` (e.g., `artesania-audio/exoteryc`)
3. The sync function extracts product slug and matches to Sanity products
4. Related products are synced as references in Sanity

**Example:**

| Product       | URL                      | P1                       | P2                      | P3                         | P4                             |
| ------------- | ------------------------ | ------------------------ | ----------------------- | -------------------------- | ------------------------------ |
| PRESTIGE rack | artesania-audio/prestige | artesania-audio/exoteryc | artesania-audio/shelves | artesania-audio/audiovideo | artesania-audio/platforma-aire |

**Sync Logic:**

1. Parse P1-P4 columns from payload
2. Extract product slugs (last segment of URL)
3. Query Sanity for products matching slugs
4. Update `relatedProducts` field with references

---

## 5. Implementation Plan

### Phase 1: Preparation (Day 1)

- [ ] **1.1** Add `relatedProducts` field to Sanity product schema
- [ ] **1.2** Deploy schema changes to Sanity
- [ ] **1.3** Test schema with manual data

### Phase 2: Edge Function Updates (Day 1-2)

- [ ] **2.1** Simplify `pricing-ingest` to remove HMAC verification
- [ ] **2.2** Create `sync-related-products` Edge Function
- [ ] **2.3** Update `pricing-ingest` to chain to new sync function
- [ ] **2.4** Update payload schema to include `related_products` array
- [ ] **2.5** Deploy Edge Functions

### Phase 3: Office Script Development (Day 2-3)

- [ ] **3.1** Create Office Script for Excel Web
- [ ] **3.2** Implement CSV parsing for all 4 sheets
- [ ] **3.3** Implement JSON payload builder
- [ ] **3.4** Implement fetch() to Supabase
- [ ] **3.5** Test with sample data

### Phase 4: Testing & Validation (Day 3-4)

- [ ] **4.1** Test full flow with real spreadsheet
- [ ] **4.2** Verify pricing data in Supabase
- [ ] **4.3** Verify base prices in Sanity
- [ ] **4.4** Verify related products in Sanity
- [ ] **4.5** Test product page configurator UI

### Phase 5: Cleanup (Day 4-5)

- [ ] **5.1** Remove HMAC verification tables from Supabase
- [ ] **5.2** Delete `pricing-ingest-verify` Edge Function
- [ ] **5.3** Archive VBA/AppleScript files
- [ ] **5.4** Update documentation

---

## 6. Office Script Implementation

### Script Structure

```typescript
// audiofast-pricing-sync.ts
// Office Script for Excel Web

interface ProductRow {
  brand: string;
  product: string;
  model: string | null;
  price_cents: number;
  price_key: string;
  related_products: string[];
}

interface OptionRow {
  product: string;
  model: string | null;
  option_name: string;
  value_name: string;
  price_delta_cents: number;
  numeric_child: string | null;
  list_child: string | null;
}

interface NumericRule {
  product: string;
  model: string | null;
  option_name: string;
  min_value: number;
  max_value: number;
  step_value: number;
  price_per_step_cents: number;
}

interface ListValue {
  product: string;
  model: string | null;
  option_name: string;
  value_name: string;
  price_delta_cents: number;
}

interface Payload {
  mode: 'replace' | 'merge';
  variants: VariantPayload[];
}

async function main(workbook: ExcelScript.Workbook): Promise<void> {
  // Configuration
  const SUPABASE_URL = 'https://xuwapsacaymdemmvblak.supabase.co';
  const ENDPOINT = `${SUPABASE_URL}/functions/v1/pricing-ingest`;
  const ANON_KEY = '<ANON_KEY>'; // Public key
  const EXCEL_TOKEN = '<EXCEL_PUBLISH_TOKEN>'; // Secret token

  try {
    // 1. Read all sheets
    const products = readProduktySheet(workbook);
    const options = readOpcjeSheet(workbook);
    const numericRules = readWartosciSheet(workbook);
    const listValues = readListySheet(workbook);

    // 2. Build payload
    const payload = buildPayload(products, options, numericRules, listValues);

    // 3. Send to Supabase
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        'X-Excel-Token': EXCEL_TOKEN,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    // 4. Handle response
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('Success:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

function readProduktySheet(workbook: ExcelScript.Workbook): ProductRow[] {
  const sheet = workbook.getWorksheet('Produkty');
  if (!sheet) throw new Error('Sheet "Produkty" not found');

  const usedRange = sheet.getUsedRange();
  const values = usedRange.getValues();
  const products: ProductRow[] = [];

  // Skip header rows (first 5 rows are headers/currency info)
  for (let i = 6; i < values.length; i++) {
    const row = values[i];
    const brand = String(row[0] || '').trim();
    const product = String(row[1] || '').trim();
    const model = String(row[2] || '').trim() || null;
    const priceStr = String(row[4] || '').trim();
    const url = String(row[6] || '').trim();

    // Skip empty rows or header rows
    if (!product || !url || product === 'PRODUKT') continue;

    // Parse price (e.g., "16 730 zł" -> 1673000 cents)
    const priceCents = parsePriceToCents(priceStr);

    // Read P1-P4 (columns AA-AD = indices 26-29)
    const relatedProducts: string[] = [];
    for (let j = 26; j <= 29; j++) {
      const relatedUrl = String(row[j] || '').trim();
      if (relatedUrl) {
        relatedProducts.push(relatedUrl);
      }
    }

    products.push({
      brand,
      product,
      model,
      price_cents: priceCents,
      price_key: url,
      related_products: relatedProducts,
    });
  }

  return products;
}

function parsePriceToCents(priceStr: string): number {
  // Remove "zł", spaces, and convert to cents
  // "16 730 zł" -> 1673000
  const cleaned = priceStr.replace(/[^\d,\.]/g, '').replace(',', '.');
  const value = parseFloat(cleaned) || 0;
  return Math.round(value * 100);
}

// ... Additional helper functions for other sheets
```

### Key Implementation Details

1. **Sheet Reading**: Use `getUsedRange().getValues()` to read all data at once
2. **Price Parsing**: Handle Polish format (`16 730 zł` with space thousands)
3. **Decimal Parsing**: Handle Polish decimals (`,` instead of `.`)
4. **Empty Handling**: Skip empty rows, header rows, section dividers
5. **Related Products**: Read columns AA-AD (indices 26-29)

---

## 7. Edge Function Updates

### Updated `pricing-ingest` Payload Schema

```typescript
interface PricingPayload {
  mode: 'merge' | 'replace';
  variants: VariantInput[];
}

interface VariantInput {
  price_key: string; // e.g., "artesania-audio/prestige"
  brand: string; // e.g., "Artesania Audio"
  product: string; // e.g., "PRESTIGE rack"
  model?: string | null; // e.g., "2-półkowy"
  base_price_cents: number; // e.g., 1673000
  currency?: string; // default: "PLN"
  related_products?: string[]; // NEW: ["artesania-audio/exoteryc", ...]
  groups?: GroupInput[]; // Option groups
}
```

### New `sync-related-products` Edge Function

```typescript
// supabase/functions/sync-related-products/index.ts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@sanity/client@6.15.0';

interface VariantWithRelated {
  price_key: string;
  related_products: string[];
}

const sanityClient = createClient({
  projectId: Deno.env.get('SANITY_PROJECT_ID')!,
  dataset: Deno.env.get('SANITY_DATASET') || 'production',
  token: Deno.env.get('SANITY_API_TOKEN')!,
  apiVersion: '2024-01-01',
  useCdn: false,
});

Deno.serve(async (req: Request) => {
  try {
    // Verify authentication
    const token = req.headers.get('x-excel-token');
    const expectedToken = Deno.env.get('EXCEL_PUBLISH_TOKEN');
    if (token !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const body = (await req.json()) as { variants: VariantWithRelated[] };
    const { variants } = body;

    const results = {
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Build a map of all unique related product slugs we need to look up
    const allRelatedSlugs = new Set<string>();
    for (const variant of variants) {
      for (const relatedUrl of variant.related_products || []) {
        const slug = extractSlugFromUrl(relatedUrl);
        if (slug) allRelatedSlugs.add(slug);
      }
    }

    // Batch query all related products
    const slugArray = Array.from(allRelatedSlugs);
    const relatedProductsQuery = `*[_type == "product" && slug.current in $slugs]{
      _id,
      "slug": slug.current
    }`;
    const relatedProductDocs = await sanityClient.fetch(relatedProductsQuery, {
      slugs: slugArray.map((s) => `/produkty/${s}/`),
    });

    // Build slug -> _id map
    const slugToIdMap = new Map<string, string>();
    for (const doc of relatedProductDocs) {
      const slug = doc.slug.replace('/produkty/', '').replace(/\/$/, '');
      slugToIdMap.set(slug, doc._id);
    }

    // Process each variant
    for (const variant of variants) {
      const productSlug = extractSlugFromUrl(variant.price_key);
      if (!productSlug) {
        results.skipped++;
        continue;
      }

      // Find the Sanity product
      const sanitySlug = `/produkty/${productSlug}/`;
      const productQuery = `*[_type == "product" && slug.current == $slug][0]{ _id }`;
      const product = await sanityClient.fetch(productQuery, {
        slug: sanitySlug,
      });

      if (!product) {
        results.skipped++;
        continue;
      }

      // Build related product references
      const relatedRefs: { _type: string; _ref: string; _key: string }[] = [];
      for (const relatedUrl of variant.related_products || []) {
        const relatedSlug = extractSlugFromUrl(relatedUrl);
        if (relatedSlug && slugToIdMap.has(relatedSlug)) {
          relatedRefs.push({
            _type: 'reference',
            _ref: slugToIdMap.get(relatedSlug)!,
            _key: relatedSlug,
          });
        }
      }

      // Update Sanity document
      try {
        await sanityClient
          .patch(product._id)
          .set({
            relatedProducts: relatedRefs,
            lastRelatedProductsSync: new Date().toISOString(),
          })
          .commit();
        results.updated++;
      } catch (err) {
        results.errors.push(`${productSlug}: ${err.message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});

function extractSlugFromUrl(url: string): string | null {
  // "artesania-audio/prestige" -> "prestige"
  // "shunyata-research/venom-hc" -> "venom-hc"
  if (!url) return null;
  const parts = url.split('/');
  return parts[parts.length - 1] || null;
}
```

### Updated `pricing-ingest` with Related Products Chaining

Add to the end of `pricing-ingest/index.ts`:

```typescript
// Chain to sync-related-products after successful Supabase ingest
let relatedResult = null;
const variantsWithRelated = variants.filter(
  (v) => v.related_products?.length > 0
);
if (variantsWithRelated.length > 0) {
  try {
    const relatedResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-related-products`,
      {
        method: 'POST',
        headers: {
          Authorization: req.headers.get('authorization')!,
          'X-Excel-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variants: variantsWithRelated }),
      }
    );

    if (relatedResponse.ok) {
      relatedResult = await relatedResponse.json();
    } else {
      console.error('Related products sync failed:', relatedResponse.status);
      relatedResult = { error: `HTTP ${relatedResponse.status}` };
    }
  } catch (err) {
    console.error('Related products sync error:', err);
    relatedResult = { error: err.message };
  }
}

// Return combined results
return new Response(
  JSON.stringify({
    ok: true,
    supabase: { counts: data },
    sanity: sanityResult,
    relatedProducts: relatedResult, // NEW
  }),
  { status: 200, headers: { 'content-type': 'application/json' } }
);
```

---

## 8. Sanity Schema Updates

### Add Related Products Field

In `apps/studio/schemaTypes/documents/collections/product.ts`:

```typescript
defineField({
  name: 'relatedProducts',
  title: 'Powiązane produkty',
  type: 'array',
  description:
    'Produkty powiązane z tym produktem. Synchronizowane automatycznie z Excela (kolumny P1-P4).',
  of: [
    {
      type: 'reference',
      to: [{ type: 'product' }],
      options: {
        filter: ({ document }) => {
          // Exclude self and already selected
          const selectedIds = Array.isArray(document?.relatedProducts)
            ? document.relatedProducts.map((item: any) => item._ref).filter(Boolean)
            : [];
          return {
            filter: '_id != $currentId && !(_id in $selectedIds)',
            params: {
              currentId: document?._id,
              selectedIds,
            },
          };
        },
      },
    },
  ],
  validation: (Rule) =>
    Rule.max(4).error('Produkt może mieć maksymalnie 4 powiązane produkty'),
  group: GROUP.MAIN_CONTENT,
}),

defineField({
  name: 'lastRelatedProductsSync',
  title: 'Ostatnia synchronizacja powiązanych produktów',
  type: 'datetime',
  description: 'Znacznik czasu ostatniej synchronizacji z Excela.',
  readOnly: true,
  hidden: ({ document }) => !document?.lastRelatedProductsSync,
  group: GROUP.MAIN_CONTENT,
}),
```

---

## 9. Cleanup & Deprecation

### Items to Remove

#### Supabase Database

```sql
-- Drop HMAC authentication tables
DROP TABLE IF EXISTS public.ingest_client_nonces;
DROP TABLE IF EXISTS public.ingest_clients;
```

#### Supabase Edge Functions

- Delete `pricing-ingest-verify` function (no longer needed)

#### Local Files (Archive)

- `~/Library/Application Scripts/com.microsoft.Excel/SupabasePublish.scpt`
- VBA macro code from Excel workbook
- Keychain entries for `audiofast_ingest_secret`

#### Simplified `pricing-ingest`

Remove HMAC verification code:

- Remove `X-Client-Id`, `X-TS`, `X-Nonce`, `X-Signature` header checks
- Remove nonce replay protection
- Remove HMAC signature verification
- Keep only Bearer token + `X-Excel-Token` authentication

---

## 10. Testing Strategy

### Unit Tests

1. **Price Parsing**: Test Polish price format conversion
2. **Payload Building**: Test JSON structure generation
3. **Sheet Reading**: Test each sheet parser

### Integration Tests

1. **Full Flow**: Excel → Supabase → Sanity
2. **Pricing Data**: Verify `pricing_variants` data
3. **Option Groups**: Verify `pricing_option_groups` data
4. **Numeric Rules**: Verify `pricing_numeric_rules` data
5. **Base Price Sync**: Verify `product.basePriceCents` in Sanity
6. **Related Products**: Verify `product.relatedProducts` in Sanity

### Test Data

Create a test spreadsheet with:

- 5-10 products across different brands
- Products with various option types
- Products with related products
- Edge cases (empty values, special characters)

### Validation Queries

```sql
-- Check pricing variants
SELECT price_key, brand, product, model, base_price_cents
FROM pricing_variants
ORDER BY price_key;

-- Check option groups
SELECT v.price_key, g.name, g.input_type, g.position
FROM pricing_option_groups g
JOIN pricing_variants v ON g.variant_id = v.id
ORDER BY v.price_key, g.position;

-- Check option values
SELECT v.price_key, g.name, val.name, val.price_delta_cents
FROM pricing_option_values val
JOIN pricing_option_groups g ON val.group_id = g.id
JOIN pricing_variants v ON g.variant_id = v.id
ORDER BY v.price_key, g.position, val.position;
```

```groq
// Check Sanity prices
*[_type == "product" && defined(basePriceCents)]{
  "name": name,
  "slug": slug.current,
  basePriceCents,
  lastPricingSync
}

// Check related products
*[_type == "product" && defined(relatedProducts)]{
  "name": name,
  "relatedProducts": relatedProducts[]->{ "name": name, "slug": slug.current }
}
```

---

## 11. Rollout Plan

### Day 1: Preparation

| Time | Task                                              | Owner |
| ---- | ------------------------------------------------- | ----- |
| AM   | Update Sanity schema with `relatedProducts` field | Dev   |
| AM   | Deploy schema to Sanity                           | Dev   |
| PM   | Simplify `pricing-ingest` Edge Function           | Dev   |
| PM   | Create `sync-related-products` Edge Function      | Dev   |
| PM   | Deploy Edge Functions                             | Dev   |

### Day 2: Office Script

| Time | Task                         | Owner |
| ---- | ---------------------------- | ----- |
| AM   | Create Office Script         | Dev   |
| AM   | Test with sample data        | Dev   |
| PM   | Refine based on test results | Dev   |
| PM   | Document script usage        | Dev   |

### Day 3: Integration Testing

| Time | Task                                  | Owner        |
| ---- | ------------------------------------- | ------------ |
| AM   | Full end-to-end test                  | Dev          |
| AM   | Fix any issues                        | Dev          |
| PM   | Test with client's actual spreadsheet | Dev + Client |
| PM   | Address feedback                      | Dev          |

### Day 4: Cleanup & Handoff

| Time | Task                          | Owner        |
| ---- | ----------------------------- | ------------ |
| AM   | Remove deprecated code        | Dev          |
| AM   | Update documentation          | Dev          |
| PM   | Train client on new workflow  | Dev + Client |
| PM   | Monitor first production sync | Dev          |

### Day 5: Buffer / Support

| Time    | Task                          | Owner |
| ------- | ----------------------------- | ----- |
| All Day | Address any production issues | Dev   |
| All Day | Final documentation updates   | Dev   |

---

## Summary

### What Changes

| Aspect                 | Before              | After                       |
| ---------------------- | ------------------- | --------------------------- |
| **Client Application** | Excel Desktop (Mac) | Excel Web (any browser)     |
| **Scripting Language** | VBA + AppleScript   | Office Scripts (TypeScript) |
| **Authentication**     | HMAC + Keychain     | Simple Bearer token         |
| **Per-machine Setup**  | Required            | None                        |
| **Related Products**   | Manual in Sanity    | Controlled via Excel        |
| **Spreadsheet Format** | .xlsm with VBA      | Standard .xlsx or web       |

### What Stays the Same

- Supabase database schema (`pricing_*` tables)
- `pricing-ingest` Edge Function (simplified)
- `sync-prices-to-sanity` Edge Function
- Server-side chaining architecture
- Sanity `basePriceCents` field
- Product page configurator UI

### New Features

- Related products sync (P1-P4 columns)
- Cross-platform Excel support
- Simpler deployment and maintenance
- Better error handling and debugging
