# Phase 06 - Checkout And Payments

Status: planned
Owner: planning
Last updated: 2026-04-09
Depends on: `phase-05-buyable-pdp-and-cart.md`
Related files: `../architecture/customer-auth-and-access.md`, `../architecture/payment-process-model.md`, `../architecture/email-flow.md`, `../testing-strategy.md`, `../architecture/commerce-table-model.md`

## Objective

Implement the checkout flow, order creation, and payment handling needed to complete a B2C purchase end to end.

## Why This Phase Exists

This phase turns the cart into a real transaction flow.

It is where customer data capture, order persistence, payment initiation, provider confirmation, and immediate post-purchase access become real system behavior.

## Inputs

- resolved cart and checkout model
- resolved payment-process thread
- finalized commerce foundation
- email-flow rules
- `../testing-strategy.md`

## Main Deliverables

- checkout data capture
- order creation in `awaiting_payment`
- `Przelewy24` handoff and return handling
- webhook-based payment confirmation
- thank-you-page temporary access for guests
- confirmation-email trigger on real payment success

## Work Included In This Phase

### 1. Checkout Flow

- guest-first checkout
- logged-in prefill behavior
- company invoice branch
- reusable customer-data save behavior

### 2. Order Creation And Payment Handoff

- create order before provider handoff
- preserve order snapshot and pricing requirements

### 3. Payment Confirmation And Recovery

- webhook truth handling
- redirect recovery behavior
- `15-minute` expiration behavior at the agreed level
- no long-lived retry-on-same-order flow in v1

## Not In Scope For This Phase

- customer-panel list/detail implementation
- admin order-management UI
- advanced shipping or stock logic

## Done Criteria

Phase 06 can be considered complete when:

- checkout can create a valid order
- payment can be completed end to end through `Przelewy24`
- the system behaves correctly even when redirect recovery is needed
