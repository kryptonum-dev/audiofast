# Phase 08 - Admin Operations

Status: planned
Owner: planning
Last updated: 2026-04-09
Depends on: `phase-07-customer-panel.md`
Related files: `../architecture/admin-panel-sanity.md`, `../architecture/invoice-and-documents.md`, `../business/coupon-rules.md`, `../testing-strategy.md`, `../architecture/commerce-table-model.md`

## Objective

Implement the operator-facing B2C management surface in `Sanity App SDK`.

## Why This Phase Exists

The storefront and customer panel depend on a practical internal operating model.

This phase gives Audiofast the internal tools needed to manage orders, documents, coupons, and returns in daily operations.

## Inputs

- resolved admin-panel architecture
- finalized commerce foundation
- invoice/document direction
- coupon rules
- return/cancellation rules
- `../testing-strategy.md`

## Main Deliverables

- admin order list
- admin order detail
- status update workflow
- manual shipment metadata entry
- invoice upload/publication workflow
- coupon management workflow
- return-case handling workflow

## Work Included In This Phase

### 1. Order Operations

- list and search/browse orders at the agreed level
- update current status according to rules

### 2. Shipment And Documents

- add courier and tracking information
- upload invoice PDFs into Supabase Storage and link them to orders

### 3. Promotions And Returns

- create/edit/deactivate coupons
- handle return cases and manual return creation

## Follow-Up Step 8.5 - Commerce Analytics

After the admin operations surface is complete, the next late implementation step should add the final commerce analytics instrumentation for the v1 funnel.

This is intentionally deferred until after the customer-facing checkout, customer panel, and admin operating model are all stable.

That step should cover:

- final event map for the implemented funnel
- storefront and checkout/payment instrumentation
- thank-you / order-confirmation events where relevant
- verification that emitted analytics match the real production journey rather than an intermediate build state

## Not In Scope For This Phase

- multi-role permissions beyond the agreed v1 simplification
- advanced warehouse/shipment integrations
- advanced refund automation

## Done Criteria

Phase 08 can be considered complete when:

- operators can manage orders end to end in the agreed v1 admin surface
- invoice and shipment flows are operational
- coupon and return-case handling are usable in daily operations
