# Phase 04 - Commerce Foundation

Status: completed
Owner: planning
Last updated: 2026-04-09
Depends on: `phase-03-business-data-contract.md`
Related files: `../architecture/commerce-data-model.md`, `../architecture/commerce-table-model.md`, `../architecture/system-map.md`, `../architecture/order-lifecycle.md`, `../architecture/invoice-and-documents.md`, `../testing-strategy.md`

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
- accepted v1 table model
- clarified system map
- resolved order number direction
- resolved payment-state direction
- resolved invoice/document linkage direction
- order snapshot direction concrete enough for backend structure work
- accepted JSON shapes, constraints, and minimal useful indexes for the v1 backend model

## Work Included In This Phase

### 1. Expand Commerce Data Model

- entity list
- relationships
- snapshot rules
- audit/history needs
- backend structure decisions for the order domain
- accepted table-level structure for orders, items, profiles, coupons, returns, auth linkage, and invoice storage

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

## Completion Summary

The accepted Phase 04 direction now includes:

- `orders`, `order_items`, `customer_profiles`, `coupons`, and `return_cases` as the core v1 business tables
- `Supabase Auth` for OTP identity/session handling
- no separate custom OTP challenge table
- no separate `payment_attempts` table in v1
- `awaiting_payment` active window of `15 minutes`
- invoice PDFs stored in private `Supabase Storage`
- `CPO` availability remaining in `Sanity`
- public order number format `AF-YYYY-NNNNN`
- accepted JSON shapes for orders, items, and profile defaults
- accepted minimal useful constraints and indexes

The commerce-foundation work is considered complete because:

- the accepted table model is documented in `../architecture/commerce-table-model.md`
- the supporting architecture files have been aligned to the accepted model
- the core `Supabase` schema has been created
- the invoice storage bucket has been created
- the generated database types have been refreshed

### Work Carried Forward

The next phase work should focus on:

- implementing the storefront/admin/customer flows that consume the accepted backend model
- defining exact query patterns where they become necessary during implementation

## Not In Scope For This Phase

- full storefront implementation
- full admin implementation
- final QA/launch work

## Done Criteria

Phase 04 is now considered complete because:

- the commerce model is stable enough to support implementation tickets
- the accepted table model is documented clearly enough to support schema work
- the system map explains how the systems interact clearly enough for engineering work
- the order-domain backend structure no longer blocks PDP/cart, checkout, or admin implementation
