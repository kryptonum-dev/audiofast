# Data Ownership

Status: completed
Owner: planning
Last updated: 2026-04-08
Depends on: `../business/excel-contract.md`
Related files: `commerce-data-model.md`, `system-map.md`, `cpo-and-b2c-relation.md`

## Purpose

This file defines which system owns which category of data in the B2C architecture.

## Core Ownership Principle

Excel is not a runtime application source.

Instead:

- Excel is the upstream source for selected sync-owned business fields
- `Sanity` and `Supabase` store the synced runtime result
- `Next.js` reads from `Sanity` and `Supabase`, never from Excel directly

## Ownership By System

### Excel

Excel owns upstream business inputs for selected sync-owned fields.

Current agreed scope:

- standard-product `Sprzedaż Online`
- standard-product `Zwrot`
- `CPO` business fields: `Marka`, `Nazwa`, `Klucz`, `Cena`, `URL`, `Opis`
- `CPO` `Sprzedaż Online`
- `CPO` `Zwrot`

Important boundary:

- Excel is authoritative upstream for those fields
- Excel does not directly serve the storefront
- Excel must not own live `CPO` operational availability

### Sanity

`Sanity` is the runtime source for the product and `CPO` catalog surface.

Current agreed scope:

- standard product documents
- `CPO` documents
- synced B2C fields written from Excel into `Sanity`
- editorial enrichment such as images, gallery, long-form content, and SEO
- internal operator/admin surface via `Sanity App SDK`
- live `CPO` operational availability in v1

For `CPO`, `Sanity` owns:

- archive / active-offer visibility at document level
- availability status (`available`, `on_hold`, `sold_out`, `manually_unavailable`)
- hold timing metadata such as `holdUntil`
- any lightweight order linkage needed for the admin/operator view

### Supabase

`Supabase` is the runtime source for structured commerce-operational data outside the catalog documents.

Current agreed scope:

- extended standard-product pricing and configuration data
- one shared orders domain for both standard and `CPO` purchases
- order items
- payment-attempt data
- status history
- customer OTP-related state
- shipment metadata
- invoice metadata
- coupon data / usage

Current v1 boundary:

- `Supabase` does not need to own live `CPO` availability in v1
- `Supabase` still owns the order data that may trigger `Sanity` availability updates

### Next.js Application Layer

`Next.js` is the orchestration and enforcement layer.

Current agreed scope:

- read runtime data from `Sanity` and `Supabase`
- compute final storefront buyability
- cart logic
- checkout logic
- mixed standard + `CPO` line validation
- payment initiation / verification
- customer OTP flow
- customer panel access
- secure document / order access checks
- automatic `CPO` availability updates in `Sanity` based on order/payment events

## Ownership By Domain

### Standard Products

- catalog document: `Sanity`
- extended pricing / options: `Supabase`
- upstream sellability / returnability input: `Excel`
- persisted runtime sellability / returnability: `Sanity`
- final storefront buyability check: `Next.js`

### `CPO` Products

- business fields: upstream in `Excel`, persisted in `Sanity`
- editorial fields: `Sanity`
- operational availability: `Sanity`
- order linkage and history: `Supabase`
- final storefront buyability check: `Next.js`, using `Sanity` fields

### Orders

- orders and order history live in `Supabase`
- one shared orders model should support both standard and `CPO` lines
- orders must preserve purchase-time truth rather than mutating with later source-data changes
- detailed snapshot structure belongs to Phase 04

## Sync And Override Rules

### Sync-Owned Fields

- if a field is marked as Excel-owned upstream, the next sync overwrites the corresponding runtime field in `Sanity`
- manual edits in `Sanity` to those fields are temporary

### Operational Override

- `CPO` operational availability is not an Excel-owned field
- operator changes to `CPO` availability happen through the admin surface
- normal Excel sync must not reopen, sell, or unblock a `CPO` item by overwriting operational state

## Runtime Principles

- `Next.js` never reads Excel directly
- standard-product storefront buyability depends on runtime data already synced into `Sanity` plus valid pricing from the pricing layer
- `CPO` storefront buyability depends on `Sanity` state, not direct `Supabase` lookup
- archived `CPO` items are not buyable for new customers, but existing valid awaiting-payment orders may still complete

## Notes

This is one of the most important architecture files because it prevents accidental duplication of authority across systems.
