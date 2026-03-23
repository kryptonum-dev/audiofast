# CPO Phase 2 — Excel → Sanity Sync Implementation Plan

> **Prerequisite**: Phase 1 (`cpo-products-overhaul-implementation-plan.md`) is complete. The `cpoProduct` document type, Studio desk, GROQ queries, listing page, detail page, revalidation, and sitemap are all working. Phase 1 explicitly deferred pricing/cennik integration — this plan implements it.

## Overview

Build a pipeline that lets the client manage CPO products **entirely from Excel** (no Sanity required for basic operations). A new "CPO" sheet in the existing pricing workbook becomes the source of truth for CPO product data. On sync, the Office Script sends CPO data to a Supabase Edge Function, which talks directly to the Sanity API to create, update, and archive `cpoProduct` documents.

**Key architectural decision**: No Supabase database for CPO. CPO products have flat prices (no configurator, no option groups, no variants). The Edge Function acts as a stateless proxy: Excel → Edge Function → Sanity HTTP API. Supabase is only the hosting platform for the function.

### What Changes vs Phase 1

| Aspect | Phase 1 (current) | Phase 2 (this plan) |
|--------|-------------------|---------------------|
| CPO product creation | Manual in Sanity Studio | Automated from Excel |
| `priceCents` | Manually entered in Sanity | Synced from Excel |
| Brand | `brandType` toggle + `brand` ref + `otherBrandName` + denorm fields | Single `brandName` string field. No reference, no toggle, no denormalization |
| Preview image | Always on CPO doc | If `internalProduct` set: optional on CPO (inherit catalog preview when empty). If no ref or **external**: required on CPO. |
| Short description | N/A | Single required portable-text **`shortDescription`**. Excel column **Opis** is synced by writing **plain text as one PT block** (same field); each sync **overwrites** that content. Editable in Studio between syncs. |
| Gallery | On CPO doc | Optional CPO `imageGallery`. **`useCustomGallery`** boolean: `false` = show catalog product gallery (when `internalProduct` exists); `true` = show CPO `imageGallery` only. |
| `internalProduct` ref | Planned but not implemented | Optional; auto-linked from Excel URL when internal |
| Product lifecycle | Manual publish/archive in Studio | Excel-driven: add row = create, remove row = archive |

---

## Excel CPO Sheet Structure

A new sheet named **`CPO`** in the existing pricing workbook. Row 1 is the header, data starts at row 2.

| Column | Header | Type | Required | Example | Description |
|--------|--------|------|----------|---------|-------------|
| A | Marka | Free text | Yes | `Artesania Audio` | Brand name — always stored as a string, never a reference |
| B | Nazwa | Free text | Yes | `PRESTIGE rack - egz. demo` | Display name of the CPO specimen |
| C | Klucz | Slug-like | Yes | `prestige-rack-demo` | **Stable sync identifier** + URL path. Must be unique per CPO product |
| D | Cena | Price (PLN) | Yes | `12 000 zł` | Flat CPO price. Parsed to cents |
| E | URL | URL/path | No | `artesania-audio/prestige` or `https://...` | Link to catalog product (internal) or external page |
| F | Opis | Free text | Yes (for sync) | `Stan idealny, produkt podemonstracyjny` | Short description → synced into **`shortDescription`** (portable text: one simple block of text). Sync overwrites; editors can enrich formatting in Studio. |

### Column Details

**Klucz (C)** — The backbone of the sync. Rules:

- Must be unique across all CPO products
- Used to generate the Sanity slug: `/certyfikowany-sprzet-uzywany/{klucz}/`
- Used to generate a deterministic Sanity `_id`: `cpo-{klucz}`
- Used to detect creates vs updates vs archives on subsequent syncs
- **Flexible matching**: the sync function normalizes the value — both `prestige-rack-demo` and `/certyfikowany-sprzet-uzywany/prestige-rack-demo/` produce the same key

Normalization logic:

```typescript
function normalizeKey(raw: string): string {
  let key = raw.trim();
  key = key.replace(/^\/?certyfikowany-sprzet-uzywany\//, '');
  key = key.replace(/^\/+|\/+$/g, '');
  return key;
}
```

**URL (E)** — Determines the product type:

| URL value | `productType` | Behavior |
|-----------|---------------|----------|
| Starts with `http` | `"external"` | No own page. Card links to external URL |
| Non-empty, doesn't start with `http` | `"internal"` | Own CPO page. Linked to catalog product via `internalProduct` reference |
| Empty | `"internal"` | Own CPO page. No catalog link. **Created as draft** (needs manual images in Studio) |

For internal URLs, the format mirrors the existing `price_key` pattern: `brand-slug/product-slug`. The sync function extracts the product slug and matches it to a Sanity product document via `slug.current == "/produkty/{productSlug}/"`.

---

## Architecture

```
Excel (CPO sheet)
  → Office Script reads CPO rows, builds payload
    → POST to Supabase Edge Function (cpo-product-sync)
      → Sanity HTTP Mutations API
        → createIfNotExists + patch (for each row)
        → patch isArchived: true (for removed rows)
```

The regular pricing pipeline continues unchanged. The Office Script makes **two calls** from a single button press:

1. `pricing-ingest` — regular products (existing flow, unchanged)
2. `cpo-product-sync` — CPO products (new)

Alternatively, `pricing-ingest` can chain to `cpo-product-sync` server-side (same pattern as `sync-prices-to-sanity`). The payload structure supports both approaches:

```json
{
  "mode": "replace",
  "products": [
    {
      "brand": "Artesania Audio",
      "name": "PRESTIGE rack - egz. demo",
      "key": "prestige-rack-demo",
      "price_cents": 1200000,
      "url": "artesania-audio/prestige",
      "description": "Stan idealny, produkt podemonstracyjny"
    }
  ]
}
```

---

## Step 1: Sanity Schema Changes

### Step 1.1: Add `internalProduct` reference field

**File**: `apps/studio/schemaTypes/documents/collections/cpo-product.tsx`

This field was planned in Phase 1 but not implemented. It links a CPO product to the catalog product whose images and description it can inherit.

```typescript
defineField({
  name: "internalProduct",
  title: "Produkt z katalogu Audiofast",
  type: "reference",
  to: [{ type: "product" }],
  description:
    "Powiązanie z produktem z katalogu Audiofast. Pozwala dziedziczyć zdjęcia i opis. Ustawiane automatycznie na podstawie kolumny URL w cenniku.",
  group: GROUP.MAIN_CONTENT,
  hidden: ({ document }) => document?.productType === "external",
}),
```

Place it after the brand field (see Step 1.6 for brand simplification).

### Step 1.2: Add `useCustomGallery` toggle (gallery only)

Preview vs catalog is **not** toggled: if the CPO document has no `previewImage` asset but `internalProduct` is set, the frontend and GROQ resolve the hero/listing image from the catalog product. Gallery is the only place that needs an explicit switch:

```typescript
defineField({
  name: "useCustomGallery",
  title: "Własna galeria zdjęć",
  type: "boolean",
  description:
    "Wyłączone → galeria z produktu katalogowego. Włączone → galeria z tego dokumentu CPO (opcjonalna).",
  initialValue: false,
  group: GROUP.MAIN_CONTENT,
  hidden: ({ document }) =>
    document?.productType === "external" || !document?.internalProduct,
}),
```

### Step 1.3: Single **`shortDescription`** (portable text only — no separate Excel text field)

- One field **`shortDescription`** (required PT) for card + hero.
- **Studio:** editors use the rich text field directly.
- **Excel sync:** map column **Opis** → build minimal portable text (typically one `block` with a single `span`) and **`set` `shortDescription`** on create/patch. Each sync **overwrites** with the Excel string.
- **No** `excelDescription` string field on the document.

```typescript
function opisExcelToShortDescription(description: string) {
  const text = description.trim();
  if (!text) return [];
  const key = () => Math.random().toString(36).slice(2, 10);
  return [
    {
      _type: 'block',
      _key: key(),
      style: 'normal',
      markDefs: [],
      children: [{ _type: 'span', _key: key(), marks: [], text }],
    },
  ];
}
```

### Step 1.3b: **`brandName` first in the editor**

In `cpoProduct`, **`brandName`** is the **first** field in the schema (above **`name`**) so Marka appears at the top of the form.

### Step 1.4: `previewImage` validation

- **`productType === "external"`** — `previewImage` **required** (no catalog to inherit from).
- **`internal` + `internalProduct` set** — `previewImage` **optional** (inherit catalog preview when empty).
- **`internal` + no `internalProduct`** — `previewImage` **required**.

GROQ / frontend resolve: `select(defined(previewImage.asset) => previewImage, internalProduct->previewImage)` (alias e.g. `resolvedPreviewImage` on the detail query).

### Step 1.5: (removed — merged into 1.3–1.4)

See above for `shortDescription` and `previewImage`.

### Step 1.6: Simplify brand to a single string field

**File**: `apps/studio/schemaTypes/documents/collections/cpo-product.tsx`

Phase 1 implemented a `brandType` toggle (`"audiofast"` / `"external"`) with a `brand` reference field and an `otherBrandName` string field, plus denormalized fields (`denormBrandSlug`, `denormBrandName`). This was designed to allow CPO products to reference catalog brands. Since CPO brands will always come from Excel as free text, this entire mechanism is unnecessary.

**Remove these fields from the schema:**

- `brandType` (string, radio toggle)
- `brand` (reference to `brand`)
- `otherBrandName` (string)
- `denormBrandSlug` (string, hidden, computed)
- `denormBrandName` (string, hidden, computed)

**Replace with a single field:**

```typescript
defineField({
  name: "brandName",
  title: "Marka",
  type: "string",
  description:
    "Nazwa marki produktu CPO. Ustawiana z cennika Excel. Nie jest powiązana z katalogiem marek Audiofast.",
  group: GROUP.MAIN_CONTENT,
  validation: (Rule) => Rule.required().error("Nazwa marki jest wymagana"),
}),
```

This single string field serves all cases — Audiofast brands and external brands alike. No toggle, no reference, no denormalization.

**Cleanup in other files:**

- **`apps/studio/utils/denormalize-cpo-product.ts`** — **Delete this file entirely**. Denormalization is no longer needed for CPO products.
- **`apps/studio/actions/wrap-publish-with-denorm.ts`** — Remove the `cpoProduct` branch from `wrapPublishWithDenorm`. The `if (type === "cpoProduct")` block (lines ~89–102) should be removed. Also update `applyDenormToPublish` to exclude `cpoProduct` from the wrapped types (change `["product", "cpoProduct", "review"]` to `["product", "review"]`).

### Step 1.7: Slug for external products

External CPO products still need a slug for the sync key (to match the `Klucz` column), even though they don't have their own page. The current `hidden: ({ document }) => document?.productType === "external"` is fine — the sync function sets the slug via API regardless of Studio visibility. Studio validation for external products already returns `true` when `productType === "external"`. No change needed here.

---

## Step 2: Office Script Changes

Two scripts are needed:

1. **Update the existing script** (`SyncPricingToSupabase.ts`) — reads both regular pricing AND the CPO sheet, sends everything in one payload. This is the "full sync" button.
2. **Create a new standalone CPO script** (`SyncCpoToSupabase.ts`) — reads ONLY the CPO sheet and calls `cpo-product-sync` directly. This is a lightweight "CPO only" button for quick CPO updates without re-syncing all prices.

### Step 2.1: Shared CPO reading logic

Both scripts share the same CPO reading function and types:

```typescript
const CPO_CONFIG = {
  SHEET_CPO: 'CPO',
  DATA_START_ROW_CPO: 2,
};

interface CpoProduct {
  brand: string;
  name: string;
  key: string;
  price_cents: number;
  url: string;
  description: string;
}

function readCpo(workbook: ExcelScript.Workbook): CpoProduct[] {
  const sheet = workbook.getWorksheet(CPO_CONFIG.SHEET_CPO);
  if (!sheet) return [];
  const usedRange = sheet.getUsedRange();
  if (!usedRange) return [];
  const data = usedRange.getValues();
  const products: CpoProduct[] = [];

  for (let i = CPO_CONFIG.DATA_START_ROW_CPO; i < data.length; i++) {
    const row = data[i];
    const brand = cellStr(row, 0);
    const name = cellStr(row, 1);
    const key = cellStr(row, 2);
    const priceStr = cellStr(row, 3);
    const url = cellStr(row, 4);
    const description = cellStr(row, 5);

    if (!brand || !name || !key) continue;

    products.push({
      brand,
      name,
      key,
      price_cents: parsePriceToCents(priceStr),
      url,
      description,
    });
  }

  return products;
}
```

### Step 2.2: Update existing script — `SyncPricingToSupabase.ts`

**File**: `.ai/office-scripts/SyncPricingToSupabase.ts`

Add the CPO reading logic from Step 2.1 to the existing script. Update `main()` to include CPO data in the payload. The Edge Function chains to `cpo-product-sync` server-side (same pattern as `sync-prices-to-sanity`).

```typescript
// In main(), after reading regular pricing data:
const cpoProducts = readCpo(workbook);
console.log(`CPO produkty: ${cpoProducts.length}`);

const payload = {
  mode: 'replace',
  variants: variantsArray,
  cpo_products: cpoProducts,  // included in the same payload
};
```

Update response parsing to show CPO results:

```typescript
if (result.cpo) {
  console.log(`CPO: ${result.cpo.created || 0} utworzonych, ${result.cpo.updated || 0} zaktualizowanych, ${result.cpo.archived || 0} zarchiwizowanych`);
}
```

### Step 2.3: Create standalone CPO script — `SyncCpoToSupabase.ts`

**New file**: `.ai/office-scripts/SyncCpoToSupabase.ts`

A lightweight script that ONLY reads the CPO sheet and calls `cpo-product-sync` directly (not via `pricing-ingest`). This lets the client update CPO products without re-syncing all regular pricing data.

```typescript
const CONFIG = {
  SUPABASE_URL: '<same as SyncPricingToSupabase>',
  ANON_KEY: '<same as SyncPricingToSupabase>',
  SHEET_USTAWIENIA: 'Ustawienia',
  PASSWORD_CELL: 'B1',
  SHEET_CPO: 'CPO',
  DATA_START_ROW_CPO: 2,
};

// ... CpoProduct interface and readCpo function (same as Step 2.1)
// ... parsePriceToCents, cellStr helpers (same as existing script)

async function main(workbook: ExcelScript.Workbook): Promise<void> {
  console.log('Rozpoczynam synchronizację CPO...');

  try {
    const settingsSheet = workbook.getWorksheet(CONFIG.SHEET_USTAWIENIA);
    if (!settingsSheet) {
      console.log('BŁĄD: Brak arkusza "Ustawienia" z hasłem w komórce B1');
      return;
    }

    const password = String(
      settingsSheet.getRange(CONFIG.PASSWORD_CELL).getValue() || ''
    ).trim().replace(/[^\x20-\x7E]/g, '');

    if (!password || password.length < 8) {
      console.log('BŁĄD: Hasło musi mieć min. 8 znaków');
      return;
    }

    const cpoProducts = readCpo(workbook);
    if (cpoProducts.length === 0) {
      console.log('Brak produktów CPO do synchronizacji');
      return;
    }

    console.log(`Wysyłam ${cpoProducts.length} produktów CPO...`);

    const payload = { mode: 'replace', products: cpoProducts };

    const response = await fetch(
      CONFIG.SUPABASE_URL + '/functions/v1/cpo-product-sync',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + CONFIG.ANON_KEY,
          'X-Excel-Token': password,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.log(`BŁĄD HTTP ${response.status}: ${responseText}`);
      return;
    }

    const result = JSON.parse(responseText) as {
      ok?: boolean;
      created?: number;
      updated?: number;
      archived?: number;
      unarchived?: number;
      drafts?: number;
      errors?: string[];
    };

    console.log('=== SYNCHRONIZACJA CPO ZAKOŃCZONA ===');
    console.log(`Status: ${result.ok ? 'SUKCES ✓' : 'BŁĄD'}`);
    console.log(`Utworzono: ${result.created || 0}`);
    console.log(`Zaktualizowano: ${result.updated || 0}`);
    console.log(`Zarchiwizowano: ${result.archived || 0}`);
    if (result.drafts) {
      console.log(`Szkice (wymagają zdjęć w Sanity): ${result.drafts}`);
    }
    if (result.errors?.length) {
      console.log(`Błędy: ${result.errors.join(', ')}`);
    }
  } catch (error) {
    console.log(`BŁĄD: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  }
}
```

The client assigns this script to a separate "Sync CPO" button in Excel. This way they have two buttons:

- **"Synchronizuj wszystko"** — runs `SyncPricingToSupabase.ts` (full sync: pricing + CPO)
- **"Synchronizuj CPO"** — runs `SyncCpoToSupabase.ts` (CPO only, faster)

---

## Step 3: Edge Function — `cpo-product-sync`

### Step 3.1: Overview

A new Supabase Edge Function that receives CPO product data and syncs it to Sanity via the HTTP Mutations API.

**Endpoint**: `POST /functions/v1/cpo-product-sync`

**Auth**: Same as other functions — `Authorization: Bearer <anon-key>` + `X-Excel-Token` (or HMAC headers if using the secure flow).

**Environment variables** (already set for `sync-prices-to-sanity`):

- `SANITY_PROJECT_ID`
- `SANITY_DATASET`
- `SANITY_API_TOKEN` (with write permissions)
- `EXCEL_PUBLISH_TOKEN`

### Step 3.2: Input payload

```typescript
interface CpoSyncInput {
  mode: 'replace' | 'merge';
  products: CpoProductInput[];
}

interface CpoProductInput {
  brand: string;
  name: string;
  key: string;
  price_cents: number;
  url: string;
  description: string;
}
```

### Step 3.3: Key normalization

```typescript
function normalizeKey(raw: string): string {
  let key = raw.trim();
  key = key.replace(/^\/?certyfikowany-sprzet-uzywany\//, '');
  key = key.replace(/^\/+|\/+$/g, '');
  return key;
}

function keyToSlug(key: string): string {
  return `/certyfikowany-sprzet-uzywany/${key}/`;
}

function keyToDocId(key: string): string {
  return `cpo-${key}`;
}
```

### Step 3.4: Product type detection from URL

```typescript
function detectProductType(url: string): 'external' | 'internal' {
  if (!url) return 'internal';
  return url.startsWith('http') ? 'external' : 'internal';
}
```

### Step 3.5: Catalog product matching

For internal URLs (e.g., `artesania-audio/prestige`), find the matching catalog product in Sanity:

```typescript
async function findCatalogProduct(
  url: string,
  sanityConfig: SanityConfig
): Promise<string | null> {
  if (!url || url.startsWith('http')) return null;

  const parts = url.split('/');
  const productSlug = parts[parts.length - 1] || parts[parts.length - 2];
  if (!productSlug) return null;

  const query = `*[_type == "product" && slug.current == "/produkty/${productSlug}/"][0]._id`;
  const result = await sanityQuery(query, sanityConfig);
  return result || null;
}
```

If no match is found, the product still gets created but without `internalProduct` reference — as a **draft** (needs manual images).

### Step 3.6: Sync logic

For each Excel row:

1. Normalize the key
2. Detect product type from URL
3. If internal URL → find catalog product reference
4. Build Sanity mutation: `createIfNotExists` + `patch`
5. Determine draft/publish state

For `mode: 'replace'`:

6. Query Sanity for all existing non-archived `cpoProduct` documents
7. Any document whose key is not in the Excel data → archive (set `isArchived: true`)
8. Any document whose key IS in Excel but was previously archived → un-archive (set `isArchived: false`)

### Step 3.7: Sanity mutation construction

For each CPO product row, two mutations in a single transaction:

```typescript
function buildMutationsForProduct(
  product: CpoProductInput,
  catalogProductId: string | null,
  productType: 'internal' | 'external'
): SanityMutation[] {
  const key = normalizeKey(product.key);
  const docId = keyToDocId(key);
  const slug = keyToSlug(key);
  const isPublishable = productType === 'external' || catalogProductId !== null;
  const effectiveId = isPublishable ? docId : `drafts.${docId}`;

  const mutations: SanityMutation[] = [];

  // 1. Create if not exists (all fields with defaults)
  mutations.push({
    createIfNotExists: {
      _id: effectiveId,
      _type: 'cpoProduct',
      name: product.name,
      slug: { _type: 'slug', current: slug },
      productType: productType,
      priceCents: product.price_cents,
      brandName: product.brand,
      shortDescription: opisExcelToShortDescription(product.description || ''),
      useCustomGallery: false,
      isArchived: false,
      ...(productType === 'external' && product.url
        ? { externalUrl: product.url }
        : {}),
      ...(catalogProductId
        ? { internalProduct: { _type: 'reference', _ref: catalogProductId } }
        : {}),
    },
  });

  // 2. Patch Excel-sourced fields (preserves manually-edited fields like images, SEO, details)
  mutations.push({
    patch: {
      id: effectiveId,
      set: {
        name: product.name,
        priceCents: product.price_cents,
        brandName: product.brand,
        shortDescription: opisExcelToShortDescription(product.description || ''),
        productType: productType,
        isArchived: false,
        ...(productType === 'external' && product.url
          ? { externalUrl: product.url }
          : {}),
        ...(catalogProductId
          ? { internalProduct: { _type: 'reference', _ref: catalogProductId } }
          : {}),
      },
    },
  });

  return mutations;
}
```

**Important**: The `patch` sets Excel-sourced fields including **`shortDescription`** (rebuilt from column **Opis** via `opisExcelToShortDescription` each sync — overwrites rich text). It does NOT touch:

- `previewImage`, `imageGallery` (manual in Studio, unless you later extend sync)
- `details`, `technicalData` (managed in Sanity)
- `useCustomGallery` (managed in Sanity)
- `seo`, `openGraph` (managed in Sanity)
- `publishedDate` (managed in Sanity)

### Step 3.8: Archiving logic (mode: 'replace')

After processing all rows:

```typescript
async function archiveRemovedProducts(
  excelKeys: Set<string>,
  sanityConfig: SanityConfig
): Promise<number> {
  // Find all non-archived CPO products in Sanity
  const query = `*[_type == "cpoProduct" && isArchived != true] { _id, "slug": slug.current }`;
  const existing = await sanityQuery(query, sanityConfig);

  const mutations: SanityMutation[] = [];
  for (const doc of existing) {
    // Extract key from slug
    const key = doc.slug
      ?.replace('/certyfikowany-sprzet-uzywany/', '')
      ?.replace(/\/$/, '');
    if (!key) continue;

    if (!excelKeys.has(key)) {
      mutations.push({
        patch: {
          id: doc._id,
          set: { isArchived: true },
        },
      });
    }
  }

  if (mutations.length > 0) {
    await sanityMutate(mutations, sanityConfig);
  }

  return mutations.length;
}
```

### Step 3.9: Draft vs Publish decision tree

```
Product from Excel row:
├── URL starts with "http" (external)
│   └── PUBLISH — no own page needed, card links externally
├── URL is non-empty, doesn't start with "http" (internal)
│   ├── Catalog product found in Sanity
│   │   └── PUBLISH — inherits **preview** + **gallery** (when `useCustomGallery` is false) from catalog; short copy = **`shortDescription`** (PT) filled from Excel `Opis` or Studio
│   └── Catalog product NOT found
│       └── DRAFT — needs manual images in Studio before publishing
└── URL is empty (internal, no catalog link)
    └── DRAFT — needs manual images in Studio before publishing
```

When a product is created as a draft (`drafts.{docId}`), the client sees it in the Studio CPO section, uploads a **preview** if there is no catalog match, sets **`useCustomGallery`** if they want their own gallery instead of the catalog’s, and publishes manually.

### Step 3.10: Response format

```json
{
  "ok": true,
  "created": 3,
  "updated": 5,
  "archived": 1,
  "unarchived": 0,
  "drafts": 1,
  "errors": []
}
```

### Step 3.11: Chaining from `pricing-ingest`

Update the existing `pricing-ingest` Edge Function to forward CPO data (same pattern as `sync-prices-to-sanity`):

```typescript
// After Supabase ingest + Sanity price sync...
let cpoResult = null;
if (body.cpo_products && body.cpo_products.length > 0) {
  try {
    const cpoResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/cpo-product-sync`,
      {
        method: "POST",
        headers: {
          Authorization: req.headers.get("authorization")!,
          "X-Excel-Token": tokenHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: body.mode || "replace",
          products: body.cpo_products,
        }),
      },
    );
    cpoResult = cpoResponse.ok
      ? await cpoResponse.json()
      : { error: `CPO sync failed: ${cpoResponse.status}` };
  } catch (e) {
    cpoResult = { error: e?.message ?? String(e) };
  }
}
```

Updated `pricing-ingest` response:

```json
{
  "ok": true,
  "supabase": { "counts": { ... } },
  "sanity": { "prices": "ok", ... },
  "cpo": { "created": 3, "updated": 5, "archived": 1, ... }
}
```

---

## Step 4: GROQ Query Updates

### Step 4.1: Update `cpoProductFragment` (listing cards)

The listing card needs to resolve the effective preview image: own image vs inherited from catalog product.

```groq
const cpoProductFragment = /* groq */ `
  _id,
  _createdAt,
  "publishDate": coalesce(publishedDate, _createdAt),
  "slug": slug.current,
  name,
  priceCents,
  isArchived,
  productType,
  brandName,
  externalUrl,
  transparentBackground,
  useCustomGallery,
  internalProduct,
  ${imageFragment('"mainImage": select(defined(previewImage.asset) => previewImage, internalProduct->previewImage)')},
  ${portableTextFragment('shortDescription')},
`;
```

**Brand simplification**: `brandName` is a plain string — no `select()` needed.

**Preview image resolution** (no toggle):

- If the CPO document has a `previewImage` asset → use it.
- Else → `internalProduct->previewImage` (may be null if no reference).

**Short copy on cards**: portable `shortDescription` only (required).

### Step 4.2: Update `queryCpoProductBySlug` (detail page)

The detail query should include:

- `shortDescription` (PT), `useCustomGallery`
- Raw `previewImage` + **`resolvedPreviewImage`** via  
  `select(defined(previewImage.asset) => previewImage, internalProduct->previewImage)`
- `imageGallery` on the CPO doc + `internalProduct->{ previewImage, imageGallery, … }` for gallery resolution

**Gallery on the page**: if `useCustomGallery === true` → use CPO `imageGallery`; else → `internalProduct?.imageGallery ?? imageGallery`.

**Hero image**: use `resolvedPreviewImage` (or the same `select` expression) for the hero and inquiry block.

**Short copy**: `shortDescription` (PT) only.

### Step 4.3: Update `cpoFilterConditions` and `queryCpoProductsFilterMetadata`

The current filtering uses `denormBrandSlug` for brand matching. Since we're removing denormalization, filters should use `brandName` directly.

**Update `cpoFilterConditions`:**

```groq
const cpoFilterConditions = /* groq */ `
  _type == "cpoProduct"
  && isArchived != true
  && (
    $search == "" || name match $search + "*"
  )
  && (
    count($brands) == 0
    || lower(brandName) in $brands
  )
  && ($minPrice == 0 || priceCents >= $minPrice)
  && ($maxPrice == 0 || priceCents <= $maxPrice)
`;
```

**Note**: `$brands` parameter values should be lowercased on the frontend before sending to GROQ, matching `lower(brandName)`.

**Update `queryCpoProductsFilterMetadata`:**

```groq
export const queryCpoProductsFilterMetadata = defineQuery(`{
  "products": *[
    _type == "cpoProduct"
    && isArchived != true
    && defined(brandName)
  ] {
    _id,
    name,
    "brandSlug": lower(brandName),
    "brandName": brandName,
    "basePriceCents": priceCents,
    "categorySlug": null,
    "allCategorySlugs": [],
    "customFilterValues": []
  },
  "brands": array::unique(*[
    _type == "cpoProduct"
    && isArchived != true
    && defined(brandName)
  ] {
    "_id": lower(brandName),
    "name": brandName,
    "slug": lower(brandName),
    "logo": null
  }),
  "globalMaxPrice": math::max(*[
    _type == "cpoProduct"
    && isArchived != true
    && defined(priceCents)
  ].priceCents),
  "globalMinPrice": math::min(*[
    _type == "cpoProduct"
    && isArchived != true
    && defined(priceCents)
  ].priceCents)
}`);
```

Key changes:
- `denormBrandSlug` → `lower(brandName)` (for filtering/matching)
- `denormBrandName` → `brandName` (for display)
- Brand logo is always `null` (no brand reference to dereference)
- No `brandType` or `brand->` anywhere

---

## Step 5: Frontend Changes

### Step 5.1: Preview image

Prefer `resolvedPreviewImage` from GROQ (or compute the same `select` in one place). No `useCustomImages` toggle.

### Step 5.2: Gallery

```typescript
const galleryImages = product.useCustomGallery
  ? product.imageGallery
  : product.internalProduct?.imageGallery ?? product.imageGallery;
```

### Step 5.3: Short description (card + hero)

Render portable **`shortDescription`** only (required in schema). Truncate for cards as needed.

No catalog short-description inheritance for card/hero.

### Step 5.4: Update `CpoProductHero`

**File**: `apps/web/src/components/cpo/CpoProductHero/index.tsx`

- Hero image: `resolvedPreviewImage` / fallback chain.
- `shortDescription` (PT) only.
- (Optional) Link to original catalog product when `internalProduct` exists — unchanged from Phase 1 plan.

### Step 5.5: Update `CpoProductCard`

**File**: `apps/web/src/components/ui/CpoProductCard/index.tsx`

- Use `mainImage` from GROQ (`resolvedPreviewImage` pattern on the listing fragment).
- Description: PT `shortDescription` (truncate for cards).

### Step 5.6: Update CPO detail page

**File**: `apps/web/src/app/certyfikowany-sprzet-uzywany/[slug]/page.tsx`

- Pass `resolvedPreviewImage` and resolved gallery into hero / `CpoProductGallerySection`.

---

## Step 6: Revalidation Updates

### Step 6.1: Update revalidation for CPO sync

**File**: `apps/web/src/app/api/revalidate/route.ts`

The existing revalidation already handles `cpoProduct` type changes (from Phase 1). However, since the Excel sync creates/patches documents via the Sanity HTTP API (not the Studio), Sanity webhooks might not fire automatically for API-created documents.

Two options:

**Option A**: The Edge Function calls the Next.js revalidation endpoint after completing the sync:

```typescript
await fetch(`${NEXT_PUBLIC_URL}/api/revalidate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${NEXT_REVALIDATE_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ tags: ['cpoProduct', 'cpoPage'] }),
});
```

**Option B**: Ensure the Sanity webhook is configured to fire on API mutations (not just Studio changes). Sanity webhooks do fire on API mutations by default, so this should work without changes.

Recommended: **Option B** (webhooks already fire on API mutations), with **Option A** as a fallback safety net.

---

## Step 7: Implementation Order

```
Step 1: Sanity Schema Changes
  │  Simplify brand to brandName string. Add internalProduct,
  │  useCustomGallery, required shortDescription (PT). `brandName` first.
  │  Remove denormalization. Update previewImage + description validation.
  │  Run typegen.
  │
  ├──► Step 2: Office Script Changes
  │     Update SyncPricingToSupabase.ts to read CPO sheet.
  │     Create standalone SyncCpoToSupabase.ts.
  │
  ├──► Step 3: Edge Function (cpo-product-sync)
  │     Create function. Handle create/patch/archive.
  │     Wire chaining from pricing-ingest.
  │
  ├──► Step 4: GROQ Query Updates
  │     Update cpoProductFragment, queryCpoProductBySlug,
  │     cpoFilterConditions, and queryCpoProductsFilterMetadata.
  │     Replace denorm fields with direct brandName usage.
  │
  └──► Step 5: Frontend Changes
       Update CpoProductHero, CpoProductCard, detail page
       to resolve effective images and descriptions.
       Update brand display to use brandName string directly.
```

Steps 2, 3, 4, 5 can be worked on in parallel after Step 1.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/cpo-product-sync/index.ts` | Edge Function: Excel CPO data → Sanity mutations |
| `.ai/office-scripts/SyncCpoToSupabase.ts` | Standalone Office Script: CPO-only sync |

## Files to Modify

| File | Change |
|------|--------|
| `apps/studio/schemaTypes/documents/collections/cpo-product.tsx` | `brandName` first, required PT `shortDescription`, optional `internalProduct`, `useCustomGallery`, preview rules |
| `apps/studio/actions/wrap-publish-with-denorm.ts` | Remove `cpoProduct` branch from publish wrapper. Remove from `applyDenormToPublish` types list |
| `.ai/office-scripts/SyncPricingToSupabase.ts` | Add `readCpo()`, include `cpo_products` in payload |
| `supabase/functions/pricing-ingest/index.ts` | Chain to `cpo-product-sync` (if using server-side chaining) |
| `apps/web/src/global/sanity/query.ts` | Update `cpoProductFragment`, `queryCpoProductBySlug`, `cpoFilterConditions`, `queryCpoProductsFilterMetadata`. Replace all `denormBrandSlug`/`denormBrandName`/`brandType`/`brand->` with `brandName` |
| `apps/web/src/app/certyfikowany-sprzet-uzywany/[slug]/page.tsx` | Apply image/description resolution. Update brand display |
| `apps/web/src/components/cpo/CpoProductHero/index.tsx` | Handle inherited images/description, show "original product" link. Use `brandName` string |
| `apps/web/src/components/cpo/CpoProductHero/CpoProductInquirySection.tsx` | Accept resolved image data. Use `brandName` string |
| `apps/web/src/components/ui/CpoProductCard/index.tsx` | Handle resolved image from GROQ. Use `brandName` string |
| `apps/web/src/components/cpo/CpoProductGallerySection/index.tsx` | Accept resolved gallery data |

## Files to Delete

| File | Reason |
|------|--------|
| `apps/studio/utils/denormalize-cpo-product.ts` | Denormalization removed — brand is now a simple string, no computation needed |

---

## Edge Cases

### Multiple specimens of the same product

The client may have two copies of "StromTank S-5000" in different conditions. Each gets a unique `Klucz`: `stromtank-s5000-demo-1`, `stromtank-s5000-demo-2`. Both can reference the same catalog product via the same `URL` column value.

### Product removed from Excel, then re-added

When a product's key disappears from the Excel → archived (`isArchived: true`). When it reappears → the existing document is found by `createIfNotExists` (no-op), then patched with `isArchived: false`. All manually-added images, descriptions, and SEO are preserved.

### Client renames a product but keeps the same key

The `Klucz` column is the stable identifier. Changing `Nazwa` is safe — the sync function patches the `name` field without creating a new document.

### Client changes the key (Klucz)

This effectively creates a new product and archives the old one. The old document (with its images, descriptions, etc.) is preserved in Sanity but marked as archived. If this is unintentional, the client can:

1. Change the key back in Excel and re-sync
2. Or manually un-archive the old document in Studio

### Internal URL doesn't match any catalog product

The product is created as a **draft** with no `internalProduct` reference. The client needs to either:

- Fix the URL in Excel to match an existing product's slug, then re-sync
- Or manually set up the product in Sanity (add images, publish)

### External product with no price

Valid scenario — the price might not be known or relevant for external listings. `priceCents: 0` or null. The card shows "Cena do ustalenia" (already handled in `CpoProductInquirySection`).
