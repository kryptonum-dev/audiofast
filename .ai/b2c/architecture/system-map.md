# System Map

Status: in progress
Owner: planning
Last updated: 2026-04-09
Depends on: `data-ownership.md`
Related files: `commerce-data-model.md`, `../business/excel-contract.md`, `customer-auth-and-access.md`, `payment-process-model.md`, `cpo-and-b2c-relation.md`, `commerce-table-model.md`

## Purpose

This file explains the B2C system at a high level by showing how the main systems relate to each other.

## Current High-Level Map

### Business Input Layer

- Excel provides selected standard-product B2C flags
- Excel also provides the business-managed `CPO` feed
- Excel sync updates runtime data in `Sanity` and, where relevant, `Supabase`

### Content / Internal Operations Layer

- `Sanity` remains the editorial product/CPO system
- `Sanity` stores runtime standard-product B2C flags after sync
- `Sanity` stores runtime `CPO` business fields after sync
- `Sanity` also stores live `CPO` operational availability in v1
- `Sanity App SDK` is the preferred admin surface for B2C operations

### Operational Data Layer

- `Supabase` stores extended standard-product pricing/configuration data
- `Supabase` stores commerce-operational order data
- one shared orders model should cover both standard and `CPO` purchases
- `Supabase Auth` stores verified customer identity and session state
- `Supabase Storage` stores private invoice PDFs

### Application Layer

- `Next.js` storefront handles PDP, cart, checkout, and customer access
- `Next.js` reads runtime data from `Sanity` and `Supabase`, never from Excel directly
- `Next.js` backend / application logic updates `Sanity` `CPO` availability when order/payment events require it
- `Next.js` backend / application logic also handles transactional email sending

### External Service Layer

- `Przelewy24` for payments
- Microsoft Graph-based email infrastructure for OTP and transactional emails

## Current End-To-End Story

At a high level:

1. Business-owned B2C inputs are edited in Excel.
2. Office Script sync writes standard-product B2C fields into `Sanity`, `CPO` business fields into `Sanity`, and extended standard-product pricing into `Supabase`.
3. The customer either configures a standard product or selects a fixed `CPO` specimen on the product page.
4. `Next.js` checks standard-product buyability from runtime `Sanity` flags plus valid pricing data.
5. `Next.js` checks `CPO` buyability from runtime `Sanity` state, including archive status, `Sprzedaż Online`, valid price, and `availabilityStatus`.
6. The selected item goes into the cart under one shared commerce model.
7. Checkout creates an order and starts payment.
8. If the order contains a unique `CPO` item, the system may automatically move that specimen from `available` to `on_hold` in `Sanity`.
9. `Przelewy24` redirect returns to the site, but webhook confirmation remains the source of truth.
10. Webhook truth updates the order from `awaiting_payment` to `paid` when payment is confirmed.
11. Payment confirmation may also move the `CPO` item from `on_hold` to `sold_out` in `Sanity`.
12. If payment is not confirmed within the short active window, the order expires for payment purposes and the `CPO` item may return to `available`, while archived items still remain non-buyable.
13. Next.js backend logic sends transactional emails through Microsoft Graph when lifecycle events require it.
14. The customer later accesses their order through Supabase-Auth-backed email OTP.
15. The operator manages the order through the internal admin panel and may manually override `CPO` operational availability when needed.

## Agreed Runtime Principles

- Excel is upstream business input, not runtime truth
- `Sanity` is the storefront source for standard-product B2C flags and `CPO` state
- `Supabase` is the structured source for pricing extensions and orders
- `Supabase Auth` is the verified identity/session layer
- `Supabase Storage` is the invoice file store
- archive state and availability state stay separate for `CPO`
- archiving blocks new purchases but does not block completion of an already-created valid awaiting-payment order

## Open Questions To Carry Forward

- exact admin/frontend query patterns over the accepted backend model
- exact Supabase Storage path convention and file-access strategy for invoice downloads
- exact failure-path handling at the implementation level

## Notes

This file should later become the most concise "architecture at a glance" reference for the whole B2C project.
