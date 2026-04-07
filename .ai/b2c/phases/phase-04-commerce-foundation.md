# Phase 04 - Commerce Foundation

Status: planned
Owner: planning
Last updated: 2026-04-07
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

## Inputs

- resolved phase-two threads
- finalized Excel contract
- finalized ownership boundaries
- `../architecture/order-lifecycle.md`
- `../architecture/customer-auth-and-access.md`
- `../testing-strategy.md`

## Main Deliverables

- accepted high-level commerce data model
- clarified system map
- resolved order number direction
- resolved payment-state direction
- resolved invoice/document linkage direction

## Work Included In This Phase

### 1. Expand Commerce Data Model

- entity list
- relationships
- snapshot rules
- audit/history needs

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

## Not In Scope For This Phase

- full storefront implementation
- full admin implementation
- final QA/launch work

## Done Criteria

Phase 04 can be considered complete when:

- the commerce model is stable enough to support implementation tickets
- the system map explains how the systems interact clearly enough for engineering work
- cross-cutting foundations no longer block PDP/cart, checkout, or admin implementation
