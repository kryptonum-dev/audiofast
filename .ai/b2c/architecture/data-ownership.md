# Data Ownership

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: `../business/excel-contract.md`
Related files: `commerce-data-model.md`, `system-map.md`, `cpo-and-b2c-relation.md`

## Purpose

This file defines which system owns which category of data in the B2C architecture.

## Current High-Level Ownership Model

### Excel

Business source of truth for selected product-level operational flags.

Currently expected to own:

- standard-product online sellability
- standard-product returnability
- business-managed `CPO` inputs such as specimen key, name, price, and source-row presence
- possibly future logistics-related fields such as dimensions and weight

### Sanity

Editorial and operator-facing internal surface.

Currently expected to own:

- public `CPO` content documents and their editorial shape
- internal B2C admin UI
- coupon management UI
- invoice attachment workflows
- operator-facing order workflows where appropriate

### Supabase

Operational B2C data store.

Currently expected to own:

- orders
- order items
- `CPO` operational availability state
- `CPO` item-to-order linkage when a unique specimen participates in checkout
- coupon state / usage
- customer OTP-related state
- shipment metadata
- invoice metadata
- status history

### Next.js Application Layer

Storefront and secure execution layer.

Currently expected to handle:

- buyability enforcement in UI
- cart logic
- checkout logic
- mixed standard + `CPO` line validation
- payment initiation / verification
- customer OTP flow
- customer panel access
- secure file / order access checks

## Open Questions

- which exact data points should remain duplicated vs derived?
- what data is snapshotted into orders at purchase time?
- how is sync conflict handled if Excel changes after an order is placed?
- which `CPO` fields remain editable in Sanity after a specimen is already part of an order history?
- what exact admin actions may override `CPO` operational availability without writing back to Excel?

## Proposed Future Sections

### 1. Ownership By Domain

- products
- `CPO` specimens
- pricing
- orders
- coupons
- documents

### 2. Derived vs Source Data

- what is computed
- what is authoritative

### 3. Update Paths

- who can change what
- through which system

## Notes

This is one of the most important architecture files because it prevents accidental duplication of authority across systems.
