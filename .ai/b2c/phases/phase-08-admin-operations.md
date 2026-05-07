# Phase 08 - Admin Operations

Status: in progress
Owner: planning / implementation
Last updated: 2026-05-07
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

- admin order list - implemented
- admin order detail - implemented
- status update workflow - implemented
- manual shipment metadata entry - implemented
- invoice upload/publication workflow - implemented
- coupon listing and coupon creation workflow - implemented
- coupon detail/edit/deactivate workflow
- return-case handling workflow - implemented for order details
- cancellation handling workflow - implemented for order details

## Current Implementation State

Phase 08 is currently implemented through the `Orders` area and the first `Coupons` workflows.

Completed so far:

- Sanity App SDK admin shell and local development workflow
- secure backend bridge from the App SDK browser app to `apps/web` admin API routes
- order listing with search, filters, page-based pagination, product thumbnails, and multi-item summaries
- single order detail route/workspace at `/orders/[orderNumber]`
- status transitions with operator notes and clearer status-history rendering
- shipment metadata editing with tracking number and optional courier
- invoice upload, replacement, download, and removal
- customer, company, invoice, and delivery data rendering for operational review
- product and product-option visibility for fulfillment decisions
- cancellation and return case handling from the admin order detail page
- coupon listing with search, status/type filters, derived status, and 15-item pagination
- coupon creation with v1 validation, dirty-form discard confirmation, and server-side Supabase persistence
- product-scoped coupon creation with an eligible Sanity/Supabase product picker for standard and `CPO` products
- supporting customer-panel refinements for invoice download, shipment display, and cancellation/return history visibility

Current local architecture note:

- the App SDK client currently calls the local Next.js admin API at `http://localhost:3000`
- this is acceptable for local development
- before deployment, the admin API base URL and allowed origins must be moved to the deployed WebApp/API origin

Next step:

- implement existing coupon detail/edit/deactivate view

## Work Included In This Phase

### 1. Order Operations

- list and search/browse orders at the agreed level
- update current status according to rules

### 2. Shipment And Documents

- add courier and tracking information
- upload invoice PDFs into Supabase Storage and link them to orders

### 3. Promotions And Returns

- create/edit/deactivate coupons
- handle return cases and cancellation requests

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
