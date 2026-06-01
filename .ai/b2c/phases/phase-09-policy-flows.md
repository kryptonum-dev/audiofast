# Phase 09 - Policy Flows

Status: planned
Owner: planning
Last updated: 2026-04-07
Depends on: `phase-08-admin-operations.md`
Related files: `../business/returns-and-cancellations-rules.md`, `../architecture/order-lifecycle.md`, `../architecture/email-flow.md`, `../testing-strategy.md`

## Objective

Ensure that the agreed cancellation, return, and company-invoice rules work end to end across customer, admin, and email flows.

## Why This Phase Exists

The policy rules already exist conceptually, but they need to work as a coherent operational system rather than as isolated decisions.

This phase validates and completes that rule translation.

## Inputs

- customer-panel implementation
- admin-operations implementation
- returns/cancellations rules
- email-flow rules
- `../testing-strategy.md`

## Main Deliverables

- working cancellation flow
- working return-request flow
- working company-invoice restrictions
- clear alignment between status changes, return cases, and customer communication

## Work Included In This Phase

### 1. Cancellation Flow

- customer-initiated cancellation behavior
- admin cancellation behavior
- resulting customer communication

### 2. Return Flow

- customer request creation
- admin handling
- completed return behavior
- closed-without-return behavior at the agreed level

### 3. Company Invoice Restrictions

- enforce any no-return restrictions tied to company-invoice orders

## Not In Scope For This Phase

- partial returns
- automated refunds
- advanced legal workflow tooling

## Done Criteria

Phase 09 can be considered complete when:

- the agreed policy rules are reflected correctly in customer and admin behavior
- status logic, return-case logic, and email communication no longer conflict
