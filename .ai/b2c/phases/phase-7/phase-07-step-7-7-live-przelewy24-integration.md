# Phase 07 Step 7.7 - Live Przelewy24 Integration

Status: local implementation complete; Vercel preview sandbox rollout pending
Owner: planning
Last updated: 2026-05-05
Depends on: `phase-07-step-7-5-playwright-e2e-coverage.md`, `../phase-06-checkout-and-payments.md`, `../../architecture/payment-process-model.md`
Related files: `../../../apps/web/src/global/b2c/checkout/payment-contracts.ts`, `../../../apps/web/src/global/b2c/checkout/server/payment-provider.ts`, `../../../apps/web/src/global/b2c/checkout/server/payment-mock.ts`, `../../../apps/web/src/global/b2c/checkout/server/start-payment.ts`, `../../../apps/web/src/global/b2c/checkout/server/payment-status.ts`, `../../../apps/web/src/global/b2c/checkout/server/payment-update.ts`, `../../../apps/web/src/app/api/payment/status/route.ts`, `../../../apps/web/src/app/actions/checkout-submit.ts`, `../../../apps/web/.env.example`

## Purpose

Step 7.7 replaces the local Przelewy24-shaped mock with the real Przelewy24 REST provider.

Phase 06 deliberately built the checkout and payment architecture around the documented P24 flow while mocking the external provider boundary until account access existed. Phase 7.5 adds browser coverage for the current customer journey. Step 7.7 should now connect real P24 without rewriting checkout, order persistence, thank-you recovery, customer-panel order access, or paid-order side effects.

The implementation must preserve the accepted v1 payment model:

- checkout creates the order before provider handoff
- the order starts as `awaiting_payment`
- browser return is never payment truth
- P24 `urlStatus` notification plus server-side verification is payment truth
- only verified successful payment moves the order to `paid`
- duplicate provider events are idempotent
- no separate `payment_attempts` table in v1
- expired unpaid orders do not have a long-lived same-order retry path

## Stage 1 - Provider Readiness And Current Boundary

Status: completed for planning; `testAccess` still needs env-backed execution during Stage 2.

Goal: confirm the real P24 requirements and freeze the current application boundary before changing behavior.

### Current Application Boundary

The application already has the correct internal payment shape:

- checkout validates cart and form data
- checkout persists `orders` and `order_items`
- orders start in `awaiting_payment`
- orders already store `payment_provider`, `payment_reference`, `payment_verified_at`, `paid_at`, and `payable_until`
- `payment-update.ts` moves `awaiting_payment -> paid`
- duplicate successful confirmations are safe no-ops
- confirmation email and paid-profile persistence run after payment confirmation
- thank-you route resolves persisted order state
- customer panel hides expired `awaiting_payment` orders

The mock-specific parts to replace or isolate are:

- `payment-provider.ts` maps `przelewy24` to `mockPrzelewy24PaymentProviderAdapter`
- `payment-contracts.ts` hardcodes mock merchant id, pos id, and CRC values
- `start-payment.ts` fabricates a successful status notification immediately
- `/api/payment/status/` accepts an internal mock-shaped payload
- checkout currently returns the app thank-you URL rather than the provider panel URL
- E2E tests depend on the mock path and should keep using it by default

### P24 Documentation Inputs

Use these sources during implementation:

- sandbox setup: `https://www.przelewy24.pl/centrum-pomocy/wsparcie-techniczne-api/jak-zalozyc-srodowisko-testowe`
- developer docs: `https://developers.przelewy24.pl/index.php?pl`
- OpenAPI YAML checked during planning: `https://developers.przelewy24.pl/yaml/en_documentation_1.0.yaml`
- sign troubleshooting: `https://www.przelewy24.pl/en/help-center/api-technical-support/why-do-i-receive-notices-of-the-incorrect-control-sum-sign-p24-sign-during-transaction-registration-verification`

Important P24 facts for this phase:

- sandbox API base URL is `https://sandbox.przelewy24.pl/api/v1`
- production API base URL is `https://secure.przelewy24.pl/api/v1`
- payment-panel redirect uses `/trnRequest/{TOKEN}` outside `/api/v1`
- REST API uses Basic Auth
- Basic Auth user is the P24 account id / `posId`
- Basic Auth password is the API key / `secretId`
- `GET /api/v1/testAccess` validates credentials
- `POST /api/v1/transaction/register` returns a token
- P24 sends successful-payment notification to `urlStatus`
- browser return to `urlReturn` does not confirm payment
- merchant must call `PUT /api/v1/transaction/verify` after notification
- P24 says settlement depends on successful verification
- P24 recommends callback protection, including IP filtering where practical
- minimum TLS requirement is TLS 1.2
- P24 `orderId` may exceed signed 32-bit range, so treat it as bigint-safe

### Panel And Credential Preparation

Before coding against the real provider:

1. Confirm the sandbox account exists in the P24 panel.
2. Collect sandbox merchant id, pos id / user, API key / `secretId`, and CRC.
3. Confirm the app has a public HTTPS URL for `urlStatus`.
4. Confirm `BASE_URL` or request-origin handling creates the public app URL, not localhost, in the target sandbox deployment.
5. Run `GET /api/v1/testAccess` manually or through the future client once credentials exist.

### Confirmed Stage 1 Inputs

Confirmed on 2026-05-05:

- sandbox account is active
- sandbox account id / `posId` is `392337`
- production account id / `posId` is also `392337`
- sandbox and production both expose API credentials in the P24 panel
- for REST API auth, use the P24 account id / `posId` as Basic Auth user
- for REST API auth, use `Klucz do raportów` / `Klucz API` as Basic Auth password
- use `Klucz do CRC` for request signing
- `Klucz do zamówień` is not the REST Basic Auth key for this integration
- sandbox and production credentials must remain separate even though the account id is the same

Sandbox env mapping for later implementation:

- `P24_MODE=sandbox`
- `P24_MERCHANT_ID=392337`
- `P24_POS_ID=392337`
- `P24_API_KEY=<sandbox Klucz do raportów>`
- `P24_CRC=<sandbox Klucz do CRC>`

Production env mapping for later implementation:

- `P24_MODE=production`
- `P24_MERCHANT_ID=392337`
- `P24_POS_ID=392337`
- `P24_API_KEY=<production Klucz API>`
- `P24_CRC=<production Klucz do CRC>`

Chosen sandbox callback base:

- `https://audiofast-git-b2c-kryptonum.vercel.app/`

Derived sandbox URLs:

- `urlReturn`: `https://audiofast-git-b2c-kryptonum.vercel.app/podziekowania-za-zakup/[orderNumber]/`
- `urlStatus`: `https://audiofast-git-b2c-kryptonum.vercel.app/api/payment/status/`

Preview-domain verification:

- `https://audiofast-git-b2c-kryptonum.vercel.app/` responds publicly over HTTPS
- `https://audiofast-git-b2c-kryptonum.vercel.app/api/payment/status/` is reachable and returns `405` for non-POST requests, which is acceptable for the current POST-only payment callback route

Do not store P24 secrets in this planning file.

Do not paste P24 secrets into shell commands. Run `testAccess` through the Stage 2 env-backed client or through a local shell with temporary environment variables that are not committed or logged.

### Stage 1 Acceptance

Stage 1 is complete when:

- the current mock boundary is understood and unchanged
- sandbox credentials and public callback URL requirements are known
- production credential mapping is known but not needed for sandbox implementation
- open P24 doc ambiguities are recorded for sandbox verification

## Stage 2 - Server Configuration, Signatures, And P24 REST Client

Status: complete locally.

Goal: add the low-level live P24 foundation without changing checkout behavior yet.

### Config Module

Add a server-only config module.

Suggested file:

- `apps/web/src/global/b2c/checkout/server/p24-config.ts`

Required environment variables:

- `P24_MODE=sandbox|production`
- `P24_MERCHANT_ID`
- `P24_POS_ID`
- `P24_API_KEY`
- `P24_CRC`

Optional environment variables:

- `P24_API_BASE_URL`
- `P24_PANEL_BASE_URL`
- `P24_STATUS_ALLOWED_IPS`
- `P24_REQUEST_TIMEOUT_MS`
- `P24_FORCE_MOCK=1`

Derived defaults:

- sandbox API base: `https://sandbox.przelewy24.pl/api/v1`
- sandbox redirect base: `https://sandbox.przelewy24.pl`
- production API base: `https://secure.przelewy24.pl/api/v1`
- production redirect base: `https://secure.przelewy24.pl`
- request timeout: `10000` ms

Rules:

- config must be server-only
- missing config should fail loudly in live P24 mode
- local development without full P24 envs should continue to use mock
- E2E should default to mock
- production should not silently fall back to mock for real commerce
- do not expose API key or CRC through `NEXT_PUBLIC_*`

### Signature Helpers

Move P24 sign generation out of generic payment contracts.

Suggested file:

- `apps/web/src/global/b2c/checkout/server/p24-sign.ts`

Helpers:

- `buildP24RegistrationSign({ sessionId, merchantId, amount, currency, crc })`
- `buildP24VerificationSign({ sessionId, orderId, amount, currency, crc })`
- `buildP24NotificationSign(...)` only if required by the exact notification payload

Implementation rules:

- use SHA-384
- use stable JSON serialization matching the documented property order
- do not sort keys unless P24 explicitly requires it
- avoid legacy string concatenation unless sandbox proves the current account requires it
- account for the P24 PHP examples that reference `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`

Open ambiguity to verify in sandbox:

- current REST documentation describes JSON-shaped sign input, while the existing mock registration sign uses string concatenation
- the implementation must be proven with sandbox credentials before production activation

### REST Client

Add a small local REST client.

Suggested file:

- `apps/web/src/global/b2c/checkout/server/p24-client.ts`

Responsibilities:

- build Basic Auth header from `posId` and `P24_API_KEY`
- call `GET /testAccess`
- call `POST /transaction/register`
- call `PUT /transaction/verify`
- parse P24 success and error responses
- apply request timeout
- return typed errors with safe messages
- avoid logging API key, CRC, full customer data, or full payloads

Do not introduce a broad SDK abstraction in v1. A focused client is enough.

### Tests

Add unit tests for:

- config parsing
- missing env behavior
- sandbox vs production URL derivation
- Basic Auth header construction without leaking secrets in snapshots
- registration sign generation
- verification sign generation
- P24 error response mapping
- request timeout behavior if implemented locally

### Stage 2 Acceptance

Stage 2 is complete when:

- P24 config is server-only and tested
- sign helpers are isolated and tested
- P24 client can call `testAccess`, registration, and verification through mocked `fetch`
- `.env.example` documents the new variables
- checkout still behaves exactly as before unless explicitly configured otherwise

Local completion notes:

- added `p24-config.ts`, `p24-sign.ts`, and `p24-client.ts`
- added focused tests for config, signing, and client behavior
- added local sandbox P24 values to `.env.local`
- kept `.env.e2e.local` forced to mock with `P24_FORCE_MOCK=1`
- sandbox `testAccess` succeeds locally for account `392337`
- production `testAccess` still requires production-side IP/API access configuration before it can be validated from this machine

## Stage 3 - Real Provider Adapter And Registration Handoff

Status: complete locally; real redirect must still be manually verified on Vercel preview.

Goal: add the real adapter and make live mode redirect customers to P24 instead of simulating success.

### Real Adapter

Add the real adapter next to the mock adapter.

Suggested file:

- `apps/web/src/global/b2c/checkout/server/payment-przelewy24.ts`

The adapter should implement the current `CheckoutPaymentProviderAdapter` responsibilities where possible:

- `registerTransaction(input)`
- `verifyTransaction(input)`
- conversion from P24 responses to internal result types
- live-specific parsing helpers where needed

The provider registry should choose between mock and real adapter by explicit config.

Expected selection behavior:

- local development without P24 envs uses mock
- E2E uses mock
- sandbox/live environments with full P24 envs use real adapter
- production should fail clearly if configured for live P24 but missing credentials

The rest of checkout should not need to know whether the provider is mock or real.

### Registration Payload

Registration should continue to be built from the persisted checkout order draft.

Required P24 fields for v1:

- `merchantId`
- `posId`
- `sessionId`
- `amount`
- `currency`
- `description`
- `email`
- `country`
- `language`
- `urlReturn`
- `urlStatus`
- `sign`

Recommended fields already available:

- `client`
- `address`
- `zip`
- `city`
- `phone`
- `timeLimit`
- `channel`
- `transferLabel`
- `cart`

Mapping decisions:

- `sessionId` should remain the Audiofast public order number unless sandbox rejects that format
- `amount` is `grandTotalCents`
- `currency` remains `PLN`
- `language` remains `pl`
- `country` remains `PL`
- `timeLimit` should match the accepted 15-minute `payable_until` model if P24 accepts it
- `description` should include the order number
- `transferLabel` must stay within P24 length and character requirements
- cart submission should become optional if P24 rejects the current cart shape

Open ambiguity to verify:

- the OpenAPI schema references `ttl` as required while the field description uses `timeLimit`
- sandbox should decide whether v1 sends `timeLimit`, `ttl`, or both

### Checkout Handoff

Change live-mode payment start behavior.

Required behavior:

- checkout creates the order as today
- live adapter registers the transaction with P24
- live mode returns `registration.redirectUrl`
- browser redirects to `https://sandbox.przelewy24.pl/trnRequest/{TOKEN}` or `https://secure.przelewy24.pl/trnRequest/{TOKEN}`

Live mode must not:

- fabricate a status notification
- call `handleCheckoutPaymentStatusNotification` during checkout submit
- mark the order paid before notification and verification
- show final paid success on browser return alone

Mock mode may keep the current immediate-confirmation shortcut for local and E2E speed.

### Tests

Add server tests for:

- adapter registration success with mocked `fetch`
- adapter registration failure with mocked `fetch`
- provider registry chooses mock in mock mode
- provider registry chooses real adapter in live mode
- `start-payment.ts` returns provider redirect URL in live mode
- `start-payment.ts` does not internally confirm payment in live mode
- mock mode still supports the Phase 7.5 E2E path

### Stage 3 Acceptance

Stage 3 is complete when:

- real adapter can register a transaction through mocked tests
- live checkout returns a P24 panel URL
- mock checkout remains unchanged for default development and E2E
- no live-mode code path marks payment as paid during checkout submit

Local completion notes:

- added `payment-przelewy24.ts`
- provider selection now uses the live adapter in `sandbox` / `production` mode and mock adapter in mock mode
- live adapter maps checkout registration input into a P24 REST registration request with config-backed merchant id, pos id, CRC, and sign
- live `start-payment.ts` returns the provider redirect URL and does not call internal payment confirmation
- mock mode keeps the Phase 7.5 immediate-confirmation path

## Stage 4 - Notification Route And Verification

Status: complete locally; real P24 callback payload still needs sandbox verification on Vercel preview.

Goal: process real P24 callbacks and use server-to-server verification to confirm orders.

### Raw Notification Parsing

The current `/api/payment/status/` route accepts an internal mock-shaped payload. Live mode needs a parser for the raw P24 JSON notification.

Suggested responsibilities:

- accept only `POST`
- parse JSON body
- validate expected merchant id and pos id
- validate notification sign if the real notification payload includes the documented sign
- normalize raw P24 notification into the internal payment notification shape
- optionally reject unexpected source IPs when `P24_STATUS_ALLOWED_IPS` is configured
- call `handleCheckoutPaymentStatusNotification`
- return simple JSON for observability

Do not rely on IP allowlisting alone. It is defense in depth, not the main authenticity control.

Suggested route responses:

- `200` for successfully processed or idempotently repeated valid notifications
- `400` for malformed payloads
- `401` or `403` for failed authenticity checks
- `500` only for internal failures that should be retried

Open ambiguity to verify:

- exact raw P24 notification payload sent to `urlStatus`
- exact sign validation requirements for the current REST notification
- whether P24 sends only successful-payment notifications for this integration mode

### Verification

After a successful-looking notification, call `PUT /api/v1/transaction/verify`.

Verification request fields:

- `merchantId`
- `posId`
- `sessionId`
- `amount`
- `currency`
- `orderId`
- `sign`

Verification must use:

- persisted order amount, not blindly the notification amount
- persisted currency, currently `PLN`
- provider `orderId` from notification
- session id from notification, matched to internal order number
- CRC from server-only config

Verification success should call the existing `confirmCheckoutOrderPayment`.

Verification failure must not:

- mark the order paid
- send confirmation email
- persist paid customer profile
- increment coupon usage
- move CPO final availability state, if that side effect is added later

### Internal Contract Adjustments

Keep a clear split between raw provider payload and normalized internal payload.

Likely changes:

- add a raw P24 notification type
- keep `P24StatusNotificationPayload` as normalized internal data
- make provider `orderId` bigint-safe if needed
- choose a stable `payment_reference`

Recommended v1 storage:

- keep `payment_reference` human-debuggable
- use `p24:{orderId}` if no better stable payment id exists
- keep raw provider details out of customer-visible status history

Do not add a `payment_attempts` table unless sandbox exposes a blocker that cannot be handled with current order fields.

### Tests

Add tests for:

- raw notification parser
- malformed notification rejection
- merchant / pos mismatch rejection
- sign validation success and failure when applicable
- amount, currency, and session mismatch handling
- adapter verification success with mocked `fetch`
- adapter verification failure with mocked `fetch`
- `/api/payment/status/` processes valid normalized payloads
- duplicate valid notification remains idempotent

### Stage 4 Acceptance

Stage 4 is complete when:

- real P24 notifications can be parsed and validated
- verification uses persisted order truth
- verified successful payment moves order to `paid`
- failed verification leaves order non-final
- duplicate valid notification does not duplicate email or paid side effects
- route error responses distinguish malformed/authenticity failures from retryable internal failures

Local completion notes:

- added `p24-notification.ts`
- `/api/payment/status/` now parses raw P24 transaction-result JSON in live mode
- callback parsing validates merchant id, pos id, and notification sign
- internal mock-shaped notifications remain accepted only in mock mode
- verification signs now use server-only live CRC in live mode and mock CRC in mock mode
- existing `confirmCheckoutOrderPayment` remains the only transition into `paid`

## Stage 5 - Return, Thank-You, And Failure States

Status: complete locally for current route behavior; browser-level preview verification pending.

Goal: make the customer-facing post-payment experience correct when payment confirmation is asynchronous.

### Thank-You Behavior

The thank-you route should continue to resolve persisted order state.

Required real-provider behavior:

- `awaiting_payment` and not expired means pending verification
- `paid` means confirmed purchase
- expired without verification means expired / non-final
- `urlReturn` alone never shows final success

The page may add automatic polling, but not through the write-only provider callback route.

If polling is added:

- use a read-only payment/order-status endpoint
- keep polling short
- stop once order is `paid` or expired

If polling is not added in this stage:

- server-render current state
- show clear pending messaging
- allow manual refresh

### Failure Handling

Registration failure:

- checkout should not redirect
- user should see payment initiation failure and support guidance
- created order may remain `awaiting_payment` until the short window expires
- do not add a new public order status in v1

Customer cancellation:

- order remains `awaiting_payment`
- after `payable_until`, order disappears from normal customer-visible active list

Webhook never arrives:

- order remains `awaiting_payment`
- no confirmation email is sent
- no paid side effects run

Verification fails:

- order remains `awaiting_payment`
- route should return a retryable error only when retry is appropriate
- logs should include order number, session id, provider order id, and safe error code

Webhook arrives after `payable_until`:

- current model rejects confirmation after expiry
- implementation must verify whether P24 can legitimately send a successful verified payment after the configured 15-minute limit
- if P24 can verify late for an on-time payment, compare provider transaction time rather than webhook arrival time

### Tests

Add tests for:

- return page does not confirm payment from `urlReturn`
- active `awaiting_payment` order shows pending state
- paid order shows confirmed state
- expired awaiting-payment order shows non-final state
- registration failure does not mark order paid
- late webhook behavior matches the final accepted expiry rule

### Stage 5 Acceptance

Stage 5 is complete when:

- browser return cannot create false success
- customer sees coherent pending, confirmed, and expired states
- no paid side effects run without verified provider truth
- existing customer-panel visibility rules still hold for active and expired `awaiting_payment` orders

Local completion notes:

- live checkout no longer auto-confirms payment before provider notification
- the existing thank-you state loader continues to resolve persisted order state
- the current implementation keeps pending/non-final behavior dependent on order state, not the browser return alone
- no new long-lived same-order retry path was introduced

## Stage 6 - Test Coverage And Default E2E Preservation

Status: complete locally.

Goal: prove the provider boundary while keeping the normal browser suite deterministic.

### Unit And Server Coverage

By the end of this stage, focused tests should cover:

- config parsing
- sign generation
- P24 REST client success and failure
- provider adapter success and failure
- provider registry mode selection
- registration handoff
- notification parsing
- verification
- idempotency
- thank-you state behavior

### Playwright Coverage

Keep normal Phase 7.5 Playwright tests on the local mock provider.

Rules:

- default E2E must not depend on P24 sandbox availability
- E2E-owned Supabase data remains artificial and deterministic
- mock P24 remains the browser-test default
- outbound email, Mailchimp, and analytics remain isolated as defined in Phase 7.5

Optional provider smoke test:

- separate command or Playwright project
- opt-in only
- sandbox only
- allowed to be slower and less deterministic
- used for manual/pre-release verification, not regular CI

### Stage 6 Acceptance

Stage 6 is complete when:

- default E2E still passes on mock provider
- live provider behavior is covered by focused unit/server tests
- optional sandbox smoke coverage is documented if added
- `.env.e2e.example` and E2E README still make the mock-provider default clear

Local completion notes:

- added focused tests for live registration, live verification, raw notification parsing, sign validation, and live `start-payment`
- kept `.env.e2e.example` and `.env.e2e.local` on `P24_FORCE_MOCK=1`
- default Playwright behavior remains mock-backed
- no opt-in sandbox Playwright smoke test was added in this local implementation slice

## Stage 7 - Minimal Sandbox And Production Rollout

Status: pending; user will handle Vercel preview configuration and manual sandbox rollout.

Goal: activate the already-tested implementation with the smallest practical deployment process.

### Sandbox Rollout

1. Enable `P24_MODE=sandbox` in a non-production environment.
2. Add sandbox merchant id, pos id, API key, and CRC.
3. Run `testAccess`.
4. Run one manual sandbox checkout.
5. Confirm transaction appears in the P24 sandbox panel.
6. Complete payment.
7. Confirm `/api/payment/status/` receives notification.
8. Confirm Supabase order moves from `awaiting_payment` to `paid`.
9. Confirm thank-you page, confirmation email behavior, and customer-panel visibility.

### Production Rollout

1. Add production credentials only to production.
2. Confirm generated `urlReturn` and `urlStatus` use the production domain.
3. Run production `testAccess`.
4. Enable production P24.
5. Monitor the first real payments against both P24 panel and Supabase order state.

### Stage 7 Acceptance

Step 7.7 is complete when:

- mock provider remains available for local development and default E2E
- sandbox P24 credentials pass `testAccess`
- checkout registers a real sandbox P24 transaction
- browser redirects to the P24 transaction panel
- return to thank-you does not falsely confirm payment
- real P24 `urlStatus` notification is received and verified
- verified payment moves order from `awaiting_payment` to `paid`
- duplicate notification does not send duplicate email or duplicate paid side effects
- failed, cancelled, or abandoned payment leaves order non-final
- expired unpaid orders stay hidden from normal active customer order access
- `.env.example` and internal docs describe required P24 setup

## Deferred From Step 7.7

These belong outside this phase:

- admin order-management UI
- refunds and operator refund processing
- P24 card one-click
- BLIK alias flows
- Google Pay and Apple Pay direct integrations
- split payment
- white-label payment method selection on Audiofast checkout
- long-lived retry on the same order
- separate `payment_attempts` table
- customer-facing provider callback history
