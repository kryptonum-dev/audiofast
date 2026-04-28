# Phase 07 Step 04 - Orders Area

Status: completed
Owner: planning
Last updated: 2026-04-28
Depends on: `../phase-07-customer-panel.md`, `phase-07-step-01-public-access-gateway-and-otp-auth.md`, `../../architecture/customer-panel-ia.md`, `../../architecture/customer-auth-and-access.md`, `../../architecture/order-lifecycle.md`, `../../architecture/commerce-table-model.md`, `../../architecture/invoice-and-documents.md`, `../../business/returns-and-cancellations-rules.md`, `../../testing-strategy.md`
Related files: `../phase-07-customer-panel.md`, `../../architecture/customer-panel-ia.md`, `../../architecture/order-lifecycle.md`, `../../architecture/commerce-table-model.md`, `../../architecture/customer-auth-and-access.md`, `../../architecture/invoice-and-documents.md`, `../../business/returns-and-cancellations-rules.md`, `../../testing-strategy.md`

## Purpose

This file turns `Phase 07` Step 04 into an implementation-ready plan.

It defines:

- the accepted Step 04 orders-area strategy
- the current repo and data-model facts that shape the implementation
- the mini-steps required to take the orders area from partial list / placeholder detail to complete Phase 07 order access
- the order those mini-steps should be implemented in
- what Step 04 must deliver before `Dane konta` and follow-up browser coverage begin

## Implementation Status

Step 04 is now implemented.

Completed runtime scope:

- `konto-klienta/zamowienia` is the default authenticated customer-panel landing page.
- The orders list links to protected detail routes by public `order_number`.
- The order detail loader authorizes by authenticated normalized email and applies the same visibility classifier as the list.
- Expired `awaiting_payment` orders are hidden from list and detail access.
- The detail page renders order-time customer, shipping, invoice, discount, shipment, line-item, and status-history snapshots.
- Invoice downloads use an application-authorized route and short-lived Supabase Storage signed URLs.
- Cancellation and return entry points live on order detail and are gated by current order state and policy facts.
- Active/completed return-case information is displayed separately from the main order status.
- The detail page has a route-specific responsive skeleton loader.

Completed test closeout:

- `order-detail.test.ts` covers owned detail loading, missing/non-owned safe hiding, expired unpaid hiding, malformed timeline fallback, completed return-case summary, rejected cancellation request state, line ordering, snapshot mapping, discount mapping, and invoice signed URL safety.
- `order-cancellation.test.ts` covers paid and processing eligibility, shipped ineligibility, duplicate open requests, and ownership enforcement.
- `order-return.test.ts` covers shipped and completed eligibility, optional return reasons, duplicate open cases, ownership enforcement, status ineligibility, non-returnable items, company invoices, and return-window expiry.

Still outside Step 04:

- `Dane konta` reusable profile editing remains Step 05.
- Browser-level mocked auth / checkout / payment coverage remains follow-up Step `7.5`.
- Admin cancellation, admin return handling, admin invoice upload, and automated refunds remain later admin / operations phases.

## Current Project Facts

The current project state is important for this step:

- `konto-klienta` is the accepted public customer-access gateway
- `konto-klienta/zamowienia` is the accepted default authenticated landing page
- `konto-klienta/zamowienia/[orderNumber]` is the accepted authenticated order-detail route
- `konto-klienta/dane-konta` exists as a protected route but still belongs to Step 05
- `Supabase Auth` is the verified identity and session layer
- `customer_profiles` is the reusable profile/defaults layer, not the historical order source of truth
- `orders` and `order_items` are the commerce source of truth for the customer panel
- order access is based on the authenticated user's verified email identity
- the current list page already loads eligible orders through `loadCustomerOrdersForPanel`
- the current order-detail route is still a protected placeholder
- the current list cards are not yet the final navigable order-list experience
- the first broader authenticated panel composition is allowed to land in this step

This means Step 04 is not only an order-detail UI task.

It is the step that turns the protected customer area into the first real customer-panel product surface and proves that the Phase 07 identity work can safely expose order data.

## Accepted Step 04 Strategy

The accepted implementation strategy for this step is:

- make `Zamowienia` the first complete authenticated panel destination
- keep order access based on verified email identity from `Supabase Auth`
- list only customer-visible orders plus active `awaiting_payment` orders
- exclude expired `awaiting_payment` orders from the normal customer list
- load order details by public `order_number`, never by internal database ID in the URL
- authorize every detail and invoice request against the current authenticated email
- render order-time snapshots, not current reusable profile defaults
- render status history as a customer-readable timeline
- keep invoice access private and application-authorized
- put cancellation and return entry points on order detail only
- keep full cancellation / return policy completion aligned with Phase 09
- introduce shared authenticated panel chrome at the start of Step 04 so list, detail, and later `Dane konta` share one structure
- keep browser-level journey coverage in follow-up Step `7.5`

Important architectural rule:

- `Supabase Auth` proves the inbox identity
- `orders.customer_email` determines which orders belong to that identity
- `customer_profiles` can support session/profile context but must not override historical order snapshots

Step 04 must preserve that separation.

## Core Goal

Step 04 is complete only when `konto-klienta/zamowienia` and `konto-klienta/zamowienia/[orderNumber]` are real authenticated customer-panel views that can:

1. show the authenticated customer all eligible orders for the verified email
2. hide expired unpaid orders from the normal list
3. link each listed order to a protected order-detail page
4. load a single order by public order number
5. enforce ownership and eligibility before rendering detail data
6. show current status and full status history
7. show purchase-time customer, shipping, invoice, and line-item snapshots
8. expose invoice access only when a stored invoice exists and the order is authorized
9. show cancellation and return entry points only where structurally appropriate
10. provide the first stable authenticated panel shell for later `Dane konta`

This step should stop at a complete order-access experience.

It should not expand into editable profile data, full admin operations, automated refunds, or complete policy-flow handling.

## What Step 04 Must Deliver

- real `konto-klienta/zamowienia` list behavior
- navigable order cards or rows linking to order details
- real `konto-klienta/zamowienia/[orderNumber]` detail behavior
- detail server loader with ownership and visibility enforcement
- line-item loading and display
- customer/contact and shipping snapshot display
- invoice metadata display
- authorized invoice download or clearly scoped no-document state
- customer-readable status timeline
- active return-case visibility where applicable
- cancellation and return entry points on detail only
- shared authenticated panel shell/navigation at the minimum useful level
- focused automated protection for access-control and mapper rules

## What Step 04 Does Not Need To Deliver

This step should intentionally defer the following:

- editing reusable customer data in `Dane konta`
- newsletter / marketing consent management
- customer email change behavior
- full cancellation processing
- full return-request processing across customer, admin, and email
- company-invoice policy enforcement beyond showing the order's invoice snapshot
- admin status changes
- admin invoice upload
- admin return-case handling
- automated refunds
- Playwright coverage for the full guest / checkout / OTP / payment journey

Those belong to Step 05, Phase 08, Phase 09, or follow-up Step `7.5`.

## Current Code Snapshot

The current implementation already gives Step 04 a useful starting point:

- `apps/web/src/app/konto-klienta/zamowienia/page.tsx`
  - loads the customer session
  - redirects unauthenticated users through `konto-klienta` with `returnTo`
  - calls `loadCustomerOrdersForPanel`
  - renders list, empty, and error states
  - exposes logout
- `apps/web/src/global/b2c/customer-auth/server/orders.ts`
  - queries `orders` by `customer_email`
  - maps list rows into `CustomerOrdersListItem`
  - filters through `classifyCustomerAuthOrderAccess`
- `apps/web/src/global/b2c/customer-auth/eligibility.ts`
  - defines customer-visible order statuses
  - treats active `awaiting_payment` orders as eligible
  - treats expired `awaiting_payment` orders as hidden from customer access
- `apps/web/src/app/konto-klienta/zamowienia/[orderNumber]/page.tsx`
  - is protected
  - preserves intended destination through `returnTo`
  - still renders a placeholder instead of real order details

The main implementation gap is the detail-side data and UI.

The main security risk is that panel order reads use an admin Supabase client, so every new server loader must repeat explicit email, status, and visibility checks before returning data.

## Data Access Rules

### Identity Rule

The authenticated email from `loadCustomerAuthSession` is the customer-panel identity.

Rules:

- normalize the session email before querying
- use the normalized email for order ownership checks
- treat names, phone numbers, and addresses as order-specific data, not identity
- never grant access from a `customer_profiles` row alone
- never trust a URL order number without a matching ownership check

### List Visibility Rule

The list should show:

- orders in customer-visible lifecycle statuses:
  - `paid`
  - `processing`
  - `shipped`
  - `completed`
  - `cancelled`
  - `returned`
- `awaiting_payment` orders only while `payable_until` is still in the future

The list should not show:

- expired `awaiting_payment` orders
- orders for other emails
- unknown or unsupported statuses
- profile-only records with no eligible orders

### Detail Visibility Rule

The detail page should resolve an order by:

- `orders.order_number`

Then it must authorize by:

- matching `orders.customer_email` against the authenticated normalized email
- applying the same visibility classification as the list

If the order is not found, not owned, or no longer visible:

- do not reveal whether the order number exists for another customer
- show the same customer-safe not-found / unavailable state
- or use a `notFound()` response if that better matches the route pattern

The key rule is that the detail route must not leak cross-customer order existence.

### Snapshot Rule

The order detail must render order-time truth:

- `orders.customer_snapshot`
- `orders.shipping_address_snapshot`
- `orders.invoice_data`
- `order_items.item_snapshot`
- order-item purchase-time product and pricing columns

It must not render current `customer_profiles` values as historical order truth.

Profile edits in Step 05 must not change what Step 04 shows for old orders.

### Invoice Rule

Invoice PDFs live in private `Supabase Storage`.

Customer invoice access must:

- start from an authenticated order-detail context
- verify the customer can access the order
- require `invoice_data.storagePath` to exist
- return a short-lived signed URL or application-mediated download
- avoid raw public storage URLs

If no invoice PDF has been attached yet:

- the detail page may show invoice recipient metadata
- the detail page should explain that the document is not available yet
- the UI should not imply that the file download failed

### Cancellation And Return Rule

Step 04 owns placement and visibility of customer entry points.

It does not need to complete the full policy workflow.

Cancellation entry point:

- lives on order detail only
- can be visible for `paid` and `processing`
- must not be visible for `awaiting_payment`, `shipped`, `completed`, `cancelled`, or `returned`
- may lead to a future confirmation flow or temporary disabled / planned state if full processing is deferred

Return entry point:

- lives on order detail only
- can be structurally considered for `shipped` and `completed`
- must respect whole-order returnability and return-window rules when those runtime facts are available
- must remain separate from the main status timeline
- must show active return-case information when an open return case exists
- should not turn the main order status into `returned` directly

Full cancellation processing, return-case creation, company-invoice restrictions, admin handling, and communication alignment remain Phase 09 unless explicitly pulled forward.

## Recommended Mini-Step Order

### 1. Introduce The Authenticated Panel Shell IA

Step 04 should start by turning the protected route family into a coherent authenticated customer-panel area.

The shell should implement the agreed v1 customer-panel IA:

- primary destination: `Zamówienia`
- secondary destination: `Dane konta`
- global action: `Wyloguj się`

Order detail is not a separate primary navigation item.

It is reached from:

- an order row / card in `konto-klienta/zamowienia`
- a protected deep link such as `konto-klienta/zamowienia/AF-2026-00001`
- post-login `returnTo` behavior
- future order-confirmation email links

Expected work:

- define the shell's route coverage:
  - `konto-klienta/zamowienia`
  - `konto-klienta/zamowienia/[orderNumber]`
  - `konto-klienta/dane-konta`
- define the visible navigation model:
  - `Zamówienia`
  - `Dane konta`
  - `Wyloguj się`
- define how the shell marks the active primary section
- define how order detail shows context:
  - active section remains `Zamówienia`
  - detail page includes a back link to the order list
  - detail page may show a breadcrumb-like label using the public order number
- define where the authenticated email appears
- define where logout appears on desktop and mobile
- keep `Dane konta` present in navigation even if its content remains a Step 05 placeholder

Important direction:

- the shell should support the accepted v1 IA without adding a dashboard
- the shell should not introduce extra account/settings sections
- the shell should be reusable for Step 05 without forcing Step 05 to redesign the panel

### 2. Add The Customer Panel Shell Loader

Before the shell renders, define the shared server-side loader for authenticated panel context.

Expected work:

- add a server-only loader such as `loadCustomerPanelShell`
- call `loadCustomerAuthSession`
- redirect unauthenticated users to `konto-klienta` with the current protected route as `returnTo`
- return the normalized authenticated email
- return the linked profile summary when available
- return the minimal nav model needed by the shell
- expose the logout action through the shell rather than each page inventing its own logout placement
- keep the loader focused on session/profile/navigation context only

Reason:

- every authenticated customer-panel page needs the same access gate, email identity, profile summary, navigation state, and logout placement
- centralizing this prevents each page from reimplementing slightly different auth behavior

Important direction:

- this loader should not load order lists or order details
- order-specific loaders still belong to the relevant route/page
- the shell loader proves the customer identity, while order loaders prove order ownership

### 3. Build The Minimal Shared Panel Shell

Implement the UI wrapper after the IA and loader are clear.

Expected work:

- create a shared authenticated panel layout or component
- render the page heading/content through children or slots
- render navigation for:
  - `Zamówienia`
  - `Dane konta`
  - `Wyloguj się`
- show the authenticated email at the shell level where helpful
- support desktop and mobile presentation
- keep focus states and accessible navigation semantics
- use the shell for:
  - orders list
  - order detail
  - `Dane konta` placeholder

Important direction:

- the shell should be thin and structural
- it should not know how to query orders
- it should not contain order-detail business logic
- it should not turn the customer panel into a dashboard

### 4. Harden The Orders List Loader And Tests

The list already exists, but Step 04 should make it a deliberate, tested customer-panel entry point.

Expected work:

- review `loadCustomerOrdersForPanel`
- confirm it uses the authenticated normalized email
- confirm it lists customer-visible statuses
- confirm it includes active `awaiting_payment` orders
- confirm it excludes expired `awaiting_payment` orders
- confirm it sorts by newest first
- confirm it returns only fields needed by the list UI
- add focused tests for list eligibility and mapping behavior

Expected coverage:

- owned `paid` / `processing` / `shipped` / `completed` orders appear
- owned `cancelled` / `returned` orders appear
- active `awaiting_payment` orders appear
- expired `awaiting_payment` orders do not appear
- unsupported statuses do not appear
- orders for other emails do not appear
- database errors are handled by the page-level error state

Important direction:

- the list loader may use `createAdminClient`, but only behind explicit email filtering
- if later the project adds non-B2C orders to the same table, this loader should gain the needed B2C channel filter

### 5. Upgrade The Orders List UI

Turn the current list from a static authenticated page into the default customer-panel landing experience.

Expected work:

- wrap the list page in the authenticated shell
- make each listed order link to `/konto-klienta/zamowienia/{orderNumber}/`
- keep visible status and total on the list item
- keep created date visible
- consider showing a short active-payment hint for `awaiting_payment_active`
- keep expired unpaid orders hidden
- keep the empty state focused on "no visible orders" rather than implying the account is broken

Optional work:

- add a `Dokończ płatność` entry point for active `awaiting_payment` orders only if the Phase 06 payment model exposes a safe continuation URL

Important direction:

- do not add a long-lived unpaid-order retry flow unless the payment model is changed; v1 currently expects a fresh checkout after expiry

### 6. Freeze The Order Detail Contract

After the shell and list route are stable, freeze the exact server DTO that `konto-klienta/zamowienia/[orderNumber]` needs.

Expected work:

- define the detail shape returned by the customer-panel loader
- include order header fields
- include `order_items` sorted by `line_position`
- include parsed customer, shipping, invoice, shipment, discount, and status-history snapshots
- include active return-case summary if one exists
- include action eligibility flags for cancel / return
- include invoice download availability as a summary, not a raw URL

Reason:

- the detail page is the highest-risk part of Step 04 because it combines authorization, snapshots, private documents, status history, and action visibility

Accepted implementation direction:

- keep database rows internal to the server layer
- expose a typed customer-panel DTO to the page component
- keep parsing and formatting rules in testable helper functions where possible

### 7. Add The Authorized Detail Loader

Create the application data access path for a single customer-panel order detail.

Expected work:

- add a server-only loader such as `loadCustomerOrderForPanel`
- accept `orderNumber`, `normalizedEmail`, and optional `now`
- query `orders` by `order_number`
- query related `order_items` by internal `orders.id`
- query at most one active `return_cases` row by internal `orders.id`
- compare normalized `orders.customer_email` with the authenticated email
- classify the order with `classifyCustomerAuthOrderAccess`
- reject missing, non-owned, and not-visible orders with a customer-safe outcome
- return a typed detail DTO for owned and visible orders only

Important direction:

- the loader may use `createAdminClient`, but only behind explicit app-level authorization
- the loader should not trust route params as authorization
- the loader should not return raw Supabase rows to the page

### 8. Add Detail Loader Test Coverage

Add focused automated coverage before building too much UI on top of the loader.

Expected coverage:

- owned `paid` order can be loaded
- owned active `awaiting_payment` order can be loaded
- owned expired `awaiting_payment` order is not visible
- order for another email is not visible
- unknown order number is not visible
- malformed or unsupported `status_history` does not crash the page contract
- line items are sorted by `line_position`
- active return case is included when present
- closed or completed return case does not masquerade as active
- invoice metadata is summarized without exposing raw public URLs

Reason:

- the access-control boundary is too important to rely only on manual UI checks

### 9. Build The Real Order Detail Page

Replace the placeholder detail route with the real authenticated page.

Expected work:

- preserve the existing unauthenticated redirect and `returnTo` behavior
- load order detail through the authorized loader
- show a customer-safe unavailable state when the order cannot be shown
- render order number, creation date, current status, and total
- render status history as a readable timeline
- render line items from purchase-time `order_items` data
- render standard product configuration from `item_snapshot.selectedOptions`
- render `CPO` context from the CPO `item_snapshot` where available
- render customer/contact snapshot
- render shipping-address snapshot
- render invoice-data snapshot
- render discount snapshot when the order used a coupon
- render shipment metadata when available
- provide a clear back link to `konto-klienta/zamowienia`

Important direction:

- the page should be useful even when invoice, shipment, or return-case data is absent
- missing optional operational data should produce calm empty states, not technical errors

### 10. Add Status Timeline Parsing And Labels

Make status history customer-readable and resilient.

Expected work:

- define a parser for `orders.status_history`
- map status values to Polish customer labels
- map system/admin sources to customer-safe wording
- sort entries by timestamp when needed
- include the current status even if history is missing or incomplete
- avoid exposing internal admin identifiers in the customer panel

Important direction:

- the timeline should explain order progress, not expose operational internals
- if history is malformed, show a safe fallback rather than crashing the page

### 11. Add Invoice Access Handling

Add the first customer-safe invoice access path.

Expected work:

- show invoice recipient metadata from `orders.invoice_data`
- show a no-document-yet state when `storagePath` is empty
- add a route handler or server action for invoice download if `storagePath` exists
- re-run the same order ownership and visibility checks inside the download path
- return a signed URL or stream/proxy the file
- keep the storage bucket private

Accepted implementation direction:

- prefer a download endpoint that receives `orderNumber` and resolves the storage path only after authorization
- never place `storagePath` or a permanent public asset URL into customer-facing HTML as the access mechanism

### 12. Add Cancellation And Return Entry Points

Place the self-service entry points where the IA says they belong.

Expected work:

- add a cancellation section on detail only
- add a return section on detail only
- compute cancellation visibility from order status
- compute return visibility from order status, returnability, return window, invoice policy, and active return-case state where those facts exist
- show active return-case status separately from the main order status
- avoid showing closed-without-return as a persistent customer-facing section unless needed for the current flow

Accepted implementation direction:

- Step 04 may initially add gated entry points and explanatory states
- full mutations and email/admin alignment can remain Phase 09 if not already implemented
- if any mutation is added in Step 04, it must be protected by the same session and ownership checks as the detail loader

### 13. Reconnect Logged-In Purchase Outcome

After the real detail route exists, align the authenticated post-purchase handoff.

Expected work:

- confirm that an OTP-authenticated checkout can redirect to the new order detail after successful purchase where the IA expects it
- confirm that order confirmation emails can link toward the protected order-detail route
- confirm unauthenticated deep links send the customer through `konto-klienta`
- confirm successful OTP returns the customer to the intended order detail

Important direction:

- this is correctness alignment with existing Phase 06 / Phase 07 behavior
- broad browser automation remains Step `7.5`

### 14. Add Focused Step 04 Test Coverage

Step 04 should land with automated protection for the rule-heavy parts.

Expected coverage:

- detail loader ownership checks
- detail loader visibility checks for active and expired `awaiting_payment`
- detail loader not-found behavior
- status-history parser behavior
- snapshot mappers for customer, shipping, invoice, and line items
- action eligibility helpers for cancellation and return entry points
- invoice download authorization path if implemented
- list route keeps using the same eligibility rules as the detail route

Testing boundary:

- use `Vitest` for loaders, parsers, and action eligibility
- use component tests only where UI interaction adds value
- keep full browser journeys for Step `7.5`

## Recommended Implementation Sequence

The recommended implementation order inside Step 04 is:

1. introduce the authenticated panel shell IA
2. add the customer panel shell loader
3. build the minimal shared panel shell
4. harden the orders list loader and tests
5. upgrade the orders list UI
6. freeze the order-detail DTO contract
7. add the authorized detail loader
8. add detail loader test coverage
9. build the real order-detail page
10. add status timeline parsing and labels
11. add invoice access handling
12. add cancellation and return entry points
13. reconnect logged-in purchase outcome
14. add final focused Step 04 coverage

This sequence keeps the architecture stable:

- panel IA and shell loader land before individual pages duplicate auth/navigation behavior
- list behavior is hardened before the order-detail route depends on list navigation
- detail authorization and DTO shape come before invoice and action affordances depend on it
- policy entry points remain scoped so Phase 09 can complete the full workflow cleanly
- browser-level mocked auth + checkout + payment journeys remain deferred to Step `7.5`

## Open Implementation Decisions To Resolve Before Coding

These should be decided at the start of Step 04:

- whether unauthorized / missing order detail returns `notFound()` or a customer-safe unavailable page
- exact status-history JSON parser contract based on what the current checkout and admin code writes
- exact invoice download shape: signed URL redirect vs application-mediated file stream
- whether active `awaiting_payment` detail should include any payment continuation CTA in v1
- exact temporary behavior for cancellation / return entry points if full mutations remain Phase 09
- whether the shared panel shell should be a route-group layout or a reusable component around existing routes

## Risks And Guardrails

### 1. Cross-Customer Data Leakage

Risk:

- admin-client reads can bypass database RLS if a loader forgets to check ownership.

Guardrail:

- every customer-panel order loader and invoice handler must accept the authenticated normalized email and check it against the order before returning data.

### 2. Snapshot Drift

Risk:

- detail UI may accidentally show current `customer_profiles` values instead of purchase-time order truth.

Guardrail:

- Step 04 should only render order-level snapshots and order-item snapshots for historical order details.

### 3. Expired Payment Window Confusion

Risk:

- expired `awaiting_payment` orders could appear reachable through deep links after disappearing from the list.

Guardrail:

- list and detail must share the same access classifier.

### 4. Invoice Privacy

Risk:

- invoice files could become effectively public if raw storage URLs leak.

Guardrail:

- invoice access must pass through order authorization and use signed or proxied file access.

### 5. Policy Scope Creep

Risk:

- cancellation and return entry points could expand Step 04 into full Phase 09.

Guardrail:

- Step 04 owns placement and eligibility presentation; Phase 09 owns the full end-to-end policy system unless explicitly moved earlier.

## Done Criteria

Step 04 can be considered complete when:

- `konto-klienta/zamowienia` is the default authenticated landing page
- the orders list links to real detail pages
- the list includes active `awaiting_payment` orders
- the list excludes expired `awaiting_payment` orders
- `konto-klienta/zamowienia/[orderNumber]` loads by public order number
- order detail access is denied for missing, non-owned, and not-visible orders
- order detail shows current status and a customer-readable status history
- order detail shows order-time customer and shipping snapshots
- order detail shows purchased line items and purchase-time item details
- order detail shows order totals and discount snapshot where applicable
- order detail shows invoice metadata and safe document availability
- invoice download, if implemented, is authorized through the application layer
- cancellation and return entry points exist only on order detail and are status-gated
- active return-case information is visibly separate from the main order status
- the first shared authenticated panel shell exists for orders and later `Dane konta`
- the step has focused automated coverage for detail access, visibility, parsing, and action eligibility
- broader mocked auth + checkout + payment journeys remain tracked in follow-up Step `7.5`

## Phase 07 Completion Impact

Completing Step 04 leaves Phase 07 with one main product surface still to implement:

- Step 05, `Dane konta`

After Step 04:

- customer identity and protected routing should already be real
- authenticated checkout integration should already be connected
- the customer can access post-purchase order history and detail
- the panel shell can support the final reusable-data view

That means Step 05 can stay narrowly focused on reusable future-checkout defaults instead of also solving order access, layout, or panel navigation.
