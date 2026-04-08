# Phase 03 - Business Data Contract

Status: completed
Owner: planning
Last updated: 2026-04-08
Depends on: `phase-02-flow-and-operations-closure.md`
Related files: `../business/excel-contract.md`, `../architecture/data-ownership.md`, `../business/product-buyability-rules.md`, `../business/returns-and-cancellations-rules.md`, `../architecture/cpo-and-b2c-relation.md`

## Objective

Finalize the business-controlled source-of-truth contract for B2C product and customer-related operational decisions, including how `CPO` specimens fit the same commerce model as standard products.

## Why This Phase Exists

The B2C model depends on a clear upstream business contract before deeper commerce modeling can begin.

Before implementation can go deep, the project needed clarity on:

- exact Excel fields
- stable product matching
- sync expectations
- what is authoritative vs derived in the application layer
- which `CPO` decisions stay business-controlled vs commerce-operational

## Inputs

- resolved phase-two flow threads
- current Excel business decisions
- `../business/excel-contract.md`
- `../architecture/data-ownership.md`
- `../architecture/cpo-and-b2c-relation.md`

## Main Deliverables

- finalized Excel contract
- documented source-of-truth rules
- documented ownership boundaries between Excel, Sanity, Supabase, and Next.js
- documented rules for `CPO` operational availability and admin override
- clear handoff into the Phase 04 commerce-foundation work

## Completion Summary

### 1. Standard Product Contract Locked

- source sheet: `Produkty`
- product identity key: `URL` / `price_key`
- new columns: `Sprzedaż Online`, `Zwrot`
- current business proposal for placement: columns `I` and `J`
- flags are product-level even when repeated on variant rows
- only `TAK` means true
- empty or any other value means false
- missing / invalid `URL` means non-sellable and non-returnable
- implementation must update the Office Script because the current script reads fixed column indexes

### 2. `CPO` Contract Locked

- source sheet: `CPO`
- one row represents one unique specimen
- stable identity key: `Klucz`
- existing columns `A-F` stay in place
- new columns: `G` `Sprzedaż Online`, `H` `Zwrot`
- only `TAK` means true
- empty or any other value means false
- sync-owned `CPO` business fields are overwritten by the next Excel sync

### 3. Ownership Model Locked

- Excel is the upstream source for selected sync-owned business fields
- `Sanity` stores runtime product/CPO state after sync
- `Supabase` stores extended standard-product pricing plus order-domain data
- `Next.js` reads runtime data from `Sanity` and `Supabase`, never directly from Excel
- `CPO` operational availability lives in `Sanity` in v1

### 4. `CPO` Operational Model Locked

- archive state and availability state stay separate
- v1 statuses: `available`, `on_hold`, `sold_out`, `manually_unavailable`
- `manually_unavailable` blocks creation of new orders
- archived products are not buyable for new customers
- archived products do not block completion of an already-created valid awaiting-payment order

## What Moves To Phase 04

The detailed order-domain modeling now belongs to Phase 04, especially:

- exact order / order-item snapshot shape
- payment-attempt entity details
- order numbering
- invoice/document linkage
- broader commerce entity relationships

## Not In Scope For This Phase

- full storefront UI
- full admin UI design
- low-level payment provider implementation
- full order-schema implementation
- launch-readiness tasks

## Done Criteria

Phase 03 is considered complete because:

- `../business/excel-contract.md` is concrete enough for implementation planning
- `../architecture/data-ownership.md` clearly assigns authority by domain
- `CPO` business inputs and `CPO` commerce-operational state are clearly separated
- source-of-truth ambiguity no longer blocks commerce modeling
