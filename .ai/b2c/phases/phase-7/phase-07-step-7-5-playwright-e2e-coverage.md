# Phase 07 Step 7.5 - Playwright E2E Coverage

Status: P0 complete locally
Owner: planning
Last updated: 2026-05-05
Depends on: `../phase-07-customer-panel.md`, `../../testing-strategy.md`, `phase-07-step-01-public-access-gateway-and-otp-auth.md`, `phase-07-step-04-orders-area.md`
Related files: `../../../apps/web/playwright.config.ts`, `../../../apps/web/e2e/README.md`, `../../../apps/web/.env.e2e.example`, `../../architecture/customer-auth-and-access.md`, `../../architecture/customer-panel-ia.md`, `../../architecture/cart-and-checkout-model.md`, `../../architecture/payment-process-model.md`

## Purpose

This file defines the first browser-level `Playwright` strategy for the completed Phase 07 customer-panel implementation.

It exists so the E2E suite starts from a deliberate test map rather than from ad hoc browser scripts.

Step 7.5 should prove the most important real customer journeys that cross:

- storefront product access
- cart persistence
- checkout submission
- mock payment confirmation
- thank-you recovery
- Supabase Auth OTP session behavior
- protected customer-panel routing
- order list and order-detail access
- reusable customer profile behavior where it affects checkout

Step 7.5 should not pretend that admin-owned workflows are complete.

Phase 07 only provides the customer panel. The admin panel belongs to Phase 08, so any journey that depends on an operator action should be deferred to a later browser-coverage step after Phase 08.

## Current Setup

The initial Playwright setup has been added to the web app.

Current local setup:

- `@playwright/test` is installed in `apps/web`
- browser binaries are installed locally for Chromium, Firefox, and WebKit
- `apps/web/playwright.config.ts` starts the Next.js app automatically on `127.0.0.1:3100`
- the project list uses `auth.setup`, `chromium`, and `chromium-authenticated`
- both browser projects depend on `auth.setup` so seeded authenticated data exists before P0 specs run
- E2E environment variables live in `apps/web/.env.e2e.local`
- `apps/web/.env.e2e.example` documents the required E2E variables
- `audiofast-test` is the dedicated Supabase E2E project
- `audiofast-test` has the copied database structure
- `audiofast-test` has the `prestige` pricing/configuration seed required by the first checkout test
- `apps/web/e2e/guest-checkout.spec.ts` covers the guest PDP-to-paid-thank-you journey
- `apps/web/e2e/guest-checkout-validation.spec.ts` covers incomplete-checkout validation and verifies no order is created
- `apps/web/e2e/auth.setup.ts` cleans and seeds a deterministic paid order for `e2e+customer-auth@audiofast.test`, then creates Playwright `storageState`
- `apps/web/e2e/checkout-auth-roundtrip.spec.ts` covers protected return-to and checkout login/cart preservation
- `apps/web/e2e/customer-authenticated-panel.spec.ts` verifies seeded order list and detail access
- `apps/web/e2e/customer-authenticated-checkout.spec.ts` verifies authenticated checkout prefill and save-to-profile persistence
- `apps/web/e2e/utils.ts` owns shared cart, checkout, auth, seed, cleanup, and Supabase assertion helpers

Important setup rule:

- the E2E project should use real Supabase schema, RLS, Auth, Storage, and server-side application code
- test data must be artificial and deterministic
- production customer/order data must not be copied into E2E

## Testing Philosophy For Step 7.5

The E2E suite should stay small and critical-path focused.

Playwright should cover paths where the value comes from exercising the browser and full application stack together.

Good Playwright ownership:

- a real user can complete checkout
- cart state survives navigation and auth roundtrips
- server actions and browser routing agree
- Supabase session cookies work in the Next.js app
- protected customer routes redirect correctly
- order detail access is enforced in the browser path
- payment mock, thank-you state, and customer panel align as one journey

Keep in `Vitest` instead:

- pure domain rules
- cart reducers and selectors
- pricing mappers
- checkout validation helpers
- order snapshot builders
- payment status idempotency
- policy eligibility functions
- focused server-action edge cases

## Phase Boundary

Step 7.5 is a customer-panel browser coverage step.

It may verify browser journeys that a customer can complete with the current application:

- guest purchase
- checkout
- mock payment confirmation
- thank-you recovery
- OTP login
- protected customer order access
- checkout login roundtrip
- account-details editing
- customer-submitted cancellation request where the order is already eligible

It should not include full browser journeys that require an admin/operator surface, because that surface does not exist until Phase 08.

Admin-dependent journeys should move to a future Phase `8.5` Playwright step.

Examples of admin-dependent journeys:

- invoice upload by an operator
- invoice lifecycle from admin upload to customer download
- shipment creation, courier/tracking updates, and shipped/completed status transitions
- return eligibility that depends on admin-shipped or admin-completed order states
- return-case processing beyond the customer entry point
- cancellation approval/rejection by an operator
- refund processing
- admin order status updates
- admin `CPO` availability/manual override behavior
- admin coupon management

Seeded data may still be used in Phase 7.5 to put the customer panel into a useful state, but seeded state is not the same as a complete E2E journey for an admin-owned lifecycle. If a test's meaningful action is "admin prepares or changes state", it belongs after the admin panel exists.

## Data And Environment Model

Step 7.5 should run against the dedicated `audiofast-test` Supabase project.

The Playwright test runner may use `SUPABASE_SERVICE_ROLE_KEY` to:

- clean previous E2E rows
- seed deterministic test rows
- verify database side effects after browser actions

The browser must use only the normal public app configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- app routes and server actions

Service-role credentials must never be exposed to client-side code.

Each test should use either:

- a unique `testRunId`
- a unique email such as `e2e+<runId>@audiofast.test`
- deterministic seeded order numbers and product keys scoped to the test

Cleanup should be explicit and should target only E2E-owned data.

## Accepted Initial Decisions

These decisions define the first E2E implementation slice.

- The first product path is `https://audiofast.pl/produkty/prestige/`.
- The first test may use the production Sanity dataset for product content.
- The matching `prestige` pricing/configuration data has been copied from the current `audiofast` Supabase project into `audiofast-test`.
- The first test should run against `next dev`; production-like `next build` plus `next start` can be revisited later.
- The first checkout test should not opt in to newsletter.
- Browser assertions should use accessible locators first: roles, labels, and visible names.
- If a critical control lacks a stable accessible locator, improve the UI accessibility before adding brittle selectors.
- `data-testid` should be reserved for cases where user-facing locators are genuinely unstable or unavailable.
- The first automated journey should be standard PDP to cart to checkout to mock payment to paid thank-you.
- The first E2E should verify both UI outcome and critical database side effects.
- E2E-owned data should use recognizable prefixes such as `e2e_`, `e2e+...@audiofast.test`, and `AF-E2E-...` where the application allows it.
- CI is intentionally deferred for now, but the suite should remain compatible with future CI execution.

## Mocking Strategy

Do not mock the Supabase commerce database in Playwright.

Use real Supabase behavior for:

- order persistence
- order item persistence
- customer profiles
- Auth sessions
- RLS-sensitive reads where the browser uses anon/authenticated context
- Storage behavior only where it supports customer-panel setup without pretending to cover the full invoice lifecycle

Mock or isolate external providers:

- payment should use the existing local Przelewy24 mock provider
- outbound email should not send real customer mail during E2E
- Microsoft Graph email sending should return a mock success when `E2E_MOCK_EMAILS=1`
- Mailchimp subscription and draft-creation calls should return mock success when `E2E_MOCK_MAILCHIMP=1`
- Meta Conversion API calls should be skipped when `E2E_DISABLE_ANALYTICS=1`
- cookie-consent UI should not render when `E2E_DISABLE_ANALYTICS=1`
- Sanity content should be stable through a known dataset or controlled fixtures

OTP remains a specific implementation decision.

Acceptable OTP test strategies:

- local/test Supabase email capture if available
- a test-only OTP retrieval helper guarded by E2E-only environment checks
- a seeded authenticated browser state for panel-only tests, while still keeping at least one real OTP journey test

Current Phase 7.5 decision:

- panel-focused tests use a guarded E2E-only auth helper to create a real Supabase session and save Playwright `storageState`
- the helper is disabled unless `E2E_AUTH_HELPER=1`
- the helper requires `E2E_AUTH_HELPER_SECRET`
- the helper rejects non-`e2e+...@audiofast.test` emails
- the helper is blocked in `VERCEL_ENV=production`
- this bypasses OTP delivery only; it does not mock the Supabase session used by the application

## Priority Map

### P0 - First Must-Have Journeys

These are required before Step 7.5 can be considered useful. They are now covered locally by the Chromium Playwright suite.

#### 1. Guest Standard Product Purchase

Status: covered by `apps/web/e2e/guest-checkout.spec.ts`.

Journey:

1. open a sellable standard product page
2. configure the product where required
3. add the product to cart
4. open cart
5. proceed to checkout
6. fill required customer and shipping data
7. accept required consent
8. submit checkout
9. complete payment through the mock provider path
10. land on paid thank-you state

Protects:

- buyable PDP wiring
- cart localStorage persistence
- cart revalidation before checkout
- checkout form submission
- order creation
- mock payment confirmation
- thank-you order-state resolution
- paid-order cart cleanup trigger

#### 2. Guest Purchase To Customer Panel Access

Status: covered through the deterministic authenticated-customer seed in `apps/web/e2e/auth.setup.ts` plus `apps/web/e2e/customer-authenticated-panel.spec.ts`.

Note: the real user-facing OTP email entry remains covered at the component/server level for now. Browser tests use the guarded E2E auth helper so the panel journey can stay deterministic without reading real email.

Journey:

1. complete a guest purchase
2. see paid thank-you state with order number
3. go to `konto-klienta`
4. request OTP for the purchase email
5. verify OTP
6. land in `konto-klienta/zamowienia`
7. open the purchased order detail

Protects:

- post-purchase recovery path
- OTP access for an email with eligible B2C orders
- customer profile/auth linking where applicable
- customer orders list visibility
- order-detail authorization by verified email
- order-time snapshot rendering

#### 3. Protected Route Return-To Behavior

Status: covered by `apps/web/e2e/checkout-auth-roundtrip.spec.ts`.

Journey:

1. open `konto-klienta/zamowienia/[orderNumber]` while logged out
2. verify redirect to `konto-klienta?returnTo=...`
3. complete OTP login
4. verify return to the original order-detail route

Protects:

- route protection
- return-to preservation
- redirect sanitization
- authenticated session cookie handoff
- detail route ownership enforcement after login

#### 4. Checkout Login Roundtrip With Cart Preservation

Status: covered by `apps/web/e2e/checkout-auth-roundtrip.spec.ts`.

Journey:

1. add product to cart as guest
2. open checkout
3. click the checkout login CTA
4. complete OTP login
5. return to checkout
6. verify cart contents are still present
7. verify email is prefilled and locked
8. verify authenticated consent UI is rendered

Protects:

- guest to authenticated checkout transition
- cart persistence across auth roundtrip
- locked email behavior
- newsletter/authenticated-consent separation
- reusable profile prefill surface

#### 5. Authenticated Checkout Profile Persistence

Status: covered by `apps/web/e2e/customer-authenticated-checkout.spec.ts`.

Journey:

1. log in as a known test customer
2. open checkout with a product in cart
3. verify profile defaults are prefilled
4. change future-order data
5. submit checkout with save-to-profile selected
6. verify later checkout loads the updated defaults

Protects:

- reusable `customer_profiles` behavior
- historical order snapshot separation
- future checkout prefill
- authenticated profile persistence through real browser flow

### P1 - Important Follow-Up Journeys

These should be added after the P0 suite is stable.

#### 6. CPO Purchase Path

Journey:

1. open an available CPO product page
2. add CPO item to cart
3. verify duplicate add/remove behavior
4. complete checkout
5. verify order detail identifies the CPO item correctly

Protects:

- single-instance CPO availability semantics
- CPO cart line behavior
- checkout compatibility with CPO items

#### 7. Cart Revalidation Drift

Journey:

1. seed cart/product pricing state
2. change pricing in the test database before checkout submit
3. submit checkout
4. verify price-change warning and no accidental order completion
5. accept refreshed state and submit again

Protects:

- stale cart handling
- price truth from Supabase
- order creation prevention when totals changed

#### 8. Coupon Happy Path And Invalidated Coupon

Journey:

1. seed a valid coupon
2. apply coupon in cart
3. verify discount in cart, checkout, thank-you/order detail
4. invalidate coupon before revalidation
5. verify coupon removal or warning behavior

Protects:

- coupon lookup wiring
- discount presentation
- coupon invalidation during cart lifecycle

#### 9. Account Details Edit To Future Checkout Prefill

Journey:

1. log in to customer panel
2. open `Dane konta`
3. update reusable contact/shipping/invoice defaults
4. start a new checkout
5. verify future checkout prefill changed
6. verify historical order detail still shows original snapshots

Protects:

- account details form wiring
- future-only profile model
- historical snapshot immutability

#### 10. Order Detail Cancellation Request Entry Point

Journey:

1. open eligible paid/processing order
2. submit cancellation request
3. verify pending cancellation state

Protects:

- customer-side cancellation request flow
- duplicate request prevention
- order-detail action visibility

Important boundary:

- keep this to the customer-submitted cancellation request
- do not test admin cancellation approval/rejection in Phase 7.5
- do not include return-case browser journeys here, because realistic return eligibility depends on admin-owned shipped/completed order lifecycle

### P2 - Later Coverage

These are valuable but should not block the first E2E milestone.

- empty cart and checkout blocked states
- invalid/non-owned order detail state
- expired `awaiting_payment` thank-you state
- orders listing pagination or filtering if introduced
- non-sellable product remains inquiry-only
- mixed standard + CPO cart
- mobile viewport smoke path
- Firefox/WebKit projects
- visual regression testing for selected stable surfaces

## Deferred To Future Phase 8.5

The following Playwright journeys should be tracked after Phase 08 admin operations exist.

### Invoice Lifecycle

Journey:

1. admin attaches invoice PDF to an order
2. customer logs in
3. customer opens order detail
4. customer downloads invoice through the protected application route
5. non-owner cannot download the same invoice

Reason for deferral:

- the meaningful setup action is admin invoice upload
- Phase 07 only has the customer-side proxy/download route
- seed-only invoice tests would not prove the admin-to-customer lifecycle

### Return Lifecycle

Journey:

1. admin marks order as shipped or completed
2. customer opens order detail inside the return window
3. customer submits a return request
4. admin processes the return case
5. customer sees the updated return state

Reason for deferral:

- realistic return eligibility depends on admin-owned order status and shipment lifecycle
- return-case processing belongs outside the Phase 07 customer panel

### Cancellation Processing

Journey:

1. customer submits cancellation request
2. admin accepts or rejects the request
3. customer sees the updated cancellation state

Reason for deferral:

- Phase 7.5 can cover the customer request entry point
- admin resolution belongs to Phase 08 operations coverage

### Shipment And Order Status Lifecycle

Journey:

1. customer completes paid order
2. admin moves order through operational statuses
3. admin adds shipment/tracking data
4. customer sees status history and shipment data update

Reason for deferral:

- status and shipment mutations are admin operations
- Phase 07 only renders customer-visible snapshots and status history

### Admin CPO And Coupon Operations

Journey:

1. admin changes CPO availability or coupon state
2. storefront/customer flow reflects the changed operational state

Reason for deferral:

- Phase 7.5 can cover customer-facing behavior against seeded CPO/coupon state
- admin mutation workflows belong after Phase 08 admin surfaces exist

## Proposed Implementation Order

The implementation should proceed in this order:

1. copy or seed the `prestige` Supabase pricing/configuration data into `audiofast-test`
2. create Supabase E2E helper for cleanup and seed
3. define stable test data IDs, emails, product keys, and order numbers
4. create first minimal seed for standard product pricing and checkout
5. add the first P0 test: guest standard product purchase
6. add test-only OTP strategy
7. add guest purchase to customer panel access
8. add protected route return-to behavior
9. add checkout login roundtrip
10. add authenticated profile persistence
11. stabilize local execution and artifacts
12. revisit CI setup when local P0 coverage is stable
13. expand to P1 customer-only paths
14. add Firefox/WebKit only after Chromium suite is stable

## Done Criteria For Step 7.5

Step 7.5 is complete when:

- Playwright is installed and configured for the web app
- E2E environment variables are documented
- `audiofast-test` is used instead of production Supabase
- seed and cleanup helpers exist
- all P0 journeys are automated and passing locally
- the suite can run from one command
- failures produce usable traces/screenshots/videos
- no production customer data is used
- no real payment provider is called
- no real marketing/email side effects are required for passing tests

Current local verification:

- `bun --env-file=.env.e2e.local playwright test` passes all 7 tests locally
- `bun run check-types` passes

Remaining follow-up:

- CI is intentionally not configured yet. Return to CI after local P0 coverage is accepted and the team decides where the E2E Supabase credentials should live.

## Not In Scope

Step 7.5 should not attempt to:

- backfill browser tests for the whole marketing/content site
- test every static page
- replace Vitest coverage for deterministic business rules
- use production Supabase data
- perform real Przelewy24 payments
- send real customer emails
- cover admin Phase 08 workflows
- cover invoice upload/download lifecycle before admin invoice upload exists
- cover return lifecycle before admin order shipment/status handling exists
- cover admin cancellation resolution before admin operations exist
- cover full Phase 09 policy operations beyond customer entry points
- introduce broad visual regression testing before the core commerce journey is stable

## Open Decisions

- OTP strategy for E2E needs a final implementation choice.
- Sanity test content strategy currently uses production Sanity content for `/produkty/prestige/`; dedicated test content can be revisited if this becomes unstable.
- CI is deferred. Before GitHub Actions runs are enabled, CI secret storage for `audiofast-test` must be configured.
- Parallel execution should remain disabled until seed isolation is proven.
- Browser matrix should remain Chromium-only until P0 journeys are stable.
- Future Phase `8.5` should be created after Phase 08 to cover admin-to-customer lifecycle journeys.
