# B2C Implementation Backlog

Status: in progress
Owner: planning / execution
Last updated: 2026-04-15
Depends on: `../open-threads.md`, `../phases/phase-02-flow-and-operations-closure.md`
Related files: `../milestones.md`, `../README.md`, `../testing-strategy.md`, `../phases/phase-03-business-data-contract.md`, `../phases/phase-04-commerce-foundation.md`

## Purpose

This file is the live execution tracker for the Audiofast B2C initiative.

It should answer:

- what phase is currently active
- what is currently being worked on
- what is blocked
- what is ready next
- what was recently completed

## Current Execution Snapshot

- current active phase: `Phase 06 - Checkout And Payments`
- current working mode: checkout implementation planning / transactional flow enablement
- phase 05 has been closed

## Current Focus

- implement the real checkout form and customer-data flow
- add hard validation before order creation / payment handoff
- introduce browser-level `Playwright` coverage for pricing, checkout, and payment-critical flows

## Recently Completed

- order status model finalized
- checkout/authentication model finalized
- email communication flow finalized
- customer panel IA finalized
- cart and checkout model finalized
- payment process model finalized
- admin panel architecture finalized
- root testing strategy added for future implementation phases
- phase roadmap expanded under `../phases/`
- standard-product Excel flags locked
- `CPO` Excel flags locked
- ownership boundaries locked
- `CPO` availability model locked
- accepted v1 table set locked
- accepted v1 payment simplification locked (`15-minute` unpaid window, no separate payment-attempt table)
- accepted Supabase Auth direction locked
- accepted Supabase Storage invoice direction locked
- accepted public order number format locked (`AF-YYYY-NNNNN`)
- accepted JSON snapshot shapes locked
- accepted minimal useful constraints and indexes locked
- `Supabase` schema created for the accepted Phase 04 table model
- private invoice storage bucket created
- generated `database.types.ts` refreshed from the live schema
- `Vitest`, `React Testing Library`, `MSW`, and `jsdom` setup added in `apps/web`
- shared test-structure convention added for future `apps/web` work
- runtime buyability rules implemented for standard and `CPO` storefront products
- standard and `CPO` PDP buyability now drive dual CTA visibility in the storefront
- initial cart domain implemented under `src/global/b2c/cart/`
- browser cart runtime foundation implemented with provider, reducer, context, and persistence hydration
- standard PDP `Add to cart` now writes real lines into the cart runtime
- `CPO` PDP `Add to cart` now writes real specimen lines into the cart runtime
- `CPO` duplicate-prevention UX added for specimens already in cart
- minimal add-to-cart confirmation popup implemented
- storefront cart access in navigation implemented
- dedicated cart route implemented with breadcrumbs, checkout steps, and `noindex` metadata
- mixed standard + `CPO` cart rendering implemented
- quantity editing and line removal exposed in the cart UI
- loading and empty cart states implemented
- cart support card and empty-state copy now fetched from global `Sanity` settings
- cart revalidation and invalid-state handling now wired to live backend truth
- cart coupon logic now stays in sync with blocked / valid line truth
- cart totals and checkout handoff now reflect the accepted revalidation model
- successful cart -> checkout handoff implemented with pending-state handling and back-navigation cleanup
- `Phase 05 - Buyable PDP And Cart` completed

## Blocked / Waiting

- implementation-heavy phases now depend on actual application wiring against the accepted backend model

## Ready Next

1. implement checkout data capture and validation
2. create orders from the accepted cart truth
3. wire payment handoff and recovery behavior
4. add the first browser-level cart -> checkout -> payment coverage in `Playwright`

## Phase Tracker

### Phase 01 - Planning Foundation

- status: completed

### Phase 02 - Flow And Operations Closure

- status: completed

### Phase 03 - Business Data Contract

- status: completed

### Phase 04 - Commerce Foundation

- status: completed

### Phase 05 - Buyable PDP And Cart

- status: completed

### Phase 06 - Checkout And Payments

- status: in progress

### Phase 07 - Customer Panel

- status: planned

### Phase 08 - Admin Operations

- status: planned

### Phase 09 - Policy Flows

- status: planned

### Phase 10 - Launch Readiness

- status: planned

## Update Rules

- update this file whenever the active phase changes
- update this file whenever a major planning loop is opened or closed
- move items between current focus, blocked, and recently completed as work progresses
- keep this file short and practical
- do not duplicate full architecture decisions here; link to the source file instead
