# Commerce Analytics Implementation Plan

Status: draft
Owner: planning / execution
Last updated: 2026-05-07
Depends on: `phases/phase-08-admin-operations.md`, `phases/phase-10-launch-readiness.md`, `things-left-before-client-preview.md`
Related files: `../apps/web/src/global/analytics/track-event.ts`, `../apps/web/src/global/analytics/analytics-user-storage.ts`, `../apps/web/src/app/api/analytics/meta/route.ts`, `../apps/web/src/global/b2c/cart/`, `../apps/web/src/global/b2c/checkout/`

## Purpose

This file defines the implementation plan for adding commerce analytics to the B2C storefront and checkout flow in `apps/web`.

The admin panel already has simple operational analytics based on persisted orders. This plan is about customer-facing ecommerce instrumentation: cart, checkout, payment handoff, purchase confirmation, and related B2C events.

The goal is to use the existing analytics infrastructure rather than introducing a second tracking system.

## Current Analytics Architecture

The current web analytics system is centered on:

- `apps/web/src/global/analytics/track-event.ts`
- `apps/web/src/global/analytics/analytics-user-storage.ts`
- `apps/web/src/app/api/analytics/meta/route.ts`
- `apps/web/src/components/shared/CookieConsent/`
- `apps/web/src/components/shared/Analytics.tsx`
- `apps/web/src/components/shared/analytics/ProductViewTracker.tsx`
- `apps/web/src/components/shared/analytics/CategoryViewTracker.tsx`

### Runtime Shape

`trackEvent(...)` is the public browser helper.

It accepts one logical event with optional:

- `meta`
- `ga4`
- `user`
- `url`
- `eventId`

It then:

1. generates or reuses one `eventId`
2. captures UTM values from the current URL into `sessionStorage`
3. waits for cookie consent and analytics script readiness
4. sends Meta Pixel events through `window.fbq`
5. sends Meta CAPI events through `POST /api/analytics/meta`
6. sends GA4 events through `window.gtag("event", ...)`

On the server, `trackEvent(...)` does not send analytics. It only returns an event id. Commerce analytics that must happen at authoritative server boundaries needs either a client-side confirmation tracker or a new server-side analytics mechanism.

### Production Boundary

Analytics is mounted only for production deployment in `apps/web/src/app/layout.tsx`.

The root layout wraps the site in `CartProvider`, then renders:

- `CookieConsent`
- `Analytics`

only when `IS_PRODUCTION_DEPLOYMENT` is true.

For E2E, `E2E_DISABLE_ANALYTICS=1` disables cookie-consent rendering and makes the Meta CAPI route return a mocked success response.

### Consent Model

The consent cookie is:

- `cookie-consent`

Important consent rules:

- no consent cookie: `trackEvent` queues until `cookie_consent_updated` and `analytics_ready`
- GA4 requires `analytics_storage: "granted"`
- Meta Pixel requires `ad_storage` or `ad_user_data`
- Meta CAPI requires `conversion_api: "granted"` on client and server
- advanced matching requires `advanced_matching: "granted"`

Important constraint:

- `saveAnalyticsUser(...)` stores normalized user data in localStorage and is not consent-gated today.

Commerce implementation should not expand that behavior casually. For checkout, only store or pass customer data where it materially improves matching and follows the current consent model.

### Current Events

Currently emitted:

- `PageView` / `page_view`
- `Contact` / `contact`
- `ViewContent` / `view_item`
- `ViewCategory` / `view_item_list`
- `Lead` / `generate_lead`

Currently supported by type but not emitted from B2C commerce:

- `AddToCart` / `add_to_cart`
- `RemoveFromCart` / `remove_from_cart`
- `ViewCart` / `view_cart`
- `InitiateCheckout` / `begin_checkout`
- `AddPaymentInfo` / `add_payment_info`
- `Purchase` / `purchase`

## Current B2C Commerce Flow

The implemented B2C flow is:

1. standard PDP or `CPO` PDP
2. add item to cart
3. cart page
4. cart runtime revalidation
5. checkout page
6. checkout submit
7. order creation in Supabase
8. Przelewy24 registration
9. payment handoff
10. payment status notification / verification
11. order moves from `awaiting_payment` to `paid`
12. thank-you page renders paid state
13. customer can access order through customer panel

Relevant code areas:

- standard add-to-cart: `apps/web/src/components/products/ProductHero/PricingSection.tsx`
- `CPO` add/remove cart: `apps/web/src/components/cpo/CpoProductHero/CpoProductInquirySection.tsx`
- cart provider: `apps/web/src/global/b2c/cart/cart-provider.tsx`
- cart page: `apps/web/src/components/b2c/CartPage/CartPageClient.tsx`
- cart item card: `apps/web/src/components/b2c/CartPage/CartItemCard.tsx`
- cart coupon card: `apps/web/src/components/b2c/CartPage/CartCouponCard.tsx`
- checkout page: `apps/web/src/components/b2c/CheckoutPage/CheckoutPageClient.tsx`
- checkout form: `apps/web/src/components/b2c/CheckoutPage/CheckoutForm.tsx`
- checkout server action: `apps/web/src/app/actions/checkout-submit.ts`
- checkout submission domain: `apps/web/src/global/b2c/checkout/server/submit-checkout.ts`
- payment start: `apps/web/src/global/b2c/checkout/server/start-payment.ts`
- payment confirmation: `apps/web/src/global/b2c/checkout/server/payment-status.ts`
- payment state update: `apps/web/src/global/b2c/checkout/server/payment-update.ts`
- thank-you loader: `apps/web/src/global/b2c/checkout/server/load-thank-you-page.ts`
- thank-you page: `apps/web/src/app/podziekowania-za-zakup/ThankYouPageContent.tsx`
- cart cleanup after paid state: `apps/web/src/app/podziekowania-za-zakup/ThankYouCartCleanup.tsx`

## Implementation Principles

### 1. One Mapper, Many Touchpoints

Do not build event payloads ad hoc in each component.

Add a small B2C analytics module, for example:

- `apps/web/src/global/b2c/analytics/commerce-events.ts`
- `apps/web/src/global/b2c/analytics/commerce-events.test.ts`

This module should own:

- cart-line to GA4 item mapping
- order-line to GA4 item mapping
- Meta `content_ids`
- Meta `content_type`
- event `value`
- event `currency`
- coupon fields
- standard vs `CPO` item tagging
- discount fields
- transaction id fields
- stable dedupe key helpers for purchase events

### 2. Track User Intent And Authoritative Outcomes Separately

Client UI events should track user intent:

- add to cart
- remove from cart
- view cart
- begin checkout
- add payment info / payment handoff
- checkout submit failure

Purchase should track authoritative paid outcome:

- only after order state is `paid`
- never merely after checkout submit
- never merely after browser return from Przelewy24

### 3. Keep Purchase Idempotent

Purchase analytics must not fire repeatedly on:

- page refresh
- thank-you manual refresh
- payment polling
- browser back/forward
- repeated provider status notifications

Use at least:

- `transaction_id = orderNumber`
- local/session storage guard such as `audiofast:b2c-analytics:purchase:<orderNumber>`
- one shared `eventId` for Meta Pixel and Meta CAPI for the same browser event

For server-side paid conversion in the future, add a persistent order-level analytics marker. For this v1 plan, prefer client-side thank-you tracking with local dedupe because it fits the existing browser analytics pipeline.

### 4. Do Not Duplicate Business Rules In Analytics

Analytics code should not re-decide:

- buyability
- price truth
- coupon validity
- payment truth
- returnability

It should consume already-built cart/order/checkout data.

### 5. Respect Existing Consent Behavior

Use `trackEvent(...)` for browser events so the current consent queue and provider dispatch behavior remains centralized.

Do not call `gtag`, `fbq`, or `/api/analytics/meta` directly from B2C components.

## Event Map

### Event 1 - Product View

Status:

- standard products already emit `ViewContent` / `view_item`
- `CPO` product pages do not currently render `ProductViewTracker`

Implementation:

- keep standard product view behavior
- add `ProductViewTracker` to `apps/web/src/app/certyfikowany-sprzet-uzywany/[slug]/page.tsx`
- for `CPO`, use:
  - `productId`: `product._id`
  - `productName`: `product.name`
  - `pricePLN`: `product.priceCents / 100` when available
  - `brand.name`: `product.brandName`
  - category: `cpo`

Payload:

- Meta: `ViewContent`
- GA4: `view_item`

Notes:

- this is not strictly part of checkout funnel completion, but it closes a current asymmetry between standard and `CPO` product pages.

### Event 2 - Add To Cart

Trigger:

- user adds a standard product to cart
- user adds a `CPO` product to cart
- quantity increase in cart can optionally be modeled as incremental `add_to_cart`

Primary touchpoints:

- `PricingSection.tsx` in `handleAddToCart`
- `CpoProductInquirySection.tsx` in the add branch of `handleToggleCart`
- `CartItemCard.tsx` for quantity increment if tracked

Payload:

- Meta: `AddToCart`
- GA4: `add_to_cart`

GA4 params:

- `currency: "PLN"`
- `value`
- `items`

GA4 item fields:

- `item_id`: `line.productKey`
- `item_name`: `line.productName`
- `item_brand`: `line.brandName`
- `item_variant`: configuration signature or `CPO`
- `item_category`: `standard` or `cpo`
- `price`: unit price in PLN
- `quantity`
- `discount` if known

Meta params:

- `content_ids`: product keys
- `content_type`: `product`
- `content_name`
- `value`
- `currency: "PLN"`
- `line_type`: `standard` or `cpo`

Notes:

- standard add-to-cart has selected variant/configuration available at the PDP.
- `CPO` add-to-cart has fixed quantity and fixed price.
- Do not track failed add attempts as `AddToCart`.

### Event 3 - Remove From Cart

Trigger:

- user removes any cart item
- user toggles a `CPO` PDP item out of cart
- quantity decrement can optionally be modeled as incremental `remove_from_cart`

Primary touchpoints:

- `CartItemCard.tsx` in `handleRemove`
- `CpoProductInquirySection.tsx` in the remove branch of `handleToggleCart`

Payload:

- Meta: `RemoveFromCart`
- GA4: `remove_from_cart`

Notes:

- `CartItemCard` is the best cart-page insertion point because it still has the full `line` before calling `onRemove(line.lineId)`.
- For a standard line whose quantity is reduced but not removed, send only the delta quantity if tracked.

### Event 4 - View Cart

Trigger:

- cart page renders hydrated non-empty cart

Primary touchpoint:

- `CartPageClient.tsx`

Implementation:

- after hydration and runtime load/revalidation, emit once per cart page view when `cart.lines.length > 0`
- guard with a ref keyed by the current cart fingerprint so revalidation rerenders do not duplicate the event

Payload:

- Meta: `ViewCart`
- GA4: `view_cart`

Notes:

- current `trackEvent` treats `ViewCart` as `trackCustom` because `META_STANDARD_EVENTS` does not include it. Confirm whether to add `ViewCart` and `RemoveFromCart` to `META_STANDARD_EVENTS` before implementation.

### Event 5 - Coupon Applied

Trigger:

- coupon is successfully applied to cart

Primary touchpoint:

- `cart-provider.tsx` inside `applyCoupon(...)`

Recommended event:

- GA4: custom event `select_promotion` only if the type union is extended
- Meta: custom event such as `ApplyCoupon` only if explicitly desired

For v1 minimum:

- do not make coupon events a launch blocker
- include coupon fields in `view_cart`, `begin_checkout`, `add_payment_info`, and `purchase`

Notes:

- tracking coupon failures can create noisy analytics.
- if needed later, track internal/debug events only, not primary ad-platform conversions.

### Event 6 - Begin Checkout

Trigger:

- cart revalidation succeeds and user is sent from `/koszyk/` to `/koszyk/twoje-dane/`

Primary touchpoint:

- `CartPageClient.tsx` in `handleCheckout`, after blocking revalidation passes and before `router.push(CHECKOUT_PATH)`

Payload:

- Meta: `InitiateCheckout`
- GA4: `begin_checkout`

GA4 params:

- `currency`
- `value`
- `coupon` if active
- `items`

Meta params:

- `content_ids`
- `content_type`
- `num_items`
- `value`
- `currency`
- `coupon`

Optional fallback:

- `CheckoutPageClient.tsx` can emit `begin_checkout` when the checkout page is hydrated with a non-empty cart and no prior begin-checkout event exists in session storage.

Decision:

- implement the cart-button trigger first.
- add checkout-page fallback only if direct checkout deep-links are common enough to matter.

### Event 7 - Checkout Submit Attempt

Trigger:

- checkout form is submitted

Primary touchpoint:

- `CheckoutForm.tsx` at the start of `onSubmit`

Recommended event:

- internal/custom event only, not GA4 recommended ecommerce event

Potential names:

- Meta custom: `CheckoutSubmit`
- GA4 custom: `checkout_submit`

Payload:

- cart totals
- item count
- line count
- buyer type: private/company
- authenticated: true/false
- save-to-profile selected: true/false
- newsletter opt-in selected: true/false

Decision:

- optional for v1.
- Useful for funnel diagnosis but not required for core ad-platform ecommerce reporting.

### Event 8 - Checkout Submit Failure

Trigger:

- checkout server action returns `ok: false`

Primary touchpoint:

- `CheckoutForm.tsx` in the `!result.ok` block

Recommended event:

- GA4 custom: `checkout_error`
- Meta custom: `CheckoutError`

Payload:

- error code from `result.error.code`
- cart item count
- line count
- has coupon
- authenticated

Decision:

- optional for launch analytics.
- Useful for diagnosing friction such as `cart_price_updated`, `cart_invalid`, and form validation errors.

### Event 9 - Add Payment Info / Payment Handoff

Trigger:

- checkout submission succeeds
- order is persisted
- payment transaction is registered
- browser is about to redirect to mock return or real Przelewy24 panel

Primary touchpoint:

- `CheckoutForm.tsx`, after successful `submitCheckout(...)` and before `router.push(result.value.redirectUrl)`

Payload:

- Meta: `AddPaymentInfo`
- GA4: `add_payment_info`

GA4 params:

- `currency`
- `value`
- `payment_type: "przelewy24"`
- `coupon`
- `items`

Meta params:

- `content_ids`
- `content_type`
- `num_items`
- `value`
- `currency`
- `payment_type: "przelewy24"`
- `order_number`

Notes:

- this is not purchase.
- this is the final client-side event before leaving Audiofast for Przelewy24 in live mode.

### Event 10 - Purchase

Trigger:

- thank-you page resolves an order state of `paid`

Primary touchpoints:

- `load-thank-you-page.ts`
- `ThankYouPageContent.tsx`
- new client component, for example:
  - `apps/web/src/app/podziekowania-za-zakup/ThankYouPurchaseTracker.tsx`

Implementation:

1. Extend `LoadThankYouPageData` with an optional `analytics` object available only for paid orders.
2. Query order totals and item rows when loading a paid thank-you page.
3. Render `ThankYouPurchaseTracker` only when `state.id === "paid"` and analytics payload exists.
4. In the client tracker, check local/session storage for `orderNumber`.
5. If not tracked, call `trackEvent(...)` with `Purchase` / `purchase`.
6. Store the tracked marker after calling `trackEvent(...)`.

Required paid-order analytics fields:

- order id
- order number
- current status
- subtotal cents
- discount total cents
- grand total cents
- used discount / coupon code
- customer email and optional phone/name/address fields for advanced matching
- order items:
  - line type
  - product key
  - product name
  - brand name
  - quantity
  - unit price cents
  - line discount total cents
  - line total cents
  - item snapshot

GA4 purchase params:

- `transaction_id`: order number
- `currency: "PLN"`
- `value`: grand total in PLN
- `tax`: omit for v1 unless tax split is explicit
- `shipping`: `0` for v1 if shipping is included/free
- `coupon`: coupon code when present
- `items`

Meta purchase params:

- `content_ids`
- `content_type: "product"`
- `num_items`
- `value`
- `currency: "PLN"`
- `order_id` or `order_number`
- `coupon`

Important:

- purchase should not be emitted from `ThankYouCartCleanup` because that component depends on same-device pending cart cleanup and does not have authoritative order-item payloads.
- purchase should not be emitted from `startCheckoutPayment`.
- server payment confirmation is the authoritative state change, but current analytics dispatch is browser-oriented. For v1, paid thank-you tracking is the correct fit.

### Event 11 - Payment Pending / Expired / Failed

Current state:

- pending is visible as `awaiting_payment` on thank-you page
- expired resolves in loader but `shouldRenderCheckoutConfirmationPage(...)` currently returns false for `expired`, so expired becomes `notFound`
- failed/cancelled provider statuses are handled in `payment-status.ts` but do not currently render a customer-facing analytics page

Recommendation:

- do not make these primary analytics events for the first commerce analytics slice
- add optional custom events only after UX for expired/failed states is clarified

Potential future events:

- `payment_pending`
- `payment_expired`
- `payment_failed`

If implemented:

- pending can be emitted from a thank-you tracker when state is `awaiting_payment`
- expired requires either rendering the expired thank-you state or server-side analytics
- provider failed/cancelled requires server-side analytics or a customer-facing return state

## Shared Payload Module

Add:

- `apps/web/src/global/b2c/analytics/commerce-events.ts`
- `apps/web/src/global/b2c/analytics/commerce-events.test.ts`

Suggested exports:

```ts
export function centsToAnalyticsValue(cents: number): number;

export function buildGa4CartItem(
  line: CartLine,
  options?: { quantity?: number; discountCents?: number },
): Record<string, unknown>;

export function buildGa4CartItems(
  cart: CartState,
): Array<Record<string, unknown>>;

export function buildMetaCartParams(
  cart: CartState,
  options?: { line?: CartLine; valueCents?: number },
): Record<string, unknown>;

export function trackB2cAddToCart(line: CartLine): string;
export function trackB2cRemoveFromCart(line: CartLine, quantity?: number): string;
export function trackB2cViewCart(cart: CartState): string;
export function trackB2cBeginCheckout(cart: CartState): string;
export function trackB2cAddPaymentInfo(args: {
  cart: CartState;
  orderNumber: string;
  paymentType: "przelewy24";
}): string;
export function trackB2cPurchase(payload: B2cPurchaseAnalyticsPayload): string;
```

The exact API can be adjusted during implementation, but the key rule is that components should call semantic helpers rather than assemble raw `trackEvent` payloads.

### GA4 Item Mapping

For cart lines:

- `item_id`: `line.productKey`
- `item_name`: `line.productName`
- `item_brand`: `line.brandName`
- `item_category`: `line.lineType`
- `item_variant`: standard configuration signature or `CPO`
- `price`: unit price in PLN
- `quantity`: line quantity or delta quantity
- `discount`: line discount in PLN, when available

For purchase order items:

- use persisted `order_items` fields
- do not recalculate from current Sanity or cart localStorage

### Meta Mapping

Common fields:

- `content_ids`: product keys
- `content_type`: `product`
- `content_name`: single product name where event is line-specific
- `value`: PLN value
- `currency`: `PLN`
- `num_items`: total quantity
- `line_type`: where useful
- `coupon`: where useful

### User Matching For Checkout And Purchase

For checkout/purchase events, pass a `user` object to `trackEvent` when available.

Suggested mapping:

- `email`: checkout email
- `phone`: checkout phone
- `first_name`
- `last_name`
- `city`
- `postal_code`
- `country_code: "pl"`
- `external_id`: customer profile id or order id if appropriate

Important:

- Do not add broad new localStorage persistence beyond what `trackEvent` already does through `mergeUserData(..., { persist: true })`.
- Confirm privacy expectations before using order id as `external_id`.

## Required Type Updates

### `track-event.ts`

Review `META_STANDARD_EVENTS`.

Current type union includes commerce events, but `META_STANDARD_EVENTS` currently contains:

- `PageView`
- `ViewContent`
- `Search`
- `AddToCart`
- `InitiateCheckout`
- `AddPaymentInfo`
- `Purchase`
- `CompleteRegistration`

Before adding commerce tracking, decide whether to add:

- `RemoveFromCart`
- `ViewCart`

If not added, they will use `trackCustom` instead of Meta standard `track`.

### GA4 Custom Events

If implementing optional custom events such as `checkout_error`, extend the GA4 event-name type union in `track-event.ts`.

Minimum v1 ecommerce events do not require custom GA4 type extensions beyond existing names.

## Implementation Steps

### Step 1 - Add Commerce Analytics Mapper

Files:

- add `apps/web/src/global/b2c/analytics/commerce-events.ts`
- add `apps/web/src/global/b2c/analytics/commerce-events.test.ts`

Implement:

- cents to decimal PLN helper
- cart line to GA4 item mapping
- order item to GA4 item mapping
- cart totals payload
- coupon extraction
- Meta params builders
- semantic tracking helpers

Tests:

- standard line maps product key/name/brand/options/quantity/price
- `CPO` line maps product key/name/brand/category/quantity/price
- discount is represented in PLN
- coupon is included when valid
- empty cart does not produce invalid value
- purchase payload includes transaction id and all items

### Step 2 - Track Product Views For `CPO`

File:

- `apps/web/src/app/certyfikowany-sprzet-uzywany/[slug]/page.tsx`

Add:

- `ProductViewTracker`

Acceptance:

- standard and `CPO` PDPs both emit product view events
- `CPO` price is included when `priceCents` is valid

### Step 3 - Track Add And Remove From Cart

Files:

- `apps/web/src/components/products/ProductHero/PricingSection.tsx`
- `apps/web/src/components/cpo/CpoProductHero/CpoProductInquirySection.tsx`
- `apps/web/src/components/b2c/CartPage/CartItemCard.tsx`

Add:

- `trackB2cAddToCart(line)` after line creation/add
- `trackB2cRemoveFromCart(line)` before or after remove
- optional quantity delta events

Acceptance:

- standard add emits one `add_to_cart`
- `CPO` add emits one `add_to_cart`
- cart page remove emits one `remove_from_cart`
- `CPO` PDP toggle removal emits one `remove_from_cart`
- no events are emitted for blocked or failed add attempts

### Step 4 - Track View Cart

File:

- `apps/web/src/components/b2c/CartPage/CartPageClient.tsx`

Add:

- `trackB2cViewCart(cart)` after hydration/runtime load when cart is non-empty
- ref/session guard to prevent duplicate on one cart page render cycle

Acceptance:

- non-empty cart page emits `view_cart`
- empty cart does not emit `view_cart`
- revalidation rerender does not duplicate event

### Step 5 - Track Begin Checkout

File:

- `apps/web/src/components/b2c/CartPage/CartPageClient.tsx`

Add:

- `trackB2cBeginCheckout(cart)` after cart runtime revalidation passes and before navigating to checkout

Acceptance:

- blocked cart does not emit `begin_checkout`
- successful cart-to-checkout navigation emits one `begin_checkout`
- coupon and discounts are included

### Step 6 - Track Payment Handoff

File:

- `apps/web/src/components/b2c/CheckoutPage/CheckoutForm.tsx`

Add:

- `trackB2cAddPaymentInfo({ cart, orderNumber, paymentType: "przelewy24" })` after successful `submitCheckout(...)` and before redirect
- pass checkout user matching fields if agreed

Acceptance:

- successful order persistence and payment registration emits `add_payment_info`
- validation errors do not emit `add_payment_info`
- price drift / cart invalid responses do not emit `add_payment_info`

### Step 7 - Extend Thank-You Loader With Paid Purchase Payload

File:

- `apps/web/src/global/b2c/checkout/server/load-thank-you-page.ts`

Add:

- paid-order analytics DTO
- query for order totals and order items when state is paid
- strict mapping from persisted order truth

Possible type:

```ts
export type CheckoutPurchaseAnalyticsPayload = {
  orderId: string;
  orderNumber: string;
  customerEmail: string | null;
  customerSnapshot: unknown;
  shippingAddressSnapshot: unknown;
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  couponCode: string | null;
  items: Array<{
    lineType: "standard" | "cpo";
    productKey: string;
    productName: string;
    brandName: string;
    quantity: number;
    unitPriceCents: number;
    lineDiscountTotalCents: number;
    lineTotalCents: number;
  }>;
};
```

Acceptance:

- paid thank-you data includes analytics payload
- awaiting-payment thank-you does not expose purchase payload
- invalid/not-found states do not expose purchase payload
- payload is based on Supabase `orders` and `order_items`, not local cart

### Step 8 - Add Purchase Tracker Component

Files:

- add `apps/web/src/app/podziekowania-za-zakup/ThankYouPurchaseTracker.tsx`
- update `apps/web/src/app/podziekowania-za-zakup/ThankYouPageContent.tsx`

Behavior:

- render only for paid state with purchase payload
- check storage key before emitting
- emit `trackB2cPurchase(payload)`
- mark tracked for `orderNumber`

Suggested storage:

- `localStorage` key: `audiofast:b2c-analytics:purchase`
- value: JSON object of tracked order numbers and timestamps

Acceptance:

- first paid thank-you view emits purchase
- page refresh does not emit duplicate purchase
- manual refresh does not emit duplicate purchase
- second distinct order can emit purchase

### Step 9 - Optional Diagnostic Events

Optional files:

- `CheckoutForm.tsx`
- `load-thank-you-page.ts`
- `payment-status.ts`

Optional events:

- checkout submit attempt
- checkout error
- payment pending
- payment expired
- payment failed/cancelled

Recommendation:

- keep these out of the first implementation unless the client/business specifically needs funnel-drop diagnostics before launch.
- The minimum launch set should be stable ecommerce events first.

## Testing Plan

### Unit Tests

Add tests for:

- mapping standard cart line to GA4 item
- mapping `CPO` cart line to GA4 item
- mapping cart state to Meta params
- mapping purchase order payload to GA4 purchase
- purchase dedupe helper
- coupon field inclusion
- discount conversion from cents to PLN

### Component Tests

Update or add focused tests for:

- `PricingSection` calls add-to-cart tracker
- `CpoProductInquirySection` calls add/remove tracker
- `CartPageClient` calls view-cart and begin-checkout tracker
- `CartItemCard` calls remove tracker
- `CheckoutForm` calls add-payment-info tracker on success
- `ThankYouPurchaseTracker` dedupes purchase per order number

Use `vi.mock("@/src/global/b2c/analytics/commerce-events", ...)` rather than asserting against provider globals.

### E2E Checks

Keep E2E analytics disabled by default:

- `E2E_DISABLE_ANALYTICS=1`

Do not make Playwright depend on GA4 or Meta availability.

Optional smoke:

- expose a test-only `window.trackEvent` spy in local manual testing
- verify `trackEvent` calls in browser console with consent accepted
- inspect GA4 DebugView and Meta test events manually in preview

### Manual Verification

On a preview/production-like deployment:

1. accept analytics and marketing consent
2. open a standard PDP and verify `view_item`
3. add standard product and verify `add_to_cart`
4. open cart and verify `view_cart`
5. remove item and verify `remove_from_cart`
6. repeat with `CPO` if buyable CPO content exists
7. go from cart to checkout and verify `begin_checkout`
8. submit checkout and verify `add_payment_info`
9. complete payment and verify `purchase`
10. refresh thank-you page and verify no duplicate purchase

## Acceptance Criteria

The commerce analytics implementation is complete for v1 when:

- standard and `CPO` product views are covered
- standard and `CPO` add-to-cart events are covered
- cart view is covered
- remove-from-cart is covered
- begin-checkout is covered only after valid cart revalidation
- payment handoff is covered only after successful order persistence and payment registration
- purchase is emitted only for paid orders
- purchase uses persisted order and order-item truth
- purchase dedupes by order number
- coupon and discount data are included where relevant
- no B2C component calls `gtag`, `fbq`, or `/api/analytics/meta` directly
- existing consent behavior remains centralized in `trackEvent`
- E2E remains isolated from external analytics providers
- tests cover the mapper and key emitting components

## Not In Scope For First Slice

- full Google Ads conversion action configuration
- new GTM `dataLayer` ecommerce push model
- server-side GA4 Measurement Protocol
- persistent analytics delivery queue
- partial-return or refund analytics
- admin operational analytics changes
- warehouse/shipment analytics
- item-level return analytics
- customer lifetime value reporting

## Risks And Open Decisions

### Purchase Delivery Reliability

Client-side purchase tracking can be blocked by:

- user not returning to thank-you
- consent denied
- browser blockers
- script failures

This is acceptable for v1 because the current analytics system is browser-first.

If the business later requires more reliable conversion delivery, add a server-side conversion architecture at the payment-confirmed boundary.

### Consent And User Data

Checkout has high-quality matching data.

Before passing full checkout identity into `trackEvent`, confirm:

- privacy policy coverage
- consent expectations
- whether `external_id` should be order id, customer profile id, or omitted

### Meta Standard Events

Confirm whether `ViewCart` and `RemoveFromCart` should be added to `META_STANDARD_EVENTS`.

If they are not added, current `trackEvent` will send them as `trackCustom`.

### Expired And Failed Payment Analytics

Expired payment currently resolves to an `expired` state in the loader, but the page rendering path treats non-paid/non-awaiting states as not found.

Do not promise expired/failure analytics until the customer-visible UX for those states is finalized.

### CPO Content Gate

Full `CPO` analytics manual/E2E verification depends on having a buyable `CPO` product:

- `isSellableOnline == true`
- `availabilityStatus == "available"`
- `priceCents > 0`

## Suggested Work Order

1. Add commerce analytics mapper and tests.
2. Add `CPO` product view tracking.
3. Add add/remove cart tracking.
4. Add view-cart tracking.
5. Add begin-checkout tracking.
6. Add add-payment-info tracking.
7. Extend thank-you paid analytics payload.
8. Add purchase tracker and dedupe.
9. Add component tests around event calls.
10. Manually verify in preview with analytics consent enabled.
11. Update Phase 08 / Phase 10 docs once Step `8.5` is implemented.

## Summary

The current web analytics foundation is already capable of sending commerce events to GA4, Meta Pixel, and Meta CAPI.

The missing work is mostly structured instrumentation:

- a shared B2C commerce analytics mapper
- real call sites across product/cart/checkout/thank-you
- paid-order purchase payload from Supabase truth
- purchase dedupe
- focused tests
- manual preview verification

This should be implemented as follow-up Step `8.5` after Phase 08, then verified as part of Phase 10 launch readiness.

