# System Map

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: `data-ownership.md`
Related files: `commerce-data-model.md`, `../business/excel-contract.md`, `customer-auth-and-access.md`, `payment-process-model.md`, `cpo-and-b2c-relation.md`

## Purpose

This file explains the B2C system at a high level by showing how the main systems relate to each other.

## Current High-Level Map

### Business Input Layer

- Excel controls selected standard-product B2C flags
- Excel also provides the business-managed `CPO` offering input

### Content / Internal Operations Layer

- Sanity remains the editorial system
- Sanity App SDK is the preferred admin surface for B2C operations
- the admin surface should include both order-centric and `CPO` specimen-centric operational views

### Operational Data Layer

- Supabase stores commerce-operational data
- Supabase should also hold the lightweight operational availability state for unique `CPO` items

### Application Layer

- Next.js storefront handles PDP, cart, checkout, and customer access
- Next.js backend / application logic should also handle transactional email sending

### External Service Layer

- `Przelewy24` for payments
- Microsoft Graph-based email infrastructure for OTP and transactional emails

## Current End-To-End Story

At a high level:

1. Product business flags originate in Excel.
2. The application layer uses synchronized product eligibility and pricing data for both standard products and `CPO` products.
3. The customer either configures a standard product or selects a fixed `CPO` specimen on the product page.
4. The selected item goes into the cart under one shared commerce model.
5. Checkout creates an order and starts payment.
6. If the order contains a unique `CPO` item, the commerce layer may automatically move that item into an unavailable state such as `locked_by_order`.
7. `Przelewy24` redirect returns to the site, but webhook confirmation remains the source of truth.
8. Webhook truth updates the order from `awaiting_payment` to `paid` when payment is confirmed.
9. Minimal internal payment-attempt tracking supports retry, reconciliation, and duplicate protection.
10. Next.js backend logic sends transactional emails through Microsoft Graph when lifecycle events require it.
11. The customer later accesses their order through email OTP.
12. The operator manages the order through the internal admin panel and may manually override `CPO` operational availability when needed.

## Open Questions

- how exactly Excel data flows into runtime application state
- how documents are stored and exposed securely
- how the final `CPO` business feed and `CPO` operational availability layer are synchronized without conflicting

## Proposed Future Sections

### 1. Diagram In Words

### 2. System Responsibilities

### 3. Data Flows

### 4. User Flows

### 5. Failure Paths

## Notes

This file should later become the most concise "architecture at a glance" reference for the whole B2C project.
