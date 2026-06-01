# Things Left Before Client Preview

Status: draft
Owner: planning / execution
Last updated: 2026-05-07
Depends on: `b2c-implementation-overview.md`, `execution/implementation-backlog.md`, `phases/phase-08-admin-operations.md`, `phases/phase-09-policy-flows.md`, `phases/phase-10-launch-readiness.md`
Related files: `testing-strategy.md`, `phases/phase-7/phase-07-step-7-5-playwright-e2e-coverage.md`, `phases/phase-7/phase-07-step-7-7-live-przelewy24-integration.md`, `apps/b2c-admin/README.md`

## Purpose

This file tracks the remaining work before showing the already-completed but still preview B2C architecture to the client for review and feedback.

Phase 08 is complete for the v1 admin scope. The remaining work below is not a Phase 08 blocker. It is the practical cleanup, verification, and hardening needed so the preview can be shown with clear expectations and without confusing preview state for launch readiness.

## Current Baseline

Recent commits show that the B2C branch has completed the main v1 architecture through Phase 08:

- customer storefront and cart path
- checkout, order creation, payment handling, and thank-you recovery
- OTP-based customer panel
- customer order list, order detail, invoice access, cancellation / return entry points, and account defaults
- Sanity App SDK admin app
- admin order listing and order detail operations
- admin shipment, invoice, cancellation, and return handling
- admin coupons listing, creation, editing, deactivation, and archive handling
- simple admin operational analytics
- focused backend and App SDK admin tests
- Playwright customer E2E suite for the current v1 customer scope

Current coverage count from the repo audit:

- `59` B2C web unit/integration test files
- `9` B2C admin App SDK test files
- `10` Playwright E2E spec files

The planning dashboard currently records no open planning threads in `.ai/b2c/open-threads.md`.

## Recommended Preview Positioning

The client preview should be presented as:

- a completed v1 B2C architecture preview
- suitable for client review and feedback
- not yet final launch-ready production state

The preview should clearly explain:

- what is already implemented
- what is intentionally preview-only
- which flows the client should review
- which launch-readiness tasks remain after feedback

## Remaining Work Before Client Preview

### 1. Documentation Alignment

Clean up stale or conflicting docs before sharing the preview.

Known items:

- `execution/implementation-backlog.md` still describes Step `7.5` browser coverage as queued in the current snapshot, while `phases/phase-7/phase-07-step-7-5-playwright-e2e-coverage.md` says it is completed for v1.
- `apps/b2c-admin/README.md` still describes the admin app as a minimal dummy foundation, even though Phase 08 has completed the real admin operations surface.
- Create a client-facing preview note that explains implemented scope, preview limitations, and feedback expectations.
- Make sure Phase 09 and Phase 10 remain framed as remaining hardening / launch-readiness work rather than Phase 08 incompleteness.

Suggested output:

- updated internal docs
- short client-preview summary
- clear list of preview limitations

### 2. Full Local Quality Gate

Run a complete verification pass before presenting the preview.

Recommended commands:

- root typecheck: `bun run check-types`
- root lint: `bun run lint`
- web tests: `cd apps/web && bun run test:run`
- admin tests: `cd apps/b2c-admin && bun run test`
- admin build: `cd apps/b2c-admin && bun run build`
- web build: `cd apps/web && bun run build`
- Playwright E2E: `cd apps/web && bun run test:e2e`

Current known E2E caveat:

- `apps/web/e2e/cpo-purchase.spec.ts` conditionally skips when the Sanity dataset has no buyable `CPO` product with `isSellableOnline == true`, `availabilityStatus == "available"`, and `priceCents > 0`.

Before preview, decide whether to:

- seed one preview-safe buyable `CPO` item, or
- keep the skip and explicitly state that full CPO purchase browser coverage is content-gated.

### 3. Commerce Analytics Instrumentation

Admin operational analytics exists, but storefront commerce funnel analytics are still a late follow-up.

Remaining work:

- define the final v1 commerce event map
- wire storefront and checkout/payment instrumentation
- verify thank-you / order-confirmation events where relevant
- confirm emitted events match the final implemented production journey

Minimum expected event set:

- `add_to_cart`
- `remove_from_cart`
- `view_cart`
- `begin_checkout`
- payment start / payment handoff
- purchase confirmed
- useful payment failure / expiration events, if agreed

Relevant existing infrastructure:

- `apps/web/src/global/analytics/track-event.ts`
- existing lead/newsletter analytics wiring
- cookie consent / GA4 / Meta infrastructure

This should be treated as follow-up Step `8.5` and launch-readiness work, not as a Phase 08 admin blocker.

### 4. Phase 09 Policy-Flow Hardening

Phase 09 is still planned.

The system already has cancellation and return pieces in customer and admin paths, but the full policy-flow system still needs final end-to-end validation.

Remaining work:

- verify cancellation eligibility across customer panel and admin
- verify admin cancellation accept/reject behavior
- verify return eligibility across shipped/completed statuses
- verify return-window behavior
- verify company-invoice return restriction behavior
- verify whole-order non-returnable rule
- verify return-case lifecycle: `open`, `closed_without_return`, `completed`
- verify customer-visible state after admin resolution
- verify email/customer communication rules do not conflict with status and case state

Known clarification points from `business/returns-and-cancellations-rules.md`:

- exact operator flow for approved cancellation
- exact operator flow for approved return
- refund communication relationship to cancellation vs return
- when and how `CPO` availability may be restored after cancellation or return handling

### 5. Przelewy24 Preview Rollout

Live Przelewy24 implementation is locally complete, but the preview sandbox rollout is still pending.

Before showing payment as a realistic preview flow:

1. Enable `P24_MODE=sandbox` in the Vercel preview environment.
2. Add sandbox merchant id, pos id, API key, and CRC.
3. Run `testAccess`.
4. Complete one manual sandbox checkout.
5. Confirm the transaction appears in the P24 sandbox panel.
6. Confirm `/api/payment/status/` receives the notification.
7. Confirm Supabase order state moves from `awaiting_payment` to `paid`.
8. Confirm thank-you page state.
9. Confirm confirmation email behavior.
10. Confirm customer-panel visibility after payment.

Until this is done, client preview should either:

- use the local/mock payment path, or
- explicitly label P24 as implementation-ready but pending preview sandbox activation.

### 6. Production And Preview Configuration Checks

Before preview, verify all required environment configuration for the preview deployment.

Important areas:

- Supabase URL, anon key, and service-role key
- Sanity project, dataset, API version, studio URL, and read token
- Sanity App SDK organization / project configuration
- `B2C_ADMIN_ALLOWED_ORIGINS`
- `B2C_ADMIN_ALLOWED_EMAILS` / `B2C_ADMIN_ALLOWED_USER_IDS`
- `VITE_B2C_ADMIN_API_BASE_URL` for the admin app when needed
- P24 sandbox variables if payment preview is enabled
- Microsoft Graph email config
- Mailchimp config
- analytics config

Safety checks:

- admin API CORS should fail closed when allowed origins are not configured
- Supabase service-role credentials must remain server-side only
- P24 API key and CRC must never use `NEXT_PUBLIC_*`
- E2E safety switches must not leak into production behavior

### 7. Supabase Query And Index Review

The B2C docs still call out a Supabase query/index performance review for runtime paths.

Review query plans and indexes for:

- admin order listing, search, filters, and pagination
- admin order detail loading
- admin analytics date-range queries
- customer order listing
- customer order detail
- invoice download access checks
- cancellation request lookup
- return case lookup
- coupon lookup and product-scoped coupon matching
- payment confirmation order lookup

The accepted minimal useful indexes in `architecture/commerce-table-model.md` are:

- `orders(order_number)`
- `orders(customer_email)`
- `orders(customer_profile_id)`
- `orders(current_status)`
- `order_items(order_id, line_position)`
- `return_cases(order_id)`
- `coupons(code)`

Confirm whether the implemented admin filters and analytics queries need additional indexes before launch.

### 8. Refactor Candidates

The implementation is functional, but several files are now large enough to deserve post-preview refactoring.

Not immediate preview blockers, but recommended before final launch hardening:

- `apps/b2c-admin/src/admin/components/OrderDetailView.tsx` - approximately `1743` lines
- `apps/web/src/global/b2c/admin/server/orders.ts` - approximately `1214` lines
- `apps/web/src/global/b2c/admin/server/order-cases.ts` - approximately `823` lines
- `apps/web/src/global/b2c/checkout/server/payment-profile-persistence.ts` - approximately `796` lines
- `apps/web/src/global/analytics/track-event.ts` - approximately `599` lines
- `apps/b2c-admin/src/admin/api.ts` - approximately `559` lines

Suggested approach:

- do not refactor aggressively before preview unless a bug or test instability forces it
- collect client feedback first
- then split along stable workflow boundaries

Likely split points:

- admin order detail sections
- admin order list query building
- admin order detail DTO mapping
- return/cancellation case operations
- checkout profile persistence read/write helpers
- analytics event queue and provider dispatch responsibilities

### 9. Browser And Manual Preview Checks

Before client review, run a small manual smoke pass on the exact preview deployment.

Suggested smoke paths:

- standard product add to cart
- cart quantity edit and removal
- guest checkout
- payment path selected for preview
- paid thank-you state
- customer panel login / protected routing
- order list and order detail
- customer account defaults
- cancellation request entry point
- admin orders listing
- admin order detail status update
- shipment metadata edit
- invoice upload / download / removal
- coupon create / edit / deactivate / archive
- admin analytics date range change

Also check:

- desktop layout
- mobile layout for customer-facing flow
- basic dark/light Sanity theme behavior in the App SDK admin app
- clear loading and error states

### 10. Client Feedback Package

Prepare a small handoff package for the client preview.

It should include:

- preview URL(s)
- admin access instructions
- what to test
- what not to judge yet
- known limitations
- feedback questions
- launch-readiness work still planned

Suggested feedback questions:

- Does the order management flow match daily Audiofast operations?
- Are order statuses and labels understandable?
- Is the coupon model enough for v1?
- Does the customer panel show the right order and invoice information?
- Are cancellation and return states clear from a customer perspective?
- Are the simple analytics useful enough for v1 visibility?
- Is any required legal/content wording missing before launch?

## Preview Blockers Vs Launch Blockers

### Should Block Client Preview

- stale docs that misrepresent implementation state
- failing typecheck/build/test suites
- broken preview deployment
- admin app cannot call preview admin APIs because of CORS or auth config
- core standard-product purchase path is broken
- customer panel cannot show paid order data
- admin order detail cannot load or save critical operations

### Can Be Shown As Preview Limitation

- P24 sandbox rollout pending, if mock payment is used for preview
- CPO E2E skipped due to missing buyable CPO content
- storefront commerce analytics not yet wired
- Phase 09 policy-flow hardening not fully complete
- large-file refactors not yet done

### Should Block Launch Readiness

- Phase 09 policy-flow conflicts
- missing commerce analytics verification
- missing production P24 validation
- missing production env/security checks
- unreliable local test suite
- unresolved Supabase performance/index risks
- unclear legal/content/payment sign-off
- untested email behavior for final lifecycle events

## Suggested Execution Order

1. Align stale docs and prepare the client-preview note.
2. Run full local quality gate.
3. Fix any failing tests, build errors, or preview-blocking regressions.
4. Verify preview deployment configuration and admin App SDK API access.
5. Decide whether P24 preview uses sandbox or mock.
6. Run manual preview smoke paths.
7. Share preview package with client.
8. Collect feedback.
9. Continue Phase 09, analytics Step `8.5`, Supabase review, and Phase 10 launch readiness.

## Summary

The B2C architecture is ready to be prepared for client preview, but it should not be positioned as launch-ready yet.

The remaining work is mostly:

- docs cleanup
- quality-gate verification
- preview configuration
- commerce analytics
- policy-flow hardening
- P24 sandbox rollout
- Supabase query/index review
- final production readiness checks
