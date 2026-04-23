# Phase 06 Remaining Implementation Gaps

Status: active follow-up
Scope: work still remaining after removing the temporary checkout debug hook and restoring cart clearing on confirmed paid success
Last updated: 2026-04-22

## What This File Covers

This note tracks the Phase 06 work that still remains after the recent cleanup:

- removed temporary forced invalid-cart debug behavior in checkout submit
- restored cart clearing on confirmed paid thank-you resolution

The items below are the higher-value remaining gaps that still matter before Phase 06 can be considered fully complete, assuming the live `Przelewy24` provider swap will happen separately in the next few days.

This note intentionally focuses only on the still-open points:

1. post-payment account/profile persistence
2. confirmation email after verified payment success
3. shell-level wiring still missing from the storefront journey
4. browser-level transaction coverage and hardening

## Current Practical Position

The current implementation already covers the most important internal architecture:

- checkout form capture and validation
- authenticated prefill and email locking
- server-side cart revalidation and hard final validation
- order creation in `awaiting_payment`
- mock `Przelewy24`-shaped registration contracts
- backend-first payment confirmation path
- thank-you state resolution for `awaiting_payment`, `paid`, `expired`, and `invalid_access`
- idempotent payment confirmation updates

The remaining work is therefore mostly about **post-success side effects and finish-line integration polish**, not about redesigning the checkout or payment core.

## 1. Post-Payment Account / Profile Persistence

### Why This Is Still Incomplete

The checkout submit flow already computes the `profilePersistence` decision and stores it inside the order draft, but that decision is not yet acted on after verified payment success.

Today the code can:

- read `customer_profiles`
- prefill checkout from an authenticated profile
- decide whether a profile should be created/updated after successful payment

But it does **not** yet:

- ensure the customer profile exists after a paid order
- store checkout defaults after payment when `saveToProfile` is checked
- update an existing profile with the latest defaults after payment when the rules allow it

### Current Source Files

- `apps/web/src/global/b2c/checkout/profile.ts`
- `apps/web/src/global/b2c/checkout/order-draft.ts`
- `apps/web/src/global/b2c/checkout/server/submit-checkout.ts`
- `apps/web/src/global/b2c/checkout/server/payment-status.ts`
- `apps/web/src/global/b2c/checkout/server/payment-update.ts`
- `apps/web/src/global/b2c/checkout/server/auth-context.ts`

### Missing Implementation Shape

Add a dedicated post-payment profile persistence path that runs only after payment is verified and the order is confirmed as paid.

Preferred direction:

1. load the paid order after `confirmCheckoutOrderPayment(...)`
2. inspect the stored `profilePersistence` decision from the order snapshot/draft data
3. ensure a `customer_profiles` row exists
4. only write checkout defaults when `shouldStoreCheckoutDefaultsAfterSuccessfulPayment === true`
5. keep this side effect non-destructive and idempotent

### Acceptance Criteria

- guest paid order can create a lightweight customer profile when required
- authenticated paid order can update the linked profile
- `saveToProfile` controls default-address/default-invoice storage, not whether account existence is ensured
- repeated payment notifications do not duplicate or corrupt profile writes

## 2. Confirmation Email After Verified Payment Success

### Why This Is Still Incomplete

The checkout flow already sends newsletter opt-in to Mailchimp during submit, but the real purchase confirmation email is not yet triggered from the payment-confirmed path.

Phase 06 requires confirmation email to happen only after verified payment success, not merely after order creation.

### Current Source Files

- `apps/web/src/global/b2c/checkout/server/payment-status.ts`
- `apps/web/src/global/b2c/checkout/server/payment-update.ts`
- `apps/web/src/global/b2c/checkout/server/load-thank-you-page.ts`
- `apps/web/src/emails/**`
- `apps/web/src/global/microsoft-graph/**`

### Missing Implementation Shape

Add a post-confirmation email side effect immediately after the order is confirmed as paid.

Preferred direction:

1. treat `confirmCheckoutOrderPayment(...)` as the point where payment truth becomes final
2. only trigger the email when the order transitions into confirmed paid success
3. keep duplicate notification handling idempotent so repeated notifications do not resend the same email unintentionally
4. log failures clearly without breaking payment confirmation itself

### Acceptance Criteria

- confirmation email is triggered only after verified backend payment success
- duplicate notifications do not spam duplicate emails
- email send failures do not roll back payment confirmation

## 3. Shell-Level Wiring Still Missing

### Why This Is Still Incomplete

The main journey works, but the storefront shell is not fully finished according to the original Phase 06 expectation.

The most important shell-level gap that was restored in cleanup is:

- cart is now cleared after confirmed paid success

The remaining shell-level work is mostly about funnel wiring rather than core payment rules.

### Remaining Shell Tasks

#### Analytics

The repo already has analytics infrastructure, but the checkout/payment funnel events are not yet wired into this flow.

Expected events:

- `begin_checkout`
- payment start
- purchase confirmed
- payment failure / expiration where useful

Likely files:

- `apps/web/src/global/analytics/track-event.ts`
- `apps/web/src/components/b2c/CheckoutPage/CheckoutForm.tsx`
- thank-you route/UI files

#### Recovery / Navigation Polish

Review whether any additional shell polish is still needed around:

- loading behavior during thank-you refresh
- CTA wording for pending verification / expired flows
- return-to-checkout or return-to-store transitions

This should stay thin and must not become a second place where payment rules are duplicated.

### Acceptance Criteria

- funnel analytics are emitted from the real checkout/payment path
- no business rules are duplicated in analytics/shell code
- thank-you state transitions remain coherent when users navigate back and forth

## 4. Browser-Level Coverage And Hardening

### Why This Is Still Incomplete

There is no Playwright setup yet and no browser-level end-to-end coverage for the cart -> checkout -> payment -> thank-you flow.

This is still required by the Phase 06 done criteria.

### Missing Coverage

At minimum the first browser suite should cover:

1. standard product -> cart -> checkout -> mock payment success
2. delayed payment confirmation (`return_before_status`) with thank-you refresh
3. expired unpaid-order behavior
4. cart price change / blocked cart recovery

### Suggested File Set

- `playwright.config.*`
- `apps/web/e2e/**` or repo-level `e2e/**`
- minimal test fixtures/helpers for:
  - seeded cart setup
  - mock scenario selection
  - thank-you assertions

### Acceptance Criteria

- Playwright is installed and runnable
- at least the critical cart -> checkout -> payment success path is covered
- delayed confirmation and thank-you recovery have browser-level proof

## Recommended Remaining Order

If the live provider replacement is about to begin, the best practical order is:

1. post-payment profile/default persistence
2. confirmation email on verified paid success
3. shell-level analytics wiring
4. Playwright critical-path coverage

## Definition Of "Phase 06 Fully Complete" After These Items

After the items in this file are complete, Phase 06 should be considered finished enough that the remaining future work is only:

- live `Przelewy24` provider replacement
- customer panel (`Phase 07`)
- admin panel (`Phase 08`)

At that point the mock implementation would no longer be the limiting factor for the B2C checkout flow.
