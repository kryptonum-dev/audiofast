# Phase 04 - Commerce Foundation

Status: in progress
Owner: planning
Last updated: 2026-04-08
Depends on: `phase-03-business-data-contract.md`
Related files: `../architecture/commerce-data-model.md`, `../architecture/system-map.md`, `../architecture/order-lifecycle.md`, `../architecture/invoice-and-documents.md`, `../testing-strategy.md`

## Objective

Convert the resolved business contract and flow decisions into a stable commerce architecture foundation that is ready to support implementation.

## Why This Phase Exists

After the business contract is settled, the project still needs a coherent operational model for:

- core commerce entities
- system responsibilities
- order numbering
- payment-state behavior
- document linkage strategy

This phase turns planning decisions into an implementation-ready foundation rather than leaving them as disconnected rules.

With the current interpretation of the roadmap, Phase 04 is where the backend structure should become concrete:

- required `Sanity` fields
- required Excel / Office Script contract updates
- required `Supabase` table structure
- cross-system entity relationships

## Inputs

- resolved phase-two threads
- completed Phase 03 business contract
- finalized ownership boundaries
- finalized `CPO` operational model
- `../architecture/order-lifecycle.md`
- `../architecture/customer-auth-and-access.md`
- `../testing-strategy.md`

## Main Deliverables

- accepted high-level commerce data model
- clarified system map
- resolved order number direction
- resolved payment-state direction
- resolved invoice/document linkage direction
- order snapshot direction concrete enough for backend structure work

## Work Included In This Phase

### 1. Expand Commerce Data Model

- entity list
- relationships
- snapshot rules
- audit/history needs
- backend structure decisions for the order domain

### 2. Expand System Map

- runtime data flow
- customer flow
- operator flow
- failure-path understanding

### 3. Finalize Cross-Cutting Foundations

- order number format direction
- payment-state model direction
- invoice/document storage linkage direction
- testing foundation direction for the implementation phases that follow

## Questions To Resolve In This Phase

### 1. Order Snapshot Scope

For standard-product order lines, Phase 04 should finalize which fields are preserved at purchase time, including at least:

- product name
- product key / URL
- selected model
- selected configuration / options
- final price
- returnability at purchase time

For `CPO` order lines, Phase 04 should finalize which fields are preserved at purchase time, including at least:

- `Klucz`
- specimen name
- brand
- final price
- returnability at purchase time
- relevant archived / availability context at purchase time

### 2. Order Immutability

Phase 04 should explicitly lock that:

- later Excel syncs do not mutate existing orders
- later `Sanity` edits do not mutate existing orders
- orders preserve purchase-time truth even if the product later becomes non-sellable, archived, or non-returnable

### 3. Last-Good Sync Behavior

Phase 04 should lock how the system behaves when sync fails or is stale:

- the storefront should continue using the last successfully persisted values in `Sanity` and `Supabase`
- v1 does not require a dedicated stale-sync UX unless a later implementation need appears

## Not In Scope For This Phase

- full storefront implementation
- full admin implementation
- final QA/launch work

## Done Criteria

Phase 04 can be considered complete when:

- the commerce model is stable enough to support implementation tickets
- the system map explains how the systems interact clearly enough for engineering work
- the order-domain backend structure is clear enough to create implementation tasks
- cross-cutting foundations no longer block PDP/cart, checkout, or admin implementation
