# Phase 08 - App SDK Admin Strategy

Status: in progress
Owner: planning / implementation
Last updated: 2026-05-07
Depends on: `../phase-08-admin-operations.md`
Related files: `../phase-08-admin-operations.md`, `../../architecture/admin-panel-sanity.md`, `../../architecture/commerce-table-model.md`, `../../architecture/invoice-and-documents.md`, `../../business/coupon-rules.md`, `../../business/returns-and-cancellations-rules.md`

## Purpose

This file records the broad strategy for the Phase 08 B2C admin panel.

Phase 08 turns the completed customer-facing B2C shop foundation into an operator-usable system. The storefront, cart, checkout, payment handling, customer panel, order access, invoice access hooks, coupons, and cancellation / return entry points now create real operational work for Audiofast.

The admin panel should give operators a practical way to handle that work without turning v1 into a full ecommerce back office.

The goal is a lightweight operations console for:

- browsing and handling orders
- managing basic order operations
- managing coupons
- seeing very simple commerce visibility

It should stay focused on daily B2C operations rather than replacing Sanity Studio, Excel, accounting tools, warehouse tools, or future analytics systems.

## Architecture Direction

The Phase 08 admin panel should be built as a `Sanity App SDK` app rather than as a normal Sanity Studio tool, document view, or custom desk panel.

This direction keeps the responsibilities clear:

- `Sanity App SDK` provides the operator-facing B2C admin application surface
- Sanity Studio remains focused on content, editorial, product, and existing CPO content workflows
- Excel remains the source of truth for the existing product-level business inputs it already owns
- Supabase remains the operational commerce database for orders, order items, customer profiles, coupons, return cases, and related B2C state
- Audiofast backend APIs provide the secure bridge between the App SDK browser app and privileged Supabase operations

The App SDK application should be treated as a browser client. It must not contain Supabase service-role credentials or perform privileged Supabase mutations directly.

Instead, the intended shape is:

1. an operator uses the Sanity App SDK admin app
2. the app calls Audiofast backend admin APIs
3. the backend verifies the operator is allowed to perform the requested admin action
4. the backend uses Supabase service-role access server-side when privileged reads or writes are required
5. the backend returns narrow data needed by the admin UI

This keeps the admin app flexible while preserving a strong security boundary.

## V1 Admin Areas

The v1 admin navigation should contain three areas.

### 1. Orders

`Orders` is the main operational area.

It should cover both standard-product orders and `CPO` orders in one shared order workflow. There should not be a separate top-level `CPO` admin area in v1.

The broad responsibility of `Orders` is:

- order list scanning and navigation
- order detail review
- status management
- shipment metadata entry
- invoice upload / publication workflow
- cancellation and return handling where relevant
- clear visibility when an order contains a `CPO` item

`CPO` content and broader CPO source management already exist in Sanity and Excel. Phase 08 should only surface CPO context where it matters for operating an order.

### 2. Coupons

`Coupons` should be a simple standalone operational area.

The broad responsibility of `Coupons` is:

- create coupons
- edit coupons
- deactivate coupons
- review basic coupon configuration and operational state

This area should support the v1 coupon model without becoming a full promotion engine.

### 3. Analytics

`Analytics` should be very small in v1.

Its broad responsibility is simple commerce visibility, such as:

- revenue over a selected period
- order count over a selected period
- simple high-level operational totals if they are cheap to provide

It should not become a full reporting system in Phase 08.

## Broad Build Steps

### Step 1 - App SDK Foundation

Establish the Sanity App SDK application shape, deployment model, environment model, and local development workflow.

The goal of this step is only to prove that the admin app can exist as a separate operator surface.

Status: implemented.

### Step 2 - Secure Backend Bridge

Prove that the App SDK app can call Audiofast backend admin APIs and that the backend can verify the current operator before using privileged Supabase access.

This is the most important architectural foundation for the whole admin panel.

Status: implemented for the current local development setup. The App SDK calls the `apps/web` admin API through `http://localhost:3000`; this must be switched to the deployed WebApp/API origin before deployment.

### Step 3 - Overall Backend Implementation

Define and implement the full backend API surface that the Sanity App SDK admin app will call.

This should be a large backend-focused step. It should identify the admin calls needed for orders, order details, order mutations, coupons, and simple analytics, then expose them through Audiofast backend APIs behind the secure admin boundary proven in Step 2.

The goal is for later UI steps to call already-defined backend routes rather than inventing API behavior screen by screen.

Status: implemented for the order operations surface and supporting mutation flows used by the order listing/detail UI. Coupon backend routes exist as part of the planned API surface and should be consumed by the next coupon UI steps.

### Step 4 - Orders Listing

Build the `Orders` listing experience.

The list should let operators scan, browse, and find orders across both standard-product and `CPO` purchases in one workflow.

Status: implemented.

Implemented scope:

- orders tab and listing shell
- search by order/customer/e-mail
- status, type, operation, and date filters
- date picker that prevents future dates
- page-based pagination
- loading state sized to avoid layout jumps
- product thumbnails
- lead product plus additional-item summaries
- `Katalogowe`/`CPO`/mixed type visibility
- Sanity light/dark theme alignment
- full-height App SDK shell and loading state

### Step 5 - Single Order Details Page

Build the single order detail page as the main operational workspace for one order.

This page should cover order review and the broad operational actions such as status updates, shipment metadata, invoice handling, cancellation handling, return handling, and relevant `CPO` context.

Status: implemented.

Implemented scope:

- normal route shape at `/orders/[orderNumber]`
- order summary header with status and totals
- status transition workflow with optional operator note
- status history with structured actor/source/note/date rendering
- customer, company, invoice, and delivery data rendering
- product list with images, totals, and prominent product options
- shipment tracking number and optional courier editing
- invoice add/change/download/remove flow with confirmation modal
- cancellation requests with accept/reject flows and repeated request history
- return cases with customer reason, admin completion flow, and closed-case history
- return-window enforcement for admin return status transitions
- hiding shipment/invoice sections for awaiting-payment orders
- no separate top-level `CPO` area; CPO context stays inside the shared order workflow

### Step 6 - Coupons Listing

Build the `Coupons` listing experience.

The list should let operators review existing coupons, understand their basic operational state, and navigate to individual coupon details.

Status: implemented for the current v1 listing surface.

Implemented scope:

- coupons tab and `/coupons` route in the App SDK admin shell
- code search, status filter, and discount type filter
- 15-item pagination matching the orders listing density
- derived status display for active, inactive, scheduled, expired, and usage-limit-reached coupons
- coupon amount/percent, product-scope summary, usage, active window, and created date columns
- "New coupon" entry point into the create flow

### Step 7 - Coupon Detail Page

Build the coupon create/detail page.

This page should support the v1 coupon operations: create, edit, deactivate, and review one coupon without becoming a full promotion engine.

Status: create view implemented; existing coupon detail/edit/deactivate remains next.

Implemented create scope:

- `/coupons/new` route and "back to coupons" navigation
- coupon code, discount type, fixed amount/percent value, usage limit, optional active-from and expiry dates, and active flag
- date constraints that block selecting dates before the current day and require start before expiry
- dirty-form confirmation modal before discarding a partially filled coupon
- product-scoped coupon picker for `fixed_product` and `percent_product` coupons
- picker loads eligible published Sanity standard products and viable internal `CPO` products through the admin API
- standard product selections save all matching Supabase pricing `price_key` values so coupon matching works against cart `line.productKey`
- product thumbnails and hosted Sanity Studio edit-intent links for normal and `CPO` products

### Step 8 - Simple Analytics

Add very simple analytics after the core operational workflows exist.

This should stay intentionally small and should not block order operations.

Status: implemented for the current v1 operational analytics surface.

Implemented scope:

- analytics tab and `/analytics` route in the App SDK admin shell
- date range filter shared with the order listing/admin filter pattern
- day, week, and month revenue grouping
- KPI cards for revenue, order count, average order value, and discounts
- full-width interactive revenue chart using `recharts`
- zero-filled day/week/month buckets so no-sale periods render on the baseline instead of disappearing
- hover tooltip with gross volume, digital sales count, order count, and discount total for the selected bucket
- week and month labels rendered as concrete date ranges
- stale-response-safe chart rendering so changing grouping does not briefly render old series data with the new grouping

### Step 9 - Readiness Check

Add focused tests and operational readiness checks for the admin app.

This should verify the critical admin flows, the backend security boundary, and the most important order / coupon operations.

Status: not started as a dedicated step. Focused typechecks and targeted unit tests were run during the order listing/detail implementation.

## Security Principles

The admin app must follow these principles:

- the browser app is never the authority
- Supabase service-role credentials stay server-side only
- every admin API verifies operator access
- every mutation validates that the requested business transition is allowed
- operational mutations should leave an audit or status-history trail where applicable
- API responses should return only the data needed by the admin UI
- production secrets must not be exposed through App SDK browser environment variables

## Out Of Scope For This Strategy File

This strategy file intentionally does not define:

- a separate top-level `CPO` admin area
- component-level UI details
- exact API routes or payload schemas
- exact Supabase query implementation
- a full role / permission matrix
- advanced fulfillment integrations
- automated refund handling
- warehouse integrations
- a full analytics or reporting system

Those details should be planned in later Phase 08 implementation notes after this broad direction is accepted.

## Done Criteria

This strategy is useful when it gives the Phase 08 implementation a clear direction:

- use `Sanity App SDK`, not a normal Studio tool
- keep the admin app lightweight for v1
- use three admin areas: `Orders`, `Coupons`, and simple `Analytics`
- handle standard-product and `CPO` orders together in `Orders`
- protect privileged Supabase access behind Audiofast backend APIs
- defer detailed implementation decisions to later Phase 08 planning files
