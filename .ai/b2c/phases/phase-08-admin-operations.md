# Phase 08 - Admin Operations

Status: completed
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
- coupon detail/edit/deactivate workflow - implemented
- return-case handling workflow - implemented for order details
- cancellation handling workflow - implemented for order details

## Current Implementation State

Phase 08 is complete for the v1 B2C admin scope.

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
- coupon detail/edit workflow with existing coupon loading, v1 validation, dirty-form discard confirmation, and product-scope editing
- coupon deactivation/archive workflow through the coupon detail page and admin coupon API
- simple operational analytics with KPI cards, date range filtering, day/week/month grouping, zero-filled chart buckets, and revenue/status visibility
- focused admin backend tests for order DTOs, status transitions, shipment metadata, invoice metadata, cancellation/return handling, coupon validation/archive behavior, pagination/date parsing, and analytics counting rules
- focused App SDK admin tests for routing, API client URL/envelope handling, listings, coupon form behavior, analytics UI, date range picker, and formatters
- supporting customer-panel refinements for invoice download, shipment display, and cancellation/return history visibility

Current architecture note:

- the App SDK client calls the deployed WebApp/API origin through `https://audiofast-git-b2c-kryptonum.vercel.app/`
- local development can still point at local APIs by changing the client configuration when needed
- privileged Supabase work remains server-side in `apps/web` admin API routes

Readiness note:

- browser E2E for the App SDK admin panel is intentionally not part of Phase 08 completion because App SDK apps run inside the Sanity Dashboard authentication/runtime model rather than as standalone local pages
- Phase 08 readiness is covered by focused unit/integration tests, type checks, and the App SDK build

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

Status: complete for v1.
