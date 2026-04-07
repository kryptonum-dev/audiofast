# Phase 02 - Flow And Operations Closure

Status: completed
Owner: planning
Last updated: 2026-04-07
Depends on: `phase-01-planning-foundation.md`
Related files: `../open-threads.md`, `../architecture/admin-panel-sanity.md`, `../architecture/cart-and-checkout-model.md`, `../architecture/payment-process-model.md`

## Objective

Close the remaining broad flow and operations planning loops before the project moves into the business data contract and commerce-foundation phases.

## Why This Phase Exists

Several key customer-facing decisions are already closed:

- order status model
- customer auth and access model
- email communication flow
- customer panel IA
- cart and checkout model
- payment process model

However, the project still needs a coherent broad model for:

- operator-facing admin structure

Without these, later implementation planning would still be forced to rediscover core flow decisions.

## Inputs

- `../architecture/order-lifecycle.md`
- `../architecture/customer-auth-and-access.md`
- `../architecture/email-flow.md`
- `../architecture/customer-panel-ia.md`
- `../business/product-buyability-rules.md`
- `../business/coupon-rules.md`

## Main Deliverables

- resolved admin-panel architecture thread
- resolved cart and checkout model
- resolved payment process model
- updated architecture/business docs reflecting those decisions

## Work Included In This Phase

### 1. Close Operator Workflow Thread

- define broad admin navigation
- define order list vs order detail responsibilities
- define how shipment, invoices, coupons, and return handling fit into admin

### 2. Closed Cart And Checkout Model

- define broad PDP -> cart -> checkout flow
- define configurable cart editing model
- define coupon placement and checkout branching
- align reusable customer data behavior with checkout flow

### 3. Closed Payment Process Model

- define broad handoff to `Przelewy24`
- define webhook / redirect / recovery story
- define retry / expiration / failure behavior at a structural level

### 4. Prepare For Phase 03

- identify which decisions belong to the business data contract phase
- identify which questions should be deferred to commerce-foundation modeling

## Not In Scope For This Phase

- final Excel column contract
- final sync implementation details
- final order number format
- detailed entity-by-entity schema design
- storefront or admin implementation work

## Done Criteria

Phase 02 can be considered complete when:

- the remaining active thread files in `../threads/` are resolved and promoted into their long-term domain files
- broad operator, cart/checkout, and payment flows are documented
- there are no major flow-level ambiguities blocking phase 03 planning

## Completion Note

Phase 02 is now complete.

Its key outputs are:

- `../architecture/cart-and-checkout-model.md`
- `../architecture/payment-process-model.md`
- `../architecture/admin-panel-sanity.md`
