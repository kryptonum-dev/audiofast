# B2C Testing Strategy

Status: draft
Owner: planning
Last updated: 2026-04-28
Depends on: `b2c-implementation-overview.md`, `phases/phase-04-commerce-foundation.md`
Related files: `execution/implementation-backlog.md`, `phases/phase-05-buyable-pdp-and-cart.md`, `phases/phase-06-checkout-and-payments.md`, `phases/phase-07-customer-panel.md`, `phases/phase-08-admin-operations.md`, `phases/phase-09-policy-flows.md`, `phases/phase-10-launch-readiness.md`

## Purpose

This file defines the broad testing strategy for the Audiofast B2C implementation.

It exists so that:

- testing does not need to be re-designed in every phase
- the project has one shared quality strategy for new commerce logic
- each implementation phase can refer back to one root testing direction and then refine only the phase-specific details

## Current Direction

The existing repository has not needed a formal testing layer yet because the current product flows are mostly content, discovery, and inquiry oriented.

The B2C implementation changes that.

Once the project introduces:

- cart
- checkout
- order creation
- payment/webhook logic
- customer access flows
- admin operations
- `CPO` operational availability

the project needs a real testing strategy.

## Primary Goal

The goal is not to add tests everywhere in the repository.

The goal is to add reliable tests around new B2C logic where failure would be costly or operationally dangerous, especially:

- money flow
- order correctness
- status changes
- `CPO` availability behavior
- customer access control
- operator actions

## Recommended Testing Stack

The current preferred stack is:

- `Vitest` for unit and focused integration tests
- `React Testing Library` for component behavior where UI interaction matters
- `Playwright` for end-to-end browser journeys
- `MSW` for controlled mocking of provider and API behavior in tests

This should be the default direction unless implementation constraints later force a change.

## Testing Philosophy

The project should use a hybrid approach rather than strict test-first everywhere.

### 1. Behavior First

The team should define expected behavior before implementation starts.

This means:

- the acceptance path should be clear
- key failure paths should be named
- important business rules should be written in a way that can be tested

### 2. Selective Test-First

Test-first / TDD is recommended for rule-heavy logic such as:

- buyability checks
- cart merge rules
- `standard` vs `cpo` line behavior
- coupon calculation
- checkout validation
- order snapshot creation
- order status transitions
- webhook idempotency
- `CPO` availability transitions
- admin override rules

These areas are deterministic, business-heavy, and easy to regress.

### 3. Test-Alongside For UI And System Wiring

Strict TDD is not required for every UI or integration slice.

For larger UI or system slices, the preferred pattern is:

1. define the expected behavior
2. implement the slice
3. add targeted tests immediately before moving on

This is the default for:

- page composition
- forms
- admin screens
- multi-step customer journeys
- provider integration wiring

### 4. Regression-First For Bugs

When a real bug appears in the B2C flow, the default response should be:

- reproduce it
- add or update the relevant test
- then fix it

## Test Layers

### Unit Tests

Use unit tests for:

- pure rule logic
- state transitions
- data transformation
- snapshot builders
- coupon and totals logic
- `CPO` availability logic

These should become the main safety layer for commerce behavior.

### Integration Tests

Use integration tests for:

- order creation and persistence behavior
- payment confirmation and webhook logic
- OTP issue / verify paths
- interaction between business data and operational state
- `CPO` auto-lock plus admin override behavior

These tests should cover important boundaries without requiring a full browser flow every time.

### End-To-End Tests

Use end-to-end tests only for the most critical user and operator journeys.

Examples:

- standard configurable product -> cart -> checkout -> payment success
- `CPO` product -> cart -> checkout -> lock behavior
- mixed cart -> checkout
- customer OTP access -> order detail
- admin order handling
- admin `CPO` view and manual override

The E2E suite should stay intentionally small and critical-path focused.

## What Not To Prioritize

The project should avoid low-value test expansion such as:

- trying to backfill the whole existing site with tests
- snapshot-heavy tests for mostly presentational components
- broad visual testing before the commerce core is stable
- using coverage percentage as the main success metric
- testing static content pages simply because a framework makes it easy

## Phase-By-Phase Strategy

### Phase 03 - Business Data Contract

Goal for testing in this phase:

- decide the testing direction
- decide the tool stack
- identify the highest-risk behaviors that must be covered later

Expected output:

- shared testing strategy
- early definition of must-test rule domains

This phase is for planning, not for heavy test implementation.

### Phase 04 - Commerce Foundation

Goal for testing in this phase:

- introduce the testing foundation
- establish shared fixtures and helpers
- begin testing core commerce rules at the domain/model layer

Expected testing work:

- initial `Vitest` setup
- initial `React Testing Library` setup
- initial `MSW` setup
- shared factories or fixtures for standard products, `CPO` items, carts, and orders
- first unit tests for the commerce model

### Phase 05 - Buyable PDP And Cart

Goal for testing in this phase:

- protect storefront buyability behavior and cart mechanics

Expected testing work:

- buyability rule tests
- standard vs `CPO` add-to-cart tests
- cart line creation tests
- standard-product reconfiguration tests
- cart invalidation/revalidation tests
- browser-level commerce coverage is intentionally deferred until `Phase 06`, when the real checkout flow exists

### Phase 06 - Checkout And Payments

Goal for testing in this phase:

- make the transaction flow trustworthy

Expected testing work:

- checkout validation tests
- order creation integration tests
- payment initiation tests
- webhook confirmation and idempotency tests
- payment recovery behavior tests
- focused domain and server-action coverage for checkout, order creation, payment initiation, webhook confirmation, idempotency, and recovery behavior
- browser-level checkout / payment journeys are intentionally deferred to follow-up Step `7.5`, after the customer panel exists

This is expected to be the most test-critical implementation phase.

### Phase 07 - Customer Panel

Goal for testing in this phase:

- protect customer access and visibility rules

Expected testing work:

- OTP issue/verify tests
- customer-session tests
- order access control tests
- order list/detail rendering tests for mixed orders
- account-profile editing tests
- browser tests for login, checkout auth roundtrips, and order-detail access in follow-up Step `7.5`

### Phase 08 - Admin Operations

Goal for testing in this phase:

- protect the operator workflows that change order and `CPO` state

Expected testing work:

- admin order status action tests
- invoice/shipment workflow tests
- coupon-management tests
- simple operational analytics tests
- shared standard-product / `CPO` order visibility tests inside the `Orders` workflow
- App SDK admin unit and integration tests for route, API-client, listing, form, analytics, and formatter behavior

Browser E2E is intentionally not required for Phase 08 v1 because the Sanity App SDK app runs inside the Sanity Dashboard authentication/runtime model rather than as a standalone local app.

### Phase 09 - Policy Flows

Goal for testing in this phase:

- verify that policy logic works end to end across customer, admin, and communication behavior

Expected testing work:

- cancellation eligibility tests
- return eligibility tests
- company-invoice restriction tests
- whole-order returnability tests
- `CPO` post-cancellation / post-return availability tests where relevant
- end-to-end checks for the most important policy paths

### Phase 10 - Launch Readiness

Goal for testing in this phase:

- harden the suites that already exist
- confirm that the critical flows are stable enough for launch

Expected testing work:

- run the critical-path suites reliably in CI
- remove or stabilize flaky tests
- confirm that happy paths and key operational recovery paths are covered
- use targeted manual verification only where automation is not yet practical

This phase should not be the place where most testing is invented for the first time.

## Minimum Critical Coverage Before Launch

Before the first B2C launch, the project should have confident automated coverage for at least:

- standard product add-to-cart path
- `CPO` add-to-cart path
- mixed cart validation
- checkout creation of a correct order
- payment confirmation webhook behavior
- customer OTP access to eligible orders
- admin order management basics
- admin `CPO` availability management basics

## Working Rule For Each Phase

Each implementation phase should answer two testing questions before it is considered complete:

1. which new business rules were introduced in this phase?
2. which of those rules now have automated protection?

The default expectation should be:

- unit/integration coverage for new rule-heavy logic in the same phase
- a small number of E2E flows only when the phase creates a critical user or operator journey

## Notes

This file is intentionally broad.

Each phase should still decide its own concrete:

- exact test cases
- fixture shape
- mocking detail
- CI commands
- quality gates

But those details should stay aligned with this root strategy rather than redefining the whole testing approach from scratch.
