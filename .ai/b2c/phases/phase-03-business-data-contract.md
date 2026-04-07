# Phase 03 - Business Data Contract

Status: in progress
Owner: planning
Last updated: 2026-04-07
Depends on: `phase-02-flow-and-operations-closure.md`
Related files: `../business/excel-contract.md`, `../architecture/data-ownership.md`, `../business/product-buyability-rules.md`, `../business/returns-and-cancellations-rules.md`, `../architecture/cpo-and-b2c-relation.md`

## Objective

Finalize the business-controlled source-of-truth contract for B2C product and customer-related operational decisions, including how `CPO` specimens fit the same commerce model as standard products.

## Why This Phase Exists

The B2C model depends on Excel remaining the source of truth for selected business flags.

Before implementation can go deep, the project needs clarity on:

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
- documented snapshot expectations for order-time data
- documented rules for `CPO` operational availability and admin override

## Work Included In This Phase

### 1. Finalize Excel Structure

- exact required columns
- boolean/value encoding
- matching key
- empty-value behavior
- distinction between standard-product flags and `CPO` specimen inputs

### 2. Finalize Sync Expectations

- direction of sync
- frequency expectations
- failure handling expectations
- how `CPO` content sync and commerce-operational state avoid conflicting with each other

### 3. Finalize Ownership Boundaries

- what stays authoritative in Excel
- what is copied or derived into runtime data
- what is frozen into order snapshots
- what is operator-controlled in the admin panel for `CPO` sellability / availability

## Not In Scope For This Phase

- final storefront UI
- final admin UI design
- low-level payment provider implementation
- launch-readiness tasks

## Done Criteria

Phase 03 can be considered complete when:

- `../business/excel-contract.md` is concrete enough for implementation planning
- `../architecture/data-ownership.md` clearly assigns authority by domain
- `CPO` business inputs and `CPO` commerce-operational state are clearly separated
- source-of-truth ambiguity is no longer a blocker for commerce modeling
