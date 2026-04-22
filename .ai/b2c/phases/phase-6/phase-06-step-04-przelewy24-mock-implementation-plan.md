# Phase 06 Step 04 - `Przelewy24` Mock Implementation Plan

Status: draft
Owner: planning
Last updated: 2026-04-21
Depends on: `phase-06-checkout-and-payments.md`, `../architecture/payment-process-model.md`
Related files: `phase-06-checkout-and-payments.md`, `../architecture/payment-process-model.md`, `../architecture/email-flow.md`

## Purpose

This file turns Phase 06 Step 04 into an implementation-ready plan.

It defines:

- the exact goal of the local `Przelewy24` mock step
- the accepted mock strategy for the current repo state
- the recommended implementation order
- the files and responsibilities that should exist when Step 04 is complete
- what is intentionally deferred to Step 05 and later

## Accepted Step 04 Strategy

The current project still does not have live `Przelewy24` credentials.

For this step, the accepted strategy is:

- keep the real provider-shaped application flow
- do not build a real external payment page yet
- do not send the browser to a fake payment-screen detour
- after checkout submit succeeds, run the mocked provider registration and mocked successful confirmation on the server
- redirect the browser to the thank-you route only after the backend confirmation path succeeds

This means the temporary happy path is:

1. checkout submit creates the order in `awaiting_payment`
2. the application starts a provider-shaped payment-registration step
3. the mock `Przelewy24` layer returns registration data
4. the backend immediately simulates successful provider notification + verification
5. the order is moved to `paid`
6. the browser is redirected to `podziekowania-za-zakup/?order=AF-YYYY-NNNNN`

The browser redirect must still not become payment truth.

Even in this simplified mock, the redirect is allowed only after backend confirmation has already updated the order.

## Core Goal

Step 04 is complete only when the checkout flow no longer jumps straight from order creation to thank-you.

Instead, checkout must go through a real application-side payment-start and payment-confirmation sequence that is shaped like `Przelewy24`, but with the unavailable external boundary mocked locally.

## What Step 04 Must Deliver

- a provider integration seam that can later be swapped from mock to live `Przelewy24`
- a payment-start application layer separate from raw checkout submit
- a mock `Przelewy24` registration step
- a real internal payment-confirmation path that marks the order as `paid`
- idempotent payment confirmation behavior
- thank-you redirect only after successful backend confirmation
- focused test coverage for the happy path and duplicate-confirmation safety

## What Step 04 Does Not Need To Deliver

This step should intentionally defer the following to Step 05:

- pending-verification thank-you states
- redirect-before-notification recovery
- notification-before-return recovery
- expired unpaid handling in the thank-you UI
- full `urlReturn` route behavior visible to customers
- full `urlStatus` webhook route behavior exposed for external use
- confirmation email sending

Step 04 should only build the backend shell and the immediate happy path that proves the architecture works.

## Recommended Implementation Order

### 1. Freeze The Step Boundary

Before coding, the team should treat the accepted Step 04 boundary as:

- happy-path mock only
- no external payment screen
- no browser-driven payment truth
- no full Step 05 recovery behavior yet

This avoids mixing Step 04 and Step 05 into one oversized change.

### 1A. Freeze The Mock Scenario Model

Before adding `urlReturn`, `urlStatus`, or thank-you truth handling, the mock layer should lock the exact provider scenarios it intends to support.

The scenario model should explicitly separate:

- provider result shape
- browser return shape
- ordering between browser return and backend status notification
- verification outcome
- expected final internal order state

The accepted browser-test scenario set for the current implementation track is intentionally minimal:

- `success_status_before_return`
  - provider status: `done`
  - browser return: `success`
  - ordering: backend status lands before browser return
  - expected order result: `paid`
- `success_return_before_status`
  - provider status: `done`
  - browser return: `success`
  - ordering: browser return lands before backend status
  - expected order result: `paid`

This scenario model is intentionally smaller than the broader provider vocabulary.

Reason:

- it exercises the two event-order cases that actually matter in frontend/browser testing
- it avoids expanding the mock into many near-duplicate unpaid states
- it keeps Step 04 aligned with the v1 minimalist order/payment model

### 1B. Freeze The Thank-You State Model

Before implementing the real `urlReturn` and thank-you runtime, the customer-facing state model should be locked explicitly.

Important distinction:

- these are **not** new order statuses
- these are **not** provider statuses
- these are the customer-facing states the thank-you route may render after combining:
  - current order truth
  - return signal shape
  - payment-window validity

The accepted thank-you state set is intentionally minimalist:

- `awaiting_payment`
  - the order is still `awaiting_payment`
  - the payment window is still active
  - this single view absorbs:
    - return-before-confirmation
    - pending/submitted/scheduled provider outcomes
    - failure-looking return
    - cancelled-looking return
  - the page may refresh/poll and should offer a support contact path
- `paid`
  - payment truth is already confirmed
  - the order is already `paid`
- `expired`
  - the order is still unpaid
  - `payable_until` has passed
  - the original payment attempt is no longer active
- `invalid_access`
  - the route cannot safely resolve which order/status to show

Scenario-to-state expectations should be frozen as well:

- `success_status_before_return` -> `paid`
- `success_return_before_status` -> `paid`

This keeps the next route-level implementation constrained:

- provider statuses remain provider-side
- order statuses remain order-side
- thank-you states remain presentation/runtime-side
- v1 customer UX stays aligned with the minimal business-facing payment model

### 2. Add The Payment Application Layer

Create a dedicated application-layer entry point for payment start.

Responsibilities:

- accept the `paymentRegistrationInput` produced by checkout submit
- call the provider adapter
- trigger the mock confirmation sequence
- return the final redirect target for the browser

This layer should be distinct from:

- checkout validation
- order creation
- low-level provider mocks
- low-level order persistence updates

Preferred outcome:

- checkout submit remains responsible for order creation
- payment start becomes the next explicit server-side step

### 3. Add The Order Payment-Update Core

Create a single internal service responsible for successful payment confirmation.

Responsibilities:

- load the target order
- confirm it is eligible for payment finalization
- update:
  - `current_status` from `awaiting_payment` to `paid`
  - `payment_reference`
  - `payment_verified_at`
  - `paid_at`
- append the paid transition to `status_history`
- behave idempotently if the same success arrives more than once

This service is the most important Step 04 seam because:

- the mock provider should use it now
- the real webhook flow should reuse it later

### 4. Introduce The Provider Adapter Boundary

Add a provider-facing abstraction for `Przelewy24`.

The interface should support at minimum:

- register transaction
- verify transaction

The mock implementation should return provider-shaped data such as:

- transaction token
- redirect target metadata
- provider reference

This boundary should be small and replaceable.

Step 04 should not spread provider-specific behavior across checkout UI or route code.

### 5. Implement The Local Mock `Przelewy24` Flow

Build the mock provider behavior around the accepted happy path.

The mock flow should:

- accept the existing `P24TransactionRegistrationInput`
- return a `P24TransactionRegistrationResult`
- generate deterministic fake token / provider reference values
- build a provider-shaped successful notification payload
- run the server-side verification step
- pass the verified result into the internal payment-confirmation service

Important rule:

- do not skip directly from order creation to thank-you
- do not mark the order as paid in the client
- do not treat the redirect as proof of payment

### 6. Wire Checkout To Payment Start

Replace the current mock thank-you redirect in the checkout client.

Current behavior:

- submit checkout
- get success from order creation
- redirect directly to thank-you

Required Step 04 behavior:

- submit checkout
- get order + payment registration data
- start payment through the new server-side payment-start flow
- receive the final redirect target from the server
- redirect to thank-you only after payment confirmation already succeeded

This keeps the browser thin and keeps payment truth on the backend.

### 7. Keep The Thank-You Route Temporary

During Step 04, the thank-you route may stay simple.

For now it only needs to support:

- the already-confirmed happy path
- order number display
- basic post-purchase success messaging

Do not expand it yet into:

- pending verification
- invalid access
- expired unpaid
- recovery states

Those belong to Step 05.

### 8. Add Focused Test Coverage

Step 04 should add tests for:

- payment registration happy path
- mock confirmation happy path
- order update from `awaiting_payment` to `paid`
- `payment_reference` persistence
- `payment_verified_at` and `paid_at` persistence
- idempotent repeated success handling
- checkout client redirect happening only after server-side payment success

Preferred scope:

- unit tests for provider mock + confirmation service
- integration-style tests for checkout-submit -> payment-start -> redirect

## Suggested File Responsibilities

The exact file names may still shift, but the responsibility split should look like this:

### Checkout / action layer

- existing checkout submit action continues to create the order and return `paymentRegistrationInput`
- new payment-start action accepts provider-shaped input and returns the final redirect target

### Server payment orchestration

- payment-start orchestration file
- payment-confirmation orchestration file
- order-payment update helper

### Provider boundary

- `Przelewy24` interface / contracts usage layer
- local mock implementation of register + verify behavior

### Tests

- payment-start tests
- payment-confirmation tests
- idempotency tests
- checkout client redirect tests

## Expected Data Flow

The Step 04 happy path should work in this order:

1. browser submits checkout form
2. checkout server validates input and cart
3. checkout server creates order in `awaiting_payment`
4. checkout server returns `paymentRegistrationInput`
5. payment-start server flow calls mock `Przelewy24` registration
6. mock registration returns token + provider reference
7. mock flow produces provider-shaped successful notification data
8. backend verification step accepts the mock notification
9. backend confirmation service updates the order to `paid`
10. payment-start flow returns the thank-you redirect target
11. browser redirects to the thank-you route

## Non-Negotiable Rules

The implementation must preserve the following rules from the architecture:

- the order is created before payment handoff
- the order starts in `awaiting_payment`
- the webhook-style backend confirmation remains the source of truth
- the browser redirect is never the source of truth
- duplicate success confirmations must be safe no-ops
- no confirmation email should be sent in Step 04

## Practical Simplifications Allowed In Step 04

To keep this step small and deliverable, the following simplifications are allowed:

- no real external payment page
- no real external redirect detour
- immediate mock success only
- no failed / cancelled provider branches yet
- no customer-visible pending state yet
- no exposed public webhook route yet, if the same internal confirmation path is already exercised through the mock service

These simplifications are acceptable only because the internal confirmation architecture is still real.

## Completion Criteria

Step 04 should be considered complete when:

- checkout no longer redirects straight to thank-you after raw order creation
- the app executes a provider-shaped payment-start flow
- the local mock returns provider-shaped registration data
- a real backend confirmation path marks the order as `paid`
- `payment_reference`, `payment_verified_at`, and `paid_at` are stored correctly
- repeated confirmation is idempotent
- the browser reaches thank-you only after server-side confirmation
- tests cover the happy path and duplicate-confirmation safety

## Follow-Up Boundary

After Step 04 is complete, Step 05 should take over:

- real `urlReturn` and `urlStatus` route behavior
- pending verification states
- thank-you route truth handling
- recovery across out-of-order redirect / notification timing
- expiration behavior
- confirmation email on real confirmed success

If Step 04 is implemented correctly, Step 05 should extend the same confirmation core rather than replacing it.
