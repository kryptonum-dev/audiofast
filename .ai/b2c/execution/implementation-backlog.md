# B2C Implementation Backlog

Status: in progress
Owner: planning / execution
Last updated: 2026-05-07
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

- current active phase: `Phase 08 - Admin Operations`
- current working mode: Sanity App SDK admin implementation
- phase 07 has been closed
- follow-up Step `7.5` browser coverage is queued after the completed customer-panel implementation
- Phase 08 Steps `1-5` are implemented through the order listing and single order details workspace
- the next Phase 08 implementation step is `Step 6 - Coupons Listing`

## Current Focus

- continue `Phase 08 - Admin Operations` with the coupons area
- add follow-up Step `7.5` browser coverage for the customer auth, checkout, payment, and panel roundtrips
- keep launch-readiness documentation aligned with the completed customer-facing flow

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
- `Phase 06 - Checkout And Payments` completed with checkout, order creation, mock payment handling, recovery states, and paid-order profile persistence
- `Phase 07 - Customer Panel` completed with OTP access, protected routes, checkout auth integration, orders list/detail, invoice access, cancellation / return entry points, and `Dane konta`
- `Phase 08` App SDK foundation, secure backend bridge, and order API/UI path implemented through order listing and order details
- admin orders listing now supports search, status/type/operation/date filters, page-based pagination, product images, multi-item summaries, and standard/CPO visibility without a separate CPO area
- admin order details now supports status transitions, shipment metadata, invoice upload/download/removal, customer/company/shipping data visibility, product option visibility, cancellations, returns, and status history
- customer-panel order detail support was tightened for invoice download, shipment courier display, cancellation/return histories, and repeated denied/accepted case visibility

## Blocked / Waiting

- no current planning blocker is recorded for `Phase 08`
- Step `7.5` depends on browser-level coverage being wired against the local auth, checkout, and payment mock runtime

## Ready Next

1. implement `Phase 08` Step `6 - Coupons Listing`
2. implement `Phase 08` Step `7 - Coupon Detail Page`
3. add follow-up Step `7.5` browser coverage for the full B2C customer journey
4. continue `Phase 09 - Policy Flows`
5. complete `Phase 10 - Launch Readiness`

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

- status: completed

### Phase 07 - Customer Panel

- status: completed

### Phase 08 - Admin Operations

- status: in progress

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
