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

## Initial Scope

Start with `chromium` only. After the seed data and first purchase/customer-panel
flow are stable, add Firefox/WebKit projects to broaden browser coverage.

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
- `utils.ts` stores helper functions for test emails, Supabase admin access, and
  targeted cleanup

## Authenticated Customer Tests

Authenticated customer-panel specs use Playwright `storageState`.

`auth.setup.ts` logs in the reusable E2E customer through the protected
`/api/e2e/customer-auth/` helper, verifies the orders page, and writes the
browser state to `e2e/.auth/customer.json`.

`customer-authenticated-panel.spec.ts` then starts with that stored state and
verifies that `/konto-klienta/zamowienia/` opens as an authenticated customer.

The E2E auth helper is guarded by:

- `E2E_AUTH_HELPER=1`
- `E2E_AUTH_HELPER_SECRET`
- a non-production environment check
- an `e2e+...@audiofast.test` email restriction

The generated `e2e/.auth` directory contains session cookies and is ignored by
Git.
