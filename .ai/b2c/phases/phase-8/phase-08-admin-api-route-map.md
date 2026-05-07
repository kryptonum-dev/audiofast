# Phase 08 - Admin API Route Map

Status: planning
Owner: planning
Last updated: 2026-05-06
Depends on: `phase-08-app-sdk-admin-strategy.md`, `../phase-08-admin-operations.md`
Related files: `phase-08-app-sdk-admin-strategy.md`, `../phase-08-admin-operations.md`, `../../architecture/admin-panel-sanity.md`, `../../architecture/commerce-table-model.md`, `../../architecture/invoice-and-documents.md`, `../../architecture/order-lifecycle.md`, `../../architecture/email-flow.md`, `../../business/coupon-rules.md`, `../../business/returns-and-cancellations-rules.md`

## Purpose

This file defines the Phase 08 Step 3 backend API route map for the `Sanity App SDK` B2C admin panel.

Step 3 is the backend-first step. Its job is to define the full set of stable Audiofast admin API contracts before the App SDK UI is built screen by screen.

The later UI steps should be able to call this route surface for:

- order listing
- order detail
- order status operations
- shipment metadata
- invoice upload and access
- cancellation handling
- return-case handling
- coupon management
- simple purchase/order analytics

This file is not an implementation file. It should be used as the planning source for the route handlers that will be implemented under the Next.js app.

## Base Route Decision

The final Phase 08 admin APIs should live under:

- `/api/admin/...`

They should not be nested under `/api/admin/b2c/...` unless a future non-B2C admin domain makes that separation necessary.

Reasoning:

- Phase 08 is currently the only App SDK-backed internal admin surface.
- The route names already describe the resource: `orders`, `coupons`, `analytics`.
- Extra nesting makes the API harder to read without adding a useful boundary.

The current route:

- `/api/admin/b2c/me`

should be treated as the Step 2 bridge diagnostic route. It proves that the App SDK browser app can call the Next.js backend with a Sanity bearer token and that the backend can verify the operator. It does not need to dictate the final Phase 08 route taxonomy.

During implementation, the final admin app may either:

- add `/api/admin/me` as an optional bootstrap route for user/profile/access display, or
- skip a dedicated bootstrap route and let the first real data route, usually `/api/admin/orders`, perform the first admin verification.

This route is not a security gateway. Every real admin API still verifies the Sanity bearer token itself through the shared admin auth helper.

## Global Route Rules

Every route in this file must follow the Step 2 security boundary:

1. The App SDK browser app sends the current Sanity auth token as `Authorization: Bearer <token>`.
2. The Next.js route verifies the Sanity operator.
3. The route checks the v1 admin allowlist / permitted access model.
4. The route performs any privileged Supabase work server-side through the service-role client.
5. The route returns only the narrow data needed by the admin UI.

Implementation should extract shared helpers before adding the full surface:

- `verifyAdminRequest(request)`
- `getAdminCorsHeaders(request)`
- `adminJson(request, body, status)`
- `parseAdminPagination(searchParams)`
- `parseAdminDateRange(searchParams)`

`OPTIONS` should be supported consistently for all browser-called routes. The allowed CORS methods must include all methods used below, not just `GET`.

The App SDK admin panel is a browser client. It must never receive Supabase service-role credentials or other server-only secrets.

## Recommended Code Layout

The route handlers should stay thin and live under:

- `apps/web/src/app/api/admin/...`

Shared admin backend helpers should live outside the route tree under the B2C domain layer:

- `apps/web/src/global/b2c/admin/server/auth.ts`
- `apps/web/src/global/b2c/admin/server/http.ts`
- `apps/web/src/global/b2c/admin/server/pagination.ts`
- `apps/web/src/global/b2c/admin/server/date-range.ts`

This keeps the App Router files focused on HTTP wiring while the reusable admin behavior stays in normal server-side domain modules.

### `auth.ts`

Responsibilities:

- parse `Authorization: Bearer <token>`
- verify the Sanity user from the token
- verify Audiofast project membership
- apply the v1 allowlist / development fallback
- return a typed verified admin operator

Primary export:

- `verifyAdminRequest(request)`

This helper should contain the reusable version of the auth logic currently proven in `/api/admin/b2c/me`.

### `http.ts`

Responsibilities:

- build CORS headers
- handle `OPTIONS`
- return consistent JSON envelopes
- map common admin errors to HTTP statuses

Primary exports:

- `getAdminCorsHeaders(request)`
- `adminJson(request, body, status)`
- `adminErrorJson(request, error, status)`
- `adminOptions(request)`

### `pagination.ts`

Responsibilities:

- parse and validate cursor pagination input
- clamp page size
- expose a small shared pagination result shape

Primary export:

- `parseAdminPagination(searchParams)`

### `date-range.ts`

Responsibilities:

- parse date range query params
- validate `from` / `to`
- provide defaults for operational analytics

Primary export:

- `parseAdminDateRange(searchParams)`

As Step 3 grows, domain-specific admin modules can be added in the same folder:

- `apps/web/src/global/b2c/admin/server/orders.ts`
- `apps/web/src/global/b2c/admin/server/order-detail.ts`
- `apps/web/src/global/b2c/admin/server/order-status.ts`
- `apps/web/src/global/b2c/admin/server/shipment.ts`
- `apps/web/src/global/b2c/admin/server/invoice.ts`
- `apps/web/src/global/b2c/admin/server/cancellation.ts`
- `apps/web/src/global/b2c/admin/server/return-cases.ts`
- `apps/web/src/global/b2c/admin/server/coupons.ts`
- `apps/web/src/global/b2c/admin/server/analytics.ts`

Those modules should own Supabase queries, business validation, mapping to DTOs, and side effects. Route handlers should call them after `verifyAdminRequest()`.

## Response Shape

All routes should use a consistent JSON envelope:

- success: `{ ok: true, data: ... }`
- failure: `{ ok: false, error: string, message: string }`

Mutation responses should also include the updated resource or a narrow summary that lets the UI update without immediately reloading the full page.

## Route Inventory

The planned Phase 08 admin route inventory is:

- optional `GET /api/admin/me`
- `GET /api/admin/orders`
- `GET /api/admin/orders/[orderNumber]`
- `POST /api/admin/orders/[orderNumber]/status`
- `PUT /api/admin/orders/[orderNumber]/shipment`
- `POST /api/admin/orders/[orderNumber]/invoice`
- `GET /api/admin/orders/[orderNumber]/invoice/download`
- `POST /api/admin/orders/[orderNumber]/cancellation/resolve`
- `POST /api/admin/orders/[orderNumber]/return-cases`
- `POST /api/admin/orders/[orderNumber]/return-cases/[returnCaseId]/close`
- `POST /api/admin/orders/[orderNumber]/return-cases/[returnCaseId]/complete`
- `GET /api/admin/coupons`
- `POST /api/admin/coupons`
- `GET /api/admin/coupons/products`
- `GET /api/admin/coupons/[couponId]`
- `PATCH /api/admin/coupons/[couponId]`
- `GET /api/admin/analytics`

Every browser-called route should also support `OPTIONS` through the shared CORS helper.

In the Next.js app, these routes should map to files under:

- `apps/web/src/app/api/admin/...`

## Identity And Session Routes

### `GET /api/admin/me`

Purpose:

- Optional admin bootstrap check.
- Lets the App SDK app show operator identity and access state before loading operational data, if that UX is useful.

Returns:

- verified operator id
- email
- name
- profile image
- Sanity project role
- access mode
- any v1 capability flags that the UI needs

Does not return:

- Supabase service-role state
- internal secrets
- broad Sanity project data

Notes:

- This route should remain cheap and safe to call on app load.
- This route is optional. The admin app can also skip it and let `GET /api/admin/orders` be the first authenticated call.
- Calling this route must not be required before calling other admin routes.
- The current `/api/admin/b2c/me` may remain as a temporary Step 2 diagnostic route until the final bootstrap decision is made.

## Order Routes

Orders are the main operational area. They cover both standard-product and `CPO` orders in one shared workflow.

Route params should use `orderNumber` for order detail URLs because the commerce docs define `order_number` as the public business identifier used in panel URLs and support communication. The backend can still use `orders.id` internally after lookup.

### `GET /api/admin/orders`

Purpose:

- Order list for scanning, browsing, searching, and navigating.

Query params:

- `cursor` for pagination
- `limit` for page size
- `q` for order number, customer email, or customer name search
- `status` for one or more order statuses
- `lineType` with values such as `standard`, `cpo`, or `mixed`
- `hasInvoice` with boolean-like values
- `hasShipment` with boolean-like values
- `hasOpenCancellationRequest` with boolean-like values
- `hasOpenReturnCase` with boolean-like values
- `createdFrom`
- `createdTo`
- `includeExpiredAwaitingPayment`

Default behavior:

- Exclude expired `awaiting_payment` orders from the normal active workflow list.
- Include active `awaiting_payment` orders only when they are still inside `payable_until`.
- Include paid and later lifecycle states unless filtered.

Returns:

- paginated order rows
- next cursor
- applied filters

Each row should include only list-level fields:

- order id
- order number
- current status
- created timestamp
- payable-until timestamp when relevant
- paid timestamp when relevant
- customer display name
- customer email
- grand total
- discount total
- line-type summary
- `containsCpo`
- invoice status
- shipment status
- open cancellation-request indicator
- open return-case indicator

The list should not return full customer snapshots, full item snapshots, invoice storage paths, or complete status history.

### `GET /api/admin/orders/[orderNumber]`

Purpose:

- Full order detail payload for the single long order workspace.

Returns:

- order header
- customer snapshot
- shipping address snapshot
- items and totals
- discount snapshot
- payment fields needed for support
- shipment metadata
- invoice metadata without unrestricted file URL
- active and historical return cases needed by v1
- cancellation request state
- status history
- allowed next admin status transitions
- admin action eligibility flags
- `CPO` context for `CPO` order lines

Notes:

- This route should shape the data for the App SDK admin UI.
- It may reuse customer-panel order mapping concepts, but it should not be email-scoped like customer routes.
- `CPO` context should be included only where it helps operate the order.

### `POST /api/admin/orders/[orderNumber]/status`

Purpose:

- Perform an admin-controlled order status transition.

Body:

- `status`
- optional `note`
- optional `notifyCustomer` only if implementation decides operators may suppress non-critical messages; otherwise email behavior should follow `email-flow.md`

Allowed transitions:

- from `paid` to `processing`, `shipped`, `completed`, `cancelled`
- from `processing` to `shipped`, `completed`, `cancelled`
- from `shipped` to `completed`, `returned`
- from `completed` to `returned`

Must reject:

- manual changes from `awaiting_payment`
- any change from terminal `cancelled`
- any change from terminal `returned`
- backward status transitions
- same-status updates that would resend lifecycle email

Side effects:

- update `orders.current_status`
- update lifecycle timestamp fields when applicable
- append an admin-driven `status_history` entry
- record the verified operator as the actor
- trigger customer email where `email-flow.md` requires it

Notes:

- This route should be action-specific instead of exposing a generic `PATCH /orders/[orderNumber]`.
- Status changes may have emails and CPO side effects, so they must stay explicit.

### `PUT /api/admin/orders/[orderNumber]/shipment`

Purpose:

- Create or replace manual shipment metadata for an order.

Body:

- `carrier`
- `trackingNumber`
- optional `trackingUrl`
- optional `shippedAt`

Side effects:

- update `orders.shipment_data`
- update `orders.shipped_at` if the implementation treats shipment metadata as the source for that timestamp
- append status/history or audit metadata if the implementation changes the main order status in the same operation

Important boundary:

- This route should not silently move the order to `shipped` unless that behavior is explicitly chosen during implementation.
- The safer v1 default is: shipment route writes shipment metadata; status route changes `current_status`.

### `POST /api/admin/orders/[orderNumber]/invoice`

Purpose:

- Upload or replace the invoice PDF for an order and link it in `orders.invoice_data`.

Request type:

- `multipart/form-data` is preferred if the Next.js backend proxies the upload into Supabase Storage.

Body:

- PDF file
- optional `attachedAt`

Backend behavior:

- validate operator access
- validate the file is a PDF
- upload the file to the private Supabase Storage invoice bucket
- update `orders.invoice_data.storagePath`
- update `orders.invoice_data.attachedAt`
- preserve checkout-time invoice recipient fields already stored in `invoice_data`
- trigger the invoice-availability customer email according to `email-flow.md`

Returns:

- updated invoice metadata
- no unrestricted public URL

Open implementation detail:

- exact storage path convention is still open in `invoice-and-documents.md`
- recommended path shape: `orders/{orderNumber}/invoice.pdf` or `orders/{orderId}/invoice.pdf`

### `GET /api/admin/orders/[orderNumber]/invoice/download`

Purpose:

- Let an authenticated operator download or preview the invoice PDF.

Returns:

- either a short-lived signed URL
- or an application-mediated file response

Must reject:

- orders without invoice storage path
- invalid operator access

Notes:

- The order detail route should return invoice metadata.
- This route exists so the detail payload never has to expose a long-lived file URL.

### `POST /api/admin/orders/[orderNumber]/cancellation/resolve`

Purpose:

- Resolve an open customer cancellation request.

Body:

- `requestId`
- `resolution` with values such as `cancel_order` or `decline_request`
- optional `adminNote`

When `resolution` is `cancel_order`:

- verify the order is still cancellable from `paid` or `processing`
- update the cancellation request as resolved
- set the order status to `cancelled`
- append status history
- record `resolved_by` and `resolved_at`
- send customer cancellation email according to `email-flow.md`

When `resolution` is `decline_request`:

- update the cancellation request as resolved without changing the main order status
- store the admin note if provided

Notes:

- Admin-initiated cancellation without a customer request can use the status route.
- This route is specifically for handling customer-created cancellation requests.

## Return Case Routes

Return handling remains inside order detail. It is not a separate top-level admin area in v1.

### `POST /api/admin/orders/[orderNumber]/return-cases`

Purpose:

- Manually create a return case when the customer contacts Audiofast outside the customer panel.

Body:

- optional `reason`

Must enforce:

- order status must be `shipped` or `completed`
- all order items must be returnable
- company-invoice orders are not returnable when that rule applies
- return window must still be active when the implementation applies customer-like eligibility to manual cases
- there must not already be an open return case for the order

Returns:

- created return case summary
- updated order action eligibility

Notes:

- The customer panel can already create return cases through customer-scoped flows.
- This route exists for operator-created cases.

### `POST /api/admin/orders/[orderNumber]/return-cases/[returnCaseId]/close`

Purpose:

- Close a return case without returning the order.

Body:

- optional `adminNote` if the schema or future JSON/audit shape supports it

Side effects:

- set return case status to `closed_without_return`
- set `closed_at`
- leave `orders.current_status` unchanged

Must reject:

- non-open return cases
- return cases not attached to the order

### `POST /api/admin/orders/[orderNumber]/return-cases/[returnCaseId]/complete`

Purpose:

- Complete a return case and mark the order as returned.

Body:

- optional `adminNote` if the schema or future JSON/audit shape supports it

Side effects:

- set return case status to `completed`
- set `completed_at`
- set order status to `returned`
- set `orders.returned_at`
- append status history
- send final returned email according to `email-flow.md`

Must reject:

- non-open return cases
- orders not eligible to move to `returned`
- return cases not attached to the order

## Coupon Routes

Coupons are a standalone top-level admin area in v1.

### `GET /api/admin/coupons`

Purpose:

- Coupon listing and operational state review.

Query params:

- `cursor`
- `limit`
- `q` for code search
- `isActive`
- `discountType`

Returns:

- coupon id
- code
- active state
- discount type
- discount value
- product keys summary
- usage count
- usage limit
- starts at
- expires at
- created at
- updated at

### `POST /api/admin/coupons`

Purpose:

- Create a new coupon.

Body:

- `code`
- `isActive`
- `discountType`
- `discountValueCents` for fixed coupons
- `discountPercent` for percent coupons
- optional `productKeys`
- optional `usageLimit`
- optional `startsAt`
- optional `expiresAt`

Must enforce:

- normalized unique coupon code
- one accepted discount type
- fixed coupons must have `discountValueCents`
- percent coupons must have `discountPercent`
- order-wide coupons may have empty `productKeys`
- product-specific coupons must have at least one product key
- usage limit cannot be lower than current usage count

### `GET /api/admin/coupons/products`

Purpose:

- Load selectable products for product-scoped coupon creation.

Returns:

- product id
- line type: `standard` or `cpo`
- product name
- brand name when available
- representative product key
- full `productKeys` array to save into `coupons.product_keys`
- price in cents when available
- Sanity image reference for admin thumbnails

Must include:

- published normal Sanity products that are sellable online and have at least one valid Supabase `pricing_variants.price_key`
- published internal `CPO` products that are sellable online, not archived, have `availabilityStatus = available`, and have a valid price

Important matching rule:

- standard products use Supabase `pricing_variants.price_key` values as coupon product keys because the cart stores selected standard variants in `line.productKey`
- `CPO` products use their Sanity slug as the coupon product key because the CPO cart line stores the CPO product route slug

### `GET /api/admin/coupons/[couponId]`

Purpose:

- Load one coupon for the coupon detail page.

Returns:

- full editable coupon fields
- read-only usage count
- derived status such as active, inactive, scheduled, expired, or usage-limit-reached

### `PATCH /api/admin/coupons/[couponId]`

Purpose:

- Edit an existing coupon.
- Activate or deactivate an existing coupon by updating `isActive`.

Body:

- same editable fields as coupon creation

Must enforce:

- same validation rules as creation
- usage count remains server-owned and is not editable from the admin UI
- usage limit cannot be set below current usage count
- deactivation should be represented as `isActive: false`, not as a separate action route

## Operational Analytics Routes

These routes are Phase 08 App SDK admin analytics. They are not the Phase 8.5 marketing/funnel analytics work for Google Analytics, Meta Pixel, or similar instrumentation.

### `GET /api/admin/analytics`

Purpose:

- Provide small purchase/order visibility for the admin panel.

Query params:

- `from`
- `to`
- optional `groupBy` with values such as `day`, `week`, or `none`

Returns:

- paid revenue in the selected period
- paid order count in the selected period
- average order value if cheap to compute
- discount total in the selected period if cheap to compute
- counts by current order status
- optional revenue series when `groupBy` is not `none`

Counting rules:

- revenue should be based on paid/provider-confirmed orders, not abandoned `awaiting_payment` orders
- cancelled and returned orders need an explicit implementation decision before being included or excluded from revenue totals
- the response should label the chosen counting mode clearly

Out of scope:

- Google Analytics
- Meta Pixel
- ad attribution
- storefront event instrumentation
- checkout funnel event maps
- cohort analysis
- full reporting dashboards

## Routes Not Planned For V1

The following should not be added in Phase 08 unless product scope changes:

- `/api/admin/cpo/...` as a separate top-level API group
- `/api/admin/customers/...` as a customer-management system
- `/api/admin/refunds/...` for automated refund handling
- `/api/admin/warehouse/...` for fulfillment integrations
- `/api/admin/reports/...` for full analytics
- generic `PATCH /api/admin/orders/[orderNumber]` for arbitrary order mutation

`CPO` availability is owned by Sanity in v1. Because the App SDK app already has Sanity context, simple `CPO` content reads and direct Sanity document operations can stay in the App SDK layer where appropriate.

If an order operation must also change `CPO` availability, that cross-system side effect should be handled inside the relevant order action route rather than by adding a separate top-level `CPO` admin API.

## Suggested Implementation Order

### 1. Shared Admin API Foundation

Implement the reusable server modules first:

- `apps/web/src/global/b2c/admin/server/auth.ts`
- `apps/web/src/global/b2c/admin/server/http.ts`
- `apps/web/src/global/b2c/admin/server/pagination.ts`
- `apps/web/src/global/b2c/admin/server/date-range.ts`

Then decide whether the finished App SDK app needs the optional `/api/admin/me` bootstrap route. Do not make it a prerequisite for the real admin routes.

Acceptance target:

- every later route can verify the operator with one shared helper
- every later route can return the same response/error envelope
- CORS behavior is not duplicated route by route

### 2. Read-Only Order APIs

Implement:

- `GET /api/admin/orders`
- `GET /api/admin/orders/[orderNumber]`

These unlock UI development for the order list and order detail without mutation risk.

Acceptance target:

- order list has a stable lightweight DTO
- order detail has a stable workspace DTO
- expired `awaiting_payment` orders are excluded from the normal active workflow by default
- `CPO` lines are visible in order context without creating a separate top-level `CPO` API

### 3. Order Status And History

Implement:

- `POST /api/admin/orders/[orderNumber]/status`

This should include:

- allowed transition validation
- lifecycle timestamp updates
- `status_history` append behavior
- verified operator actor data
- customer email hooks where `email-flow.md` requires them

Acceptance target:

- invalid transitions are rejected
- terminal states remain terminal
- same-status saves do not resend lifecycle emails
- skipped intermediate statuses do not create fake history entries

### 4. Shipment Operations

Implement:

- `PUT /api/admin/orders/[orderNumber]/shipment`

Keep shipment metadata separate from status changes unless implementation explicitly decides otherwise.

Acceptance target:

- operator can save carrier/tracking data
- shipment metadata updates do not accidentally mutate `current_status`
- order detail immediately reflects the updated shipment section

### 5. Cancellation And Return Handling

Implement:

- `POST /api/admin/orders/[orderNumber]/cancellation/resolve`
- `POST /api/admin/orders/[orderNumber]/return-cases`
- `POST /api/admin/orders/[orderNumber]/return-cases/[returnCaseId]/close`
- `POST /api/admin/orders/[orderNumber]/return-cases/[returnCaseId]/complete`

These should include focused tests for business rules and status-history behavior.

Acceptance target:

- customer cancellation requests can be accepted or declined
- admin-created return cases enforce the v1 return rules
- return cases can be closed without changing the order status
- completed return cases move eligible orders to `returned`

### 6. Invoice Upload And Download

Implement:

- `POST /api/admin/orders/[orderNumber]/invoice`
- `GET /api/admin/orders/[orderNumber]/invoice/download`

This step should lock the private Supabase Storage path convention.

Acceptance target:

- operator can attach invoice PDFs through the backend
- invoice files stay in private Supabase Storage
- order detail exposes invoice metadata, not a long-lived public file URL
- authenticated operators can download or preview invoices

### 7. Coupon APIs

Implement:

- coupon list
- coupon detail
- coupon create
- coupon edit
- coupon activation/deactivation through coupon edit

These should reuse the storefront coupon validation model where possible, but admin writes must use server-side privileged access.

Acceptance target:

- operator can create coupons
- operator can edit coupons
- operator can activate/deactivate coupons through `PATCH`
- usage count remains server-owned

### 8. Operational Analytics

Implement:

- `GET /api/admin/analytics`

Keep it small and tied to purchase/order data only.

Acceptance target:

- admin panel can show revenue/order-count visibility for a selected period
- response clearly documents whether cancelled/returned orders are included or excluded
- no Google Analytics, Meta Pixel, or storefront funnel instrumentation is mixed into this route

### 9. Hardening And Readiness

Add focused tests and checks after the route surface exists.

Coverage should include:

- admin auth rejection paths
- CORS behavior
- order list/detail DTO shape
- status transition rules
- cancellation and return rules
- invoice access authorization
- coupon validation
- analytics counting rules

Acceptance target:

- the backend route surface is stable enough for the App SDK UI steps to build against
- the security boundary is tested at least once per route family

## Done Criteria For Step 3

Step 3 is complete when:

- all routes in this file have implemented route handlers or a documented intentional deferral
- every route verifies the Sanity operator through the shared admin boundary
- privileged Supabase reads and writes stay server-side
- order list and order detail have stable DTOs for UI work
- order mutations enforce lifecycle rules
- shipment and invoice flows are operational from the API layer
- return and cancellation handling are operational from the API layer
- coupon management is operational from the API layer
- simple purchase/order analytics are available from the API layer
- tests cover the security boundary and the highest-risk business mutations

## Open Questions To Resolve During Implementation

- Should invoice replacement always resend the invoice email, or only first attachment?
- Should manual admin-created return cases use the same 14-day eligibility window as customer-created cases?
- How should cancelled or returned orders be counted in admin revenue analytics?
- Should status transition requests include an operator-visible note even though `orders.status_history` is currently JSON and no separate audit table exists?
- Should shipment metadata entry optionally trigger a status transition to `shipped`, or should the UI always call the status route separately?
