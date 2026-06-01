# Playwright E2E Tests

This folder is for browser-level tests that exercise the B2C customer journey
through the real Next.js app.

## Local Commands

Run the E2E suite:

```bash
bun run test:e2e
```

Open Playwright UI mode:

```bash
bun run test:e2e:ui
```

Run with a visible browser:

```bash
bun run test:e2e:headed
```

Open the last HTML report:

```bash
bun run test:e2e:report
```

## Environment

Local E2E runs use `apps/web/.env.e2e.local`. That file points the app at the
dedicated `audiofast-test` Supabase project and is ignored by Git.

Keep these safety switches enabled for Playwright runs:

```env
E2E_MOCK_EMAILS=1
E2E_MOCK_MAILCHIMP=1
E2E_DISABLE_ANALYTICS=1
```

They prevent E2E tests from sending real Microsoft Graph emails, touching
Mailchimp, or dispatching Meta Conversion API events.

The app server is started automatically by `playwright.config.ts` on
`http://127.0.0.1:3100` unless `PLAYWRIGHT_PORT` or `PLAYWRIGHT_BASE_URL` is set.

## Scope

The suite currently runs Chromium only. After local P0 coverage stays stable,
add Firefox/WebKit projects to broaden browser coverage.

Playwright projects:

- `auth.setup` seeds and authenticates the reusable customer.
- `chromium` runs unauthenticated/guest browser flows.
- `chromium-authenticated` starts with the stored customer session.

## Current Tests

`guest-checkout.spec.ts` covers the first critical browser journey:

1. opens `/produkty/prestige/`
2. adds the product to the cart
3. proceeds to `/koszyk/twoje-dane/`
4. fills the guest checkout form
5. accepts the required consent
6. submits the order through the mock payment path
7. verifies the paid thank-you page
8. verifies the paid order row in Supabase

The test uses a unique `e2e+guest-checkout-...@audiofast.test` email and cleans
only rows owned by that email from `orders`, `order_items`,
`order_cancellation_requests`, `return_cases`, and `customer_profiles`.

`guest-checkout-validation.spec.ts` covers the incomplete-checkout guard:

1. prepares a cart with `/produkty/prestige/`
2. opens checkout
3. fills only the guest email
4. submits the form
5. verifies required-field and required-consent errors
6. verifies that no `orders` row exists for that test email

Shared E2E helpers live next to the specs:

- `constants.ts` stores stable E2E values such as email prefixes
- `utils.ts` stores helper functions for test emails, Supabase admin access,
  targeted cleanup, seeded orders, auth helper login, cart setup, checkout form
  filling, and DB assertions

## Authenticated Customer Tests

Authenticated customer-panel specs use Playwright `storageState`.

`auth.setup.ts` cleans the reusable customer email, seeds a deterministic paid
order, logs in through the protected `/api/e2e/customer-auth/` helper, verifies
the orders page, and writes the browser state to `e2e/.auth/customer.json`.

`customer-authenticated-panel.spec.ts` then starts with that stored state and
verifies that the seeded order appears in `/konto-klienta/zamowienia/` and opens
its detail page.

`checkout-auth-roundtrip.spec.ts` verifies:

1. a logged-out customer is redirected from a protected order-detail URL to the
   login gateway with `returnTo`
2. the E2E auth helper returns that customer to the original order detail
3. a guest cart survives the checkout login CTA roundtrip
4. authenticated checkout locks the email field and renders authenticated
   consent/profile UI

`customer-authenticated-checkout.spec.ts` verifies:

1. seeded profile defaults prefill checkout
2. the customer can save updated future-order data during checkout
3. Supabase `customer_profiles` receives the updated defaults
4. a later checkout preloads those updated defaults

## P1 Customer Journey Tests

`cart-revalidation-drift.spec.ts` verifies that checkout stops the first payment
submit when the browser cart has stale pricing, shows the customer a price
refresh warning, and only creates the paid order after the refreshed totals are
accepted.

`coupon.spec.ts` verifies two coupon paths:

1. a valid fixed-order coupon can be applied in cart, remains visible in
   checkout, and is persisted on the paid order in Supabase
2. a coupon that becomes inactive after being stored in the cart is removed on
   cart reload with a visible warning

`customer-authenticated-account.spec.ts` verifies that the customer can edit
account defaults, that future checkout uses the changed defaults, and that
historical order snapshots still render the original order-time data.

`customer-authenticated-cancellation.spec.ts` verifies the customer-side order
cancellation entry point: the request modal opens, the request is submitted, the
detail page moves into pending state, and duplicate request entry is removed.

`cpo-purchase.spec.ts` contains the P1 CPO purchase journey. It currently skips
itself when Sanity has no CPO product with `isSellableOnline == true`,
`availabilityStatus == "available"`, and `priceCents > 0`. Once that content
exists, the same spec will run the CPO add/remove/cart/checkout path.

The E2E auth helper is guarded by:

- `E2E_AUTH_HELPER=1`
- `E2E_AUTH_HELPER_SECRET`
- a non-production environment check
- an `e2e+...@audiofast.test` email restriction

The generated `e2e/.auth` directory contains session cookies and is ignored by
Git.
