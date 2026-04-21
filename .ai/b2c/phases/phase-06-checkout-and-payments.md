# Phase 06 - Checkout And Payments

Status: in progress
Owner: planning
Last updated: 2026-04-20
Depends on: `phase-05-buyable-pdp-and-cart.md`
Related files: `../architecture/customer-auth-and-access.md`, `../architecture/payment-process-model.md`, `../architecture/email-flow.md`, `../testing-strategy.md`, `../architecture/commerce-table-model.md`

## Objective

Implement the checkout flow, order creation, and payment handling needed to complete a B2C purchase end to end.

In the current implementation sequence, this phase should be built around the real `Przelewy24` transaction model, but with the external provider boundary mocked locally until account access exists.

The project does not yet have a live `Przelewy24` account, so Phase 06 should not block on direct provider credentials.

Instead, the phase should:

- build the real checkout and order-creation architecture now
- build the real payment-state and notification/recovery behavior now
- shape the server flow around the documented `Przelewy24` register -> return -> status-notification -> verification sequence
- replace only the live external provider calls with local mock behavior during implementation and test coverage
- leave the final live `Przelewy24` credential wiring as a later replacement step once access exists

## Why This Phase Exists

This phase turns the cart into a real transaction flow.

It is where customer data capture, order persistence, payment initiation, provider confirmation, and immediate post-purchase access become real system behavior.

It is also the phase where the project should preserve the real provider flow shape rather than introducing a temporary flow that teaches the application the wrong source of truth.

The current official `Przelewy24` documentation makes the broad flow clear:

- the merchant registers the transaction
- `Przelewy24` returns a transaction token
- the customer is redirected to the payment panel
- the customer later returns through `urlReturn`
- `Przelewy24` sends asynchronous payment status to `urlStatus`
- the merchant verifies the notification server-to-server

This means the thank-you redirect should not become the source of truth for payment success, even in the temporary implementation period.

## Inputs

- resolved cart and checkout model
- resolved payment-process thread
- finalized commerce foundation
- accepted Phase 05 cart revalidation and cart-to-checkout handoff behavior
- email-flow rules
- `../testing-strategy.md`

## Main Deliverables

- checkout data capture
- hard final validation at checkout submit / buy
- order creation in `awaiting_payment`
- real `Przelewy24`-shaped transaction-registration flow in application code
- local mock for the external `Przelewy24` boundary during implementation
- local mock return and status-notification flow that exercises the real internal confirmation path
- thank-you-page temporary access for guests
- confirmation-email trigger on real payment success
- first `Playwright` coverage for cart -> checkout -> payment behavior
- implementation-ready seam for later live `Przelewy24` credential wiring

## Accepted Direction For This Phase

The detailed implementation direction for Phase 06 is now:

- build a real checkout and order flow now
- use the real documented `Przelewy24` transaction structure now
- do not let browser redirect alone become payment truth
- keep payment success driven by backend confirmation logic
- implement a local mock of the external `Przelewy24` boundary because no live account exists yet
- make the future live `Przelewy24` integration a bounded replacement of mocked external calls rather than a rewrite of checkout or payment-state handling
- keep customer-panel list/detail work in `Phase 07`
- keep admin order-management work in `Phase 08`
- add `Playwright` in this phase because the first full transaction path now exists

## Work Included In This Phase

### 1. Checkout Domain And Contracts

This step should establish the pure checkout and payment contracts before page implementation gets deep.

The goal is to create a stable commerce domain layer that is independent of the final provider UI.

Expected work:

- define checkout input types for:
  - contact data
  - shipping data
  - billing / invoice data
  - legal consents
  - newsletter / marketing consent (opt-in captured at checkout)
  - reusable-profile save intent
- define a normalized checkout draft model for server-side prefill (authenticated-user defaults only; v1 intentionally does not persist in-progress form input in the browser)
- define validation schemas and explicit validation result shapes
- define hard final validation rules that run at submit time against current cart truth
- define the final order-snapshot builder from validated cart + checkout input
- define the `Przelewy24`-shaped payment contracts for v1, including:
  - transaction-registration input and output
  - stored token / reference fields needed after registration
  - return-state handling from `urlReturn`
  - asynchronous status-notification payload handling for `urlStatus`
  - server-side verification input and result mapping
  - mapping of provider result into internal order updates

This step should remain mostly domain and server-contract work rather than page-composition work.

### 2. Checkout Server Layer

This step should create the real backend behavior that the UI will call.

The goal is to make order creation and payment initiation correct before the checkout page becomes visually complete.

Expected work:

- load checkout prefill data for authenticated users
- keep guest checkout guest-first
- revalidate cart truth when entering checkout
- perform hard final validation at submit time
- reject stale, invalid, or blocked carts from becoming orders
- create a new order in `awaiting_payment` before any provider handoff
- preserve the final validated order snapshot, totals, coupon result, and item data
- attach the public order number at creation time
- apply agreed v1 `CPO` lock / protected-availability behavior at order creation if required by the accepted model
- update reusable customer defaults only when the accepted rules allow it
- when the customer opts into the newsletter at checkout, record the marketing-consent decision and subscribe the submitted email to the newsletter through the server-side subscription flow (aligned with `../architecture/email-flow.md`); this must happen server-side at submit time, not from the browser, and must not block order creation on transient subscription failures

This is the main transactional safety step of the phase.

#### Detailed Step 2 Implementation Plan

The current codebase already has the full Step 1 checkout domain layer under:

- `apps/web/src/global/b2c/checkout/types.ts`
- `apps/web/src/global/b2c/checkout/validation.ts`
- `apps/web/src/global/b2c/checkout/cart.ts`
- `apps/web/src/global/b2c/checkout/summary.ts`
- `apps/web/src/global/b2c/checkout/profile.ts`
- `apps/web/src/global/b2c/checkout/order-draft.ts`
- `apps/web/src/global/b2c/checkout/payment-contracts.ts`
- `apps/web/src/global/b2c/checkout/errors.ts`

Step 2 must treat those files as the source of truth and compose them.

Step 2 must not duplicate their logic inside server actions.

##### Core Goal

The goal of Step 2 is to implement the real server-side checkout application layer that:

- loads authenticated checkout context
- validates submitted checkout input on the server
- validates submitted cart truth on the server
- creates orders and order items in `Supabase`
- prepares the payment-registration handoff input
- returns stable structured success / failure results for the future UI layer

##### Important Current Constraint

The current Codex session does not have active Audiofast `Supabase` MCP access.

Implementation should therefore rely on:

- the existing `Supabase` schema already reflected in `apps/web/src/global/supabase/database.types.ts`
- the existing server-side `Supabase` client utilities in the repo
- local type-safe persistence code

Direct live-database MCP inspection should not be treated as required for Step 2 implementation.

##### Required Step 2 Files

The preferred file set for Step 2 is:

1. `apps/web/src/app/actions/checkout-auth-context.ts`
2. `apps/web/src/app/actions/checkout-load.ts`
3. `apps/web/src/app/actions/checkout-order-number.ts`
4. `apps/web/src/app/actions/checkout-persistence.ts`
5. `apps/web/src/app/actions/checkout-submit.ts`
6. `apps/web/src/app/actions/checkout-types.ts`
7. tests for the above action layer

Optional supporting file:

- `apps/web/src/app/actions/checkout-profile-persistence.ts`

This optional file is useful only if the implementation decides to separate post-payment profile/default persistence early rather than leaving it for the later payment-confirmation step.

##### File Responsibilities

###### 1. `checkout-auth-context.ts`

Purpose:

- load and normalize checkout-relevant auth context from the existing `Supabase Auth` setup

Responsibilities:

- read current server session
- map session state into the Step 1 `CheckoutSessionContext` shape
- load the current customer profile when appropriate
- return enough information to decide:
  - whether order-form prefill is allowed
  - whether the order-form email must be locked

This file should not:

- validate cart data
- create orders
- mutate profile defaults

###### 2. `checkout-load.ts`

Purpose:

- provide the real server-side order-form entry payload

Responsibilities:

- call `checkout-auth-context.ts`
- use Step 1 profile helpers to build initial draft/prefill data
- return:
  - initial order-form draft
  - email-lock flag
  - authenticated context
  - profile/prefill metadata needed by the future UI

This file should remain read-only.

It should not create or mutate any commerce records.

###### 3. `checkout-order-number.ts`

Purpose:

- generate the public order number in the accepted format

Responsibilities:

- generate `AF-YYYY-NNNNN`
- ensure uniqueness in a practical way against the current persistence approach
- return the number before the order insert happens

This file should stay narrowly focused.

It should not also insert the order.

###### 4. `checkout-persistence.ts`

Purpose:

- translate the Step 1 order draft into the actual `Supabase` insert payloads

Responsibilities:

- map `CheckoutOrderDraft` into:
  - `orders` insert data
  - `order_items` insert rows
- perform the order insert
- perform the order-items insert
- return inserted order identity and insert result metadata

Important rule:

- this file is a persistence adapter
- it should not decide business rules on its own

All validation and draft building should already be complete before this file is called.

###### 5. `checkout-submit.ts`

Purpose:

- orchestrate the full server-side submit flow from validated input to created order

Responsibilities:

- accept submitted order-form input
- accept submitted cart payload
- validate the cart payload via Step 1 guard logic
- perform hard final validation before order creation
- validate order-form input with the Step 1 `zod`-backed validator
- build the order summary from accepted cart truth
- build the profile persistence decision
- build the final order draft
- generate the order number
- persist the order and line items
- return:
  - success with order identity + payment-registration preparation data
  - or structured domain failure

This is the main Step 2 action and should remain an orchestration file.

It should not become the place where low-level SQL mapping or profile-update logic is embedded inline.

###### 6. `checkout-types.ts`

Purpose:

- hold the action-layer input and result contracts for Step 2

Suggested contents:

- `LoadCheckoutPageResult`
- `SubmitCheckoutResult`
- `PersistCheckoutOrderResult`
- shared action-layer success / failure payload shapes

This file is optional in theory, but recommended in practice to keep the action layer explicit and delegation-friendly.

###### 7. Tests

At minimum, Step 2 should add:

- `checkout-load.test.ts`
- `checkout-submit.test.ts`
- optionally `checkout-persistence.test.ts`

These tests should focus on:

- authenticated prefill behavior
- guest behavior
- invalid cart rejection
- invalid order-form rejection
- correct initial order status and timestamps
- correct order/item payload mapping
- correct profile/default persistence decision

##### How Step 2 Connects To Step 1

The expected composition is:

1. `checkout-load.ts`
   - uses Step 1 profile helpers
   - does not reinterpret profile rules
2. `checkout-submit.ts`
   - uses Step 1 cart guard
   - uses Step 1 input validation
   - uses Step 1 summary builder
   - uses Step 1 profile-decision logic
   - uses Step 1 order-draft builder
   - uses Step 1 error taxonomy
3. `checkout-persistence.ts`
   - accepts already-built Step 1 draft data
   - maps it to DB insert format

Step 2 must compose Step 1.

It must not rewrite Step 1 logic in server-action code.

##### Expected Submit Flow

The full Step 2 submit path should work in this order:

1. receive submitted order-form input and browser cart payload
2. validate cart eligibility with the shared Step 1 cart guard
3. perform final cart revalidation against live backend truth where needed
4. reject stale, empty, or blocked carts
5. validate order-form input with the Step 1 validator
6. build accepted order summary from valid lines
7. build profile persistence decision from session state and checkbox choice
8. build final order draft
9. generate public order number
10. persist `orders`
11. persist `order_items`
12. return a structured success payload for the payment-registration step

##### Data Inputs Required By Step 2

Step 2 should assume these inputs exist:

- validated or raw order-form input from the future UI layer
- hydrated browser cart payload sent by the client
- current auth/session context from server-side `Supabase Auth`

Important constraint:

- the cart is still browser-persisted in v1
- the server cannot infer the cart on its own without the client sending it

So Step 2 must explicitly accept the submitted cart payload and then revalidate it.

##### Revalidation Rules For Step 2

Step 2 must enforce three levels of trust:

1. browser cart state is not trusted on its own
2. order-form input is not trusted on its own
3. redirect intent from the client is not trusted on its own

Therefore Step 2 must:

- revalidate product/cart truth before creating the order
- reject blocked or stale lines
- reject mismatched authenticated email state
- reject invalid company-invoice branch data
- reject any payload that does not survive the final server-side validation pass

##### Persistence Rules For Step 2

Step 2 should persist:

- `orders`
- `order_items`

with the following starting values:

- `current_status = awaiting_payment`
- `payment_provider = przelewy24`
- `payment_reference = null`
- `payment_verified_at = null`
- `paid_at = null`
- `payable_until = created_at + 15 minutes`
- `status_history` containing the initial system-created `awaiting_payment` entry

Step 2 should preserve purchase-time truth for:

- customer snapshot
- shipping snapshot
- invoice snapshot
- coupon snapshot
- line snapshot
- totals

##### Profile Rules For Step 2

The currently accepted rule is:

- after a successful paid order, ensure the lightweight customer account/profile exists
- the checkbox controls only whether checkout defaults are stored for future purchases

This means Step 2 should:

- compute the profile/default persistence decision now
- carry that decision forward in structured form
- avoid prematurely treating the checkbox as permission to skip account creation entirely

If actual profile/default writes are deferred until payment confirmation, Step 2 should still return the decision clearly for later payment-confirmation handling.

##### Out Of Scope For Step 2

Step 2 should not yet implement:

- real `Przelewy24` API calls
- `urlReturn` handling
- `urlStatus` handling
- thank-you-page logic
- payment confirmation
- post-payment email sending
- customer-panel list/detail work

Those belong to later sub-steps in Phase 06.

##### Delegation Guidance

If this step is delegated to another agent, the agent should:

- treat Step 1 domain files as locked inputs unless a mismatch is discovered
- build only the server-side checkout action layer
- avoid UI work except for the action contracts required by the future form
- keep DB mapping separated from orchestration
- keep auth/profile loading separated from order creation
- return clear notes about any schema mismatch discovered between Step 1 assumptions and the current `Supabase` types

##### Step 2 Completion Criteria

Step 2 is complete when:

- the server can load authenticated checkout context
- the server can validate submitted order-form input
- the server can validate submitted cart truth
- the server can reject invalid or stale checkout attempts
- the server can build the final order draft
- the server can generate the public order number
- the server can persist `orders` and `order_items`
- the server returns a structured result ready for the payment-registration step

### 3. Checkout UI Layer

This step should replace the current placeholder page with a real checkout interface.

The goal is to build the complete customer-facing checkout surface on top of the already-defined domain and server behavior.

Expected work:

- build the real page at `koszyk/twoje-dane`
- render:
  - contact section (with an inline guest login hint that links returning customers straight to `konto-klienta`)
  - buyer type + invoice section (radio between `Osoba fizyczna` and `Firma/przedsiębiorca`; company branch reveals `NIP`, company name, and an optional separate invoice address)
  - shipping section with a structured Polish address (`streetName`, `buildingNumber`, optional `apartmentNumber`) and an optional separate shipping-recipient branch
  - legal-consent section (required terms + privacy acceptance, optional newsletter / marketing opt-in checkbox, and a convenience "accept all" control)
  - read-only order summary with a scrollable preview of cart lines
- implement logged-in prefill behavior
- keep authenticated checkout email locked
- show validation errors clearly at field level and form level, with blur-triggered client-side validation that mirrors the server-side Zod rules exactly
- surface pricing changes or blocked-line truth clearly when hard validation fails:
  - price changes surface as an inline banner; submitting a second time without further changes confirms the purchase at the new totals
  - blocked or removed lines surface as a blur overlay with a "return to cart" CTA; the customer cannot re-submit from inside the overlay
- revalidate cart truth only at submit time, not on mount (Phase 05 already revalidates at the cart-to-checkout handoff)
- keep the checkout summary aligned with the cart revalidation model finalized in Phase 05
- forward the newsletter opt-in value to the server at submit time so Step 2 can trigger the newsletter subscription
- redirect the customer to a mock thank-you page at `podziekowania-za-zakup/?order=AF-YYYY-NNNNN` after a successful mock-order creation; in v1 dev mode the cart is intentionally preserved on success to keep re-testing cheap

This step should avoid embedding provider-specific assumptions directly into the form flow.

#### Detailed Step 3 Implementation Plan

The current codebase now composes Step 1 domain + Step 2 server layer under the following UI surface:

- `apps/web/src/app/koszyk/twoje-dane/page.tsx` — server entry that awaits `loadCheckoutPageData()` and renders the shell
- `apps/web/src/app/podziekowania-za-zakup/page.tsx` — mock thank-you page (temporary v1 target for successful submits)
- `apps/web/src/components/b2c/CheckoutPage/CheckoutPageClient.tsx` — main client component (`react-hook-form`, `mode: 'onTouched'`, revalidate-on-submit)
- `apps/web/src/components/b2c/CheckoutPage/CheckoutSummaryCard.tsx` — read-only scrollable order summary
- `apps/web/src/components/b2c/CheckoutPage/styles.module.scss`
- `apps/web/src/global/b2c/checkout/form.ts` — UI-specific flattened form values (`CheckoutFormValues`) plus domain-to-UI (`buildCheckoutFormValues`) and UI-to-domain (`buildCheckoutSubmitInput`) mappers
- expanded `apps/web/src/global/b2c/checkout/validation.ts`:
  - `normalizePolishPhoneNumber` helper shared between client blur-validation and the server Zod preprocess
  - `createRequiredPolishPhoneSchema` factory used by both contact and shipping-recipient phone, so client and server can never drift apart
  - structured address shape (`streetName`, `buildingNumber`, `apartmentNumber`) reflected in the Zod schemas and `createEmptyCheckoutDraft`

Step 3 must treat Step 1 domain files and Step 2 server actions as the source of truth.

Step 3 must not duplicate validation or cart revalidation logic in the UI.

##### Core Goal

The goal of Step 3 is to deliver the production-quality customer-facing checkout page that:

- composes the Step 2 `loadCheckoutPageData` action for the initial payload and prefill
- renders the full order-form UI in Polish
- runs client-side field validation with blur-based feedback via `react-hook-form`'s `mode: 'onTouched'`
- submits through the Step 2 `submitCheckout` action which performs hard final validation
- surfaces cart revalidation results (price changes, blocked lines) as structured, recoverable UX
- redirects to the mock thank-you page on success
- leaves the cart untouched on both success (v1 dev convenience) and failure

##### Form State Model

`CheckoutFormValues` is intentionally flatter than `CheckoutSubmitInput`, with UI-specific flags:

- `buyerType: 'private' | 'company'`
- `provideSeparateBillingAddress: boolean`
- `shippingRecipientDiffers: boolean`
- `acceptRequiredConsents: boolean`
- `newsletterOptIn: boolean`
- `invoiceCompanyName: string`, `invoiceTaxId: string`
- nested `invoiceAddress: CheckoutAddress` (always present in form state; only submitted when `buyerType === 'company'`)

Important UI-state rules:

- purely-UI toggles (`provideSeparateBillingAddress`, `shippingRecipientDiffers`) are managed as local `useState`, not `react-hook-form`-registered fields, to avoid controlled/uncontrolled drift between the checkbox and the flag
- when `buyerType` flips between `private` and `company`, the invoice-address subtree is not reset, so the customer does not lose data they already typed
- the "accept all consents" control uses `useWatch` on the individual consent fields so its own checked state stays reactively correct as the children change
- the logged-in email field is rendered as read-only when `isEmailLocked` is true

##### Validation, Normalization, And Server Error Mapping

- client blur-validation reuses the exact same normalizers as the server Zod schemas so a value that passes on the client cannot fail server-side shape checks:
  - phone → `normalizePolishPhoneNumber` accepts `123456789`, `123 456 789`, `+48 123 456 789`, `0048…`, `48…`; canonical stored form is the 9-digit national number without prefix
  - country is hard-locked to `PL` and intentionally not rendered as a user-editable field
- required-field rules live in a single `CHECKOUT_RULES` map so every `register` call inside the page can stay a one-liner
- field-level server errors arrive with typed paths (`contact.email`, `shippingAddress.streetName`, `invoice.invoiceAddress.buildingNumber`, `consents.termsAccepted`, …) and are projected into `react-hook-form` via `mapServerFieldErrors`, so every `form_invalid` outcome lights up the right input without free-form string matching

##### Revalidation-On-Submit Behavior

- the UI does not revalidate the cart on mount; Phase 05 already revalidates at the cart-to-checkout handoff, and a second revalidation at page load would be redundant work the customer cannot observe
- on submit, the Step 2 `submitCheckout` action re-runs cart revalidation server-side against live backend truth; exactly three outcomes are possible:
  - **success** → the UI redirects to `podziekowania-za-zakup/?order=AF-YYYY-NNNNN`
  - **`cart_price_updated`** → an inline banner displays the new totals; submitting a second time without further cart changes confirms the purchase at the new price. The server strips "managed" issue codes (currently `price_changed`) from both the incoming and the revalidated cart-line arrays before comparing them, so this signal does not loop forever on resubmit when the only drift is a price the customer has already seen
  - **`cart_invalid`** → a blur overlay covers the page with a list of affected lines and a prominent "return to cart" CTA; the customer cannot re-submit from inside the overlay

##### UX Polish Landed During Step 3

- Polish-first copy everywhere in the form, including every validation message
- consent group: the required consent label is bold with a red asterisk; the optional newsletter consent is marked `(opcjonalnie)` and uses lighter typography
- phone inputs: `inputMode="tel"`, `autoComplete="tel-national"`, placeholder `123 456 789`; paste-friendly normalization silently strips `+48`, `0048`, dashes, parens, and whitespace before validation
- address inputs: split into `Ulica` (full width) + a compact `Numer domu` / `Numer mieszkania` row; the apartment field has no `required` rule and is stored as `null` when empty
- guest login hint inside the contact section links to `konto-klienta` with an icon, without ever suggesting the flow is gated behind auth
- scrollable cart preview card has custom scrollbar styling and inner padding so the scrollbar never sits on top of line content

##### Tests

Step 3 adds or expands the following Vitest suites:

- `apps/web/src/global/b2c/checkout/form.test.ts` — mappers between `CheckoutDraft` and `CheckoutFormValues` in both directions, including company-branch same-as-shipping invoice copying and separate-recipient fallback rules
- `apps/web/src/components/b2c/CheckoutPage/CheckoutPageClient.test.tsx` — RHF rendering, required-error flow, buyer-type switching, company-branch reveal, server-side-error projection, `cart_price_updated` banner, `cart_invalid` overlay, and the successful redirect to `podziekowania-za-zakup/?order=…`
- updated `apps/web/src/app/actions/checkout-load.test.ts` and `apps/web/src/app/actions/checkout-submit.test.ts` for the structured address shape, the 9-digit canonical phone, and the resubmit-after-price-change regression
- updated `apps/web/src/global/b2c/checkout/server/persistence.test.ts` for the structured address snapshot

##### Out Of Scope For Step 3

Step 3 does not implement:

- real `Przelewy24` transaction registration (Step 4)
- `urlReturn` / `urlStatus` / confirmation logic (Step 5)
- cart clearing on real payment success (Step 6)
- `Playwright` coverage (Step 7)

The mock thank-you page is a v1-only placeholder that will be replaced by the payment confirmation and order-status surface in Step 5.

##### Related Platform Hardening Completed Alongside Step 3

Step 3 surfaced two latent infrastructure gaps that were fixed inside the same commit cycle because they directly blocked a successful end-to-end mock submit:

- `apps/web/src/global/supabase/admin.ts` now **fails loudly** when `SUPABASE_SERVICE_ROLE_KEY` is missing, instead of silently falling back to the anon key and producing misleading `database_error` failures later in the submit path; the file is additionally `server-only`
- a `harden_b2c_rls_and_function_search_path` migration was applied to Supabase:
  - `FORCE ROW LEVEL SECURITY` on `customer_profiles`, `orders`, `order_items`, `return_cases`, and `coupons`
  - write grants on those tables revoked from `anon` and `authenticated`
  - per-table `SELECT` policies restricting authenticated reads to rows owned via `auth_user_id`
  - `search_path` pinned on `set_updated_at` and `ingest_pricing_json` to close the matching Supabase advisor findings
- `apps/web/src/global/supabase/rls.integration.test.ts` covers the RLS guarantees for `anon`, authenticated user A, authenticated user B, and service role, with a creation-registry cleanup strategy so partial test failures never leak rows into the real database
- `apps/web/vitest.setup.ts` mocks the `server-only` package so the hardened admin client imports cleanly under Vitest's `jsdom` environment

These hardenings are not UI work but are documented here because they shipped as part of the Step 3 cycle and unblock the upcoming Step 4 payment persistence path.

##### Step 3 Completion Criteria

Step 3 is complete when:

- the checkout page renders fully at `koszyk/twoje-dane` with prefill for authenticated users and guest-first behavior
- every required field validates on blur with Polish error messages that mirror the server-side Zod messages
- the happy-path submit reaches the mock thank-you page
- `cart_price_updated` and `cart_invalid` surfaces are distinguishable and recoverable
- `vitest` and `tsc --noEmit` are green across the whole `apps/web` package, including the RLS integration suite

### 4. `Przelewy24` Integration Shell And Local External Mock

This step should introduce the real provider-shaped integration shell without requiring live merchant credentials yet.

The goal is to let the team complete the full purchase flow using the actual `Przelewy24` transaction model while mocking only the unavailable external boundary.

Expected work:

- implement application-side code around the documented `Przelewy24` flow:
  - register transaction
  - receive transaction token
  - prepare redirect target
  - handle `urlReturn`
  - handle asynchronous `urlStatus`
  - verify status server-to-server
- create local mock behavior for the parts that cannot yet call real `Przelewy24`, including:
  - mocked transaction registration response
  - mocked token issuance
  - mocked external payment step
  - mocked redirect back through `urlReturn`
  - mocked asynchronous status notification to `urlStatus`
  - mocked verification result
- keep order creation and order status handling identical to the future live flow
- ensure the temporary implementation still treats backend confirmation as the source of truth, not the redirect itself

This step should make later live `Przelewy24` integration a replacement of mocked external calls rather than a rewrite of checkout logic.

### 5. Payment Confirmation, Recovery, And Thank-You Flow

This step should implement the runtime behavior after payment initiation.

The goal is to make payment truth, redirect handling, and customer messaging reliable even when events arrive in different orders.

Expected work:

- create thank-you / order-status route behavior for:
  - pending verification
  - paid / confirmed
  - expired
  - invalid access
- implement redirect return handling through the `Przelewy24`-style `urlReturn` path
- implement asynchronous status-notification handling through the `urlStatus` path
- implement verification of the received status through the server confirmation path
- treat verified backend confirmation as the source of truth
- support return-before-notification and notification-before-return cases
- support idempotent repeated notification handling
- trigger confirmation email only after real confirmed success
- keep unpaid orders active only within the agreed `15-minute` window
- ensure expired unpaid orders are no longer treated as normally payable
- avoid any long-lived resume-payment-on-same-order flow in v1

This step is where the phase becomes operationally trustworthy.

### 6. Shell-Level Application Wiring

This step should connect the new checkout and payment flow to the rest of the storefront shell.

The goal is to make the user journey coherent across cart, checkout, payment, and immediate post-purchase states.

Expected work:

- connect cart -> checkout entry against the real checkout route
- connect checkout submit -> transaction registration
- connect transaction registration -> external payment handoff
- connect `urlReturn` -> thank-you / order state handling
- clear the cart only after real payment success
- preserve safe recovery when the customer navigates back and forth
- add any required route metadata, navigation states, and loading behavior
- wire key analytics events for the commerce funnel where appropriate, such as:
  - begin checkout
  - payment start
  - purchase confirmed
  - payment failure / expiration where useful

This step should stay thin and should not become a second place where business rules are reimplemented.

### 7. Browser-Level Coverage And Transaction Hardening

This step should add the first browser-level safety net for the full B2C transaction path.

The goal is to prove that the implemented checkout and payment architecture behaves correctly in the most critical journeys.

Expected work:

- install the first `Playwright` setup for the commerce flow
- cover standard configurable product -> cart -> checkout -> mock payment success
- cover `CPO` product -> cart -> checkout -> lock behavior
- cover mixed cart -> checkout
- verify checkout pricing stays aligned with cart truth and hard validation rules
- cover `urlReturn` recovery and pending-verification behavior
- cover asynchronous status-notification behavior
- cover expired unpaid-order behavior at the accepted v1 level
- add integration tests for:
  - checkout validation
  - order creation
  - transaction registration
  - notification handling
  - verification handling
  - idempotency

This step should remain small but critical-path focused rather than broad.

## Recommended Implementation Sequence

The preferred implementation order inside Phase 06 is:

1. checkout domain and contracts
2. checkout server layer
3. checkout UI layer
4. `Przelewy24` integration shell and local external mock
5. payment confirmation, recovery, and thank-you flow
6. shell-level application wiring
7. browser-level coverage and transaction hardening

This sequence keeps the architecture stable:

- the domain comes before page complexity
- order safety comes before provider polish
- the local mock exercises the real `Przelewy24` transaction shape
- `Playwright` validates the full journey only after the path is genuinely usable

## Not In Scope For This Phase

- customer-panel list/detail implementation
- admin order-management UI
- advanced shipping or stock logic
- final live `Przelewy24` credential integration if account access is still unavailable
- browser / local-storage persistence of in-progress checkout form input; v1 intentionally does not preserve unsaved form values when the customer navigates back to the cart and returns (server-side prefill from the customer profile remains the only source for returning authenticated users)

## Future Live Wiring Note

Once the project has live `Przelewy24` access, the follow-up work should ideally be limited to:

- replacing mocked transaction-registration calls with live `Przelewy24` calls
- replacing mocked token/redirect handling with live redirect targets
- replacing mocked status notifications and verification with live provider endpoints
- mapping real provider payloads into the already-built confirmation/recovery flow
- extending tests with provider-specific cases where necessary

If this phase is implemented correctly, that follow-up should not require a checkout rewrite.

## Done Criteria

Phase 06 can be considered complete when:

- checkout can create a valid order
- hard final validation prevents stale or invalid cart truth from becoming an order
- payment can be completed end to end through the local mock of the external `Przelewy24` boundary against the real order and payment-state architecture
- the system behaves correctly even when redirect recovery is needed
- the system treats verified backend confirmation rather than browser redirect as payment truth
- the codebase is ready for later live `Przelewy24` credential wiring without a checkout rewrite
- `Playwright` is installed and covers the first critical cart -> checkout -> payment journeys
