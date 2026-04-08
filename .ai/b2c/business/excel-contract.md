# Excel Contract

Status: completed
Owner: planning
Last updated: 2026-04-08
Depends on: current business decisions
Related files: `product-buyability-rules.md`, `returns-and-cancellations-rules.md`, `../architecture/data-ownership.md`, `../architecture/cpo-and-b2c-relation.md`

## Purpose

This file defines the agreed role and structure of Excel in the Audiofast B2C system.

It covers both:

- standard catalog products that may become buyable online
- `CPO` specimen products that already exist as separate item instances

## Core Principle

Excel is not a live runtime data source for the storefront.

Instead:

- Excel is the upstream business-input source for selected sync-owned fields
- sync writes the applied result into `Sanity` and, where relevant, `Supabase`
- `Next.js` reads runtime data from `Sanity` and `Supabase`, never from Excel directly

## Source File Definition

- the current pricing workbook remains the authoritative Excel source for B2C business inputs
- the business edits this workbook directly
- the Office Script remains the publishing mechanism from Excel into the application systems
- workbook structure should be changed only in controlled, implementation-tracked steps because the Office Scripts currently read fixed column positions

## Standard Product Contract

### Source Sheet

- authoritative sheet: `Produkty`
- `Opcje`, `Wartości`, `Listy`, and `Ustawienia` remain unchanged for this contract change

### Matching Key

- the stable product identity for B2C flags is the `URL` column
- this is the same product-level key that becomes `price_key` in the pricing pipeline
- multiple rows with the same `URL` represent models / variants of one product, not separate B2C products

### New Required Columns

The agreed new columns for `Produkty` are:

- `Sprzedaż Online`
- `Zwrot`

Current business proposal for placement:

- column `I`: `Sprzedaż Online`
- column `J`: `Zwrot`

This placement is chosen so the client sees the B2C flags near the core product row.
Implementation must also update the Office Script because the current script reads fixed column indexes.

### Aggregation Rule Across Variant Rows

The flags are product-level even though they appear on rows.

Rules:

- all rows with the same `URL` belong to one product
- if at least one row for that `URL` contains `TAK` in `Sprzedaż Online`, the product is treated as sellable online
- if at least one row for that `URL` contains `TAK` in `Zwrot`, the product is treated as returnable
- rows do not need to be perfectly duplicated for the product-level result to become true

### Value Format Rules

- only `TAK` means true
- matching should be case-insensitive after trimming whitespace
- empty value means false
- any value other than `TAK` means false
- if `URL` is missing or invalid, the product is treated as non-sellable and non-returnable

### Standard Product Sync Result

The workbook does not own the product catalog itself.

Instead:

- standard products live in `Sanity`
- the Excel workbook provides pricing extensions plus the two B2C flags
- sync applies `Sprzedaż Online` and `Zwrot` into `Sanity`
- sync applies extended standard-product pricing into `Supabase`

## `CPO` Contract

### Source Sheet

- authoritative sheet: `CPO`
- one row represents one unique `CPO` specimen

### Stable Identity

- the stable identity of a `CPO` item is `Klucz`
- `Klucz` is effectively the specimen URL key
- changing `Nazwa` is a normal update
- changing `Klucz` should be treated as creating a different specimen identity

### Required Columns

Current `CPO` sheet structure remains:

- `A` `Marka`
- `B` `Nazwa`
- `C` `Klucz`
- `D` `Cena`
- `E` `URL`
- `F` `Opis`

Agreed new columns:

- `G` `Sprzedaż Online`
- `H` `Zwrot`

### Value Format Rules

The new `CPO` flags use the same interpretation as standard products:

- only `TAK` means true
- matching should be case-insensitive after trimming whitespace
- empty value means false
- any value other than `TAK` means false

### `CPO` Row Semantics

- row presence means the specimen exists in the current business-controlled `CPO` feed
- row removal means the specimen should no longer remain in the active public offer
- existing implementation already archives removed `CPO` items rather than deleting history

### `CPO` Sync Result

- `CPO` documents live in `Sanity`
- Excel sync updates the sync-owned `CPO` business fields in `Sanity`
- manual edits to sync-owned fields in `Sanity` are temporary and will be overwritten by the next sync
- the `CPO` operational availability field in `Sanity` must not be overwritten by Excel sync

## Sync Expectations

### Direction

- Excel sync pushes selected business data into `Sanity`
- Excel sync pushes extended standard-product pricing data into `Supabase`
- Excel has no direct runtime connection to the storefront

### Failure Handling

- if sync fails, the system should continue using the last successfully persisted data in `Sanity` and `Supabase`
- v1 does not require a special stale-sync UI

## Admin / Operations Boundary

### Standard Products

- `Sprzedaż Online` and `Zwrot` are upstream Excel-owned fields
- they are stored in `Sanity` after sync
- manual admin edits to those sync-owned fields are temporary and will be overwritten by the next sync

### `CPO` Products

- `Marka`, `Nazwa`, `Klucz`, `Cena`, `URL`, `Opis`, `Sprzedaż Online`, and `Zwrot` are sync-owned Excel business fields
- `Sanity` owns editorial enrichment such as images, gallery, long-form content, and SEO
- `Sanity` also owns live `CPO` operational availability for v1

## Future-Ready Fields Not Required In V1

- dimensions
- weight
- future shipping metadata

## Notes

The key Phase 03 principle is:

- Excel defines the upstream business intent for selected fields
- runtime truth is the synced result stored in `Sanity` and `Supabase`
