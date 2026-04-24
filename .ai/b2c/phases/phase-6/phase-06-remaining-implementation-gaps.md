# Phase 06 Remaining Implementation Gaps

Status: closed / archived
Scope: historical note for the Phase 06 gaps that were either completed or intentionally moved into later phases
Last updated: 2026-04-23

## What This File Covers

This note originally tracked the Phase 06 work that still remained after the checkout/payment cleanup cycle.

That follow-up is now closed.

The important outcome is:

- post-payment account/profile persistence was completed
- confirmation email after verified paid success was completed
- shell-level checkout/payment runtime wiring is complete enough for Phase 06 closure
- analytics and browser-level Playwright coverage were intentionally moved out of Phase 06

Phase 06 therefore no longer has blocking implementation gaps.

## Current Practical Position

The current implementation already covers the full checkout/payment scope that Phase 06 needed to deliver:

- checkout form capture and validation
- authenticated prefill and email locking
- server-side cart revalidation and hard final validation
- order creation in `awaiting_payment`
- mock `Przelewy24`-shaped registration contracts
- backend-first payment confirmation path
- thank-you state resolution for `awaiting_payment`, `paid`, `expired`, and `invalid_access`
- idempotent payment confirmation updates
- post-payment profile persistence
- confirmation email after verified payment success

The remaining work is therefore no longer Phase-06-core work.

It is follow-up work that belongs to later milestones.

## Where The Deferred Items Moved

### 7.5 - Playwright After The Customer Panel

Browser-level end-to-end coverage should land only after `Phase 07` is complete.

The reason is practical: once the customer panel exists, the first critical browser suite can validate the broader post-purchase journey instead of only the checkout slice in isolation.

This follow-up step should also absorb the mocked integration journeys that depend on both real `Supabase` auth/session behavior and the local payment mock.

That means the accepted `7.5` ownership includes:

- checkout -> local mock payment -> thank-you happy path
- thank-you -> OTP login -> protected order access recovery
- checkout login CTA -> OTP login -> return-to-checkout roundtrip
- authenticated checkout prefill / locked-email behavior in a real browser session

Those cases are better treated as one `Playwright` path with the real browser/runtime state than as scattered mock-heavy integration tests in earlier implementation steps.

So the accepted sequencing is now:

1. complete `Phase 07` customer-panel implementation
2. add `Playwright` as a follow-up step `7.5`

### 8.5 - Analytics After Admin Operations

Commerce analytics should be treated as a late implementation / pre-launch step after `Phase 08` admin operations are in place.

The reason is similar: the analytics model should reflect the real final funnel rather than an intermediate implementation state.

So the accepted sequencing is now:

1. complete `Phase 08` admin operations
2. add commerce analytics instrumentation as a follow-up step `8.5`

## Historical Gap Notes

The sections below are kept only as historical planning context for work that was open during the implementation cycle.

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
- document clearly how customer profile creation differs from authenticated identity creation
- define the checkout -> login -> checkout return behavior around later authenticated prefill

### Current Source Files

- `apps/web/src/global/b2c/checkout/profile.ts`
- `apps/web/src/global/b2c/checkout/order-draft.ts`
- `apps/web/src/global/b2c/checkout/server/submit-checkout.ts`
- `apps/web/src/global/b2c/checkout/server/payment-status.ts`
- `apps/web/src/global/b2c/checkout/server/payment-update.ts`
- `apps/web/src/global/b2c/checkout/server/auth-context.ts`

### Important Distinction: Profile Row vs Auth Identity

This implementation must keep two layers separate:

- `customer_profiles` is the reusable business/customer defaults layer
- `Supabase Auth` is the verified login/session identity layer

For Phase 06 the accepted rule should be:

- do **not** create or mutate reusable customer data when the order is merely created in `awaiting_payment`
- create or update the lightweight `customer_profiles` row only after verified paid success
- do **not** require password-based registration to make this work

The current architecture direction elsewhere in the B2C docs is:

- passwordless email-based auth through `Supabase Auth`
- currently documented as OTP / one-time code rather than password login
- `customer_profiles.auth_user_id` is linked later to the verified auth identity

This means Phase 06 should treat checkout profile persistence as a **commerce-side profile concern**, not as a full auth-account-creation concern.

### Scenario Rules To Implement

#### 1. Guest checkout, email has no existing profile

After verified paid success:

- create a lightweight `customer_profiles` row for that email
- link the paid order to that profile
- do not require the customer to be logged in at purchase time
- do not create a password-based account flow

The thank-you page remains guest-facing and can tell the customer they can later access the order through the customer-panel login entry.

#### 2. Guest checkout, email already belongs to an existing profile

After verified paid success:

- link the paid order to the existing `customer_profiles` row
- do **not** overwrite saved reusable defaults because the customer was not authenticated
- keep the thank-you page guest-facing

Important protection rule:

- guest checkout must remain guest-like even when the email already exists
- the flow must not reveal reusable saved-data existence through checkout behavior

#### 3. Authenticated checkout, no data changes

After verified paid success:

- link the paid order to the authenticated customer profile
- no profile update is needed

#### 4. Authenticated checkout, data changed, `saveToProfile = false`

After verified paid success:

- preserve the changed order snapshot inside the order itself
- do **not** update reusable profile defaults

This keeps order truth and reusable future defaults separate.

#### 5. Authenticated checkout, data changed, `saveToProfile = true`

After verified paid success:

- preserve the changed order snapshot inside the order
- update reusable profile defaults for future checkout use

This should reuse the existing checkbox already present in checkout. No extra popup is required.

### Rules That Must Stay True

- profile/default writes happen only after `paid`, never on order creation
- guest checkout must never overwrite existing reusable defaults
- authenticated changes affect reusable defaults only when `saveToProfile` is checked
- order snapshots always preserve purchase-time truth even when profile defaults are not updated
- repeated payment notifications must not duplicate profile creation or apply conflicting updates

### Checkout -> Login -> Checkout Behavior

This follow-up implementation should also preserve the accepted guest-first login behavior:

- checkout includes a login CTA for returning customers
- if the guest starts auth from checkout, successful auth should return them to checkout, not to the customer panel landing page
- after returning authenticated:
  - the cart should still be present
  - checkout should reload with authenticated prefill
  - the checkout email should become locked

Important v1 limitation:

- unsaved guest-typed form data does not need to survive that auth roundtrip
- server-side profile prefill remains the only accepted source for returning authenticated defaults

### Auth UX Direction For Later Customer Access

The later customer access flow should rely on email-based passwordless auth rather than classic password registration.

Current accepted direction in the architecture docs:

- email OTP / one-time code through `Supabase Auth`
- no custom password-first registration step required

If this direction later changes to magic-link email instead of OTP code, the profile-linking model below still remains valid:

1. checkout creates/updates only the commerce-side `customer_profiles` row after paid success
2. later customer-panel auth verifies email ownership through `Supabase Auth`
3. after successful verification, the system links `customer_profiles.auth_user_id` to that verified identity
4. future protected customer-panel access uses the verified auth session, not checkout-only data

So the profile model is compatible with both:

- OTP code email auth
- magic-link email auth

What matters is that verified email ownership is established later by `Supabase Auth`, not by checkout submission itself.

### Missing Implementation Shape

Add a dedicated post-payment profile persistence path that runs only after payment is verified and the order is confirmed as paid.

Preferred direction:

1. load the paid order after `confirmCheckoutOrderPayment(...)`
2. inspect the stored `profilePersistence` decision from the order snapshot/draft data
3. normalize the customer email and look up an existing `customer_profiles` row
4. if no profile exists, create a lightweight profile row after paid success
5. if a profile already exists and the order came from a guest flow, link the order but do not overwrite reusable defaults
6. if the customer was authenticated, allow default updates only when `shouldStoreCheckoutDefaultsAfterSuccessfulPayment === true`
7. keep the whole side effect non-destructive and idempotent
8. keep future auth linkage (`auth_user_id`) compatible with passwordless email auth

### Acceptance Criteria

- guest paid order can create a lightweight customer profile when required
- guest paid order using an email that already exists links to the existing profile without changing saved defaults
- authenticated paid order can update the linked profile only after verified payment success
- `saveToProfile` controls default-address/default-invoice storage, not whether account existence is ensured
- no profile/default writes happen for unpaid, failed, abandoned, or expired orders
- checkout login CTA can return the customer to checkout with authenticated prefill and locked email
- the model remains compatible with passwordless email auth through `Supabase Auth`
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

## Archived Outcome

This remaining-work order was superseded by the completed implementation.

The accepted current sequence is now:

1. `Phase 06` is closed
2. `Phase 07` customer panel
3. follow-up step `7.5` for browser-level `Playwright`
4. `Phase 08` admin operations
5. follow-up step `8.5` for commerce analytics
6. later live `Przelewy24` replacement and launch-readiness verification

So this file should now be read only as historical implementation context, not as an active gap list.
