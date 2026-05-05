# Phase 07 - Customer Panel

Status: completed
Owner: planning
Last updated: 2026-04-28
Depends on: `phase-06-checkout-and-payments.md`
Related files: `../architecture/customer-panel-ia.md`, `../architecture/customer-auth-and-access.md`, `../architecture/order-lifecycle.md`, `../testing-strategy.md`, `../architecture/commerce-table-model.md`, `phase-7/phase-07-step-7-5-playwright-e2e-coverage.md`

## Objective

Implement the lightweight OTP-based customer-access system and customer panel for post-purchase order access, reusable customer data, and eligible self-service order actions.

## Why This Phase Exists

The B2C model does not use classic password-based accounts.

That means the customer panel is the main self-service surface after purchase, and the auth model must stay aligned with the guest-first checkout flow that was already established in `Phase 06`.

This phase exists to turn the resolved customer-auth and customer-panel IA documents into a real runtime system with:

- passwordless email + OTP access
- protected customer routes
- checkout behavior that respects authenticated customer identity
- order list and order detail access
- reusable `Dane konta` profile editing

## Inputs

- customer-panel IA
- customer auth and access model
- checkout/auth model
- order-lifecycle model
- invoice/document direction
- `../testing-strategy.md`

## Main Deliverables

- `Supabase Auth`-backed email + OTP access flow at `konto-klienta`
- protected customer-panel routing with intended-destination return behavior
- authenticated checkout behavior aligned with the accepted identity rules
- order list view
- order detail view
- `Dane konta` view
- status-history visibility
- eligible cancellation and return entry points on order detail

## Current Implementation Status

Phase 07 is complete as of 2026-04-28.

The completed implementation includes:

- `Supabase Auth` email + OTP access at `konto-klienta`
- protected customer routes with intended-destination return behavior
- authenticated checkout prefill, locked-email behavior, and identity-aware profile persistence
- shared authenticated customer-panel shell and navigation
- authenticated order list access at `konto-klienta/zamowienia`
- protected order detail access by public `order_number`
- order-time snapshot rendering for customer, shipping, invoice, discount, shipment, and line-item data
- customer-readable status history
- private invoice download handling through the application layer
- cancellation and return entry points on the detail page with server-side eligibility checks
- reusable `Dane konta` editing for future-checkout contact, shipping, and invoice defaults
- loading, empty, not-found, and error states for the main panel surfaces
- focused `Vitest` coverage for OTP, return-to behavior, checkout auth integration, order list/detail access, invoice access, cancellation, return rules, and account-profile editing

Browser-level mocked auth / checkout / payment coverage remains intentionally tracked as follow-up Step `7.5`, after Phase 07 core implementation.

The detailed Step `7.5` Playwright strategy now lives in `phase-7/phase-07-step-7-5-playwright-e2e-coverage.md`.

## Accepted Direction For This Phase

The accepted implementation direction for `Phase 07` is now:

- implement auth and session behavior first
- keep early steps focused on identity, routing, and checkout integration rather than broader customer-panel UI design
- treat `konto-klienta` as the only public customer-access gateway
- use `Supabase Auth` for OTP verification and session handling
- keep `customer_profiles` as the reusable commerce/profile layer rather than treating it as the auth account itself
- treat `konto-klienta/zamowienia` as the first real authenticated panel view
- add the broader authenticated panel UI only when the order views and `Dane konta` view are being implemented
- keep `Playwright` browser coverage as follow-up step `7.5` after the panel is implemented

## Work Included In This Phase

### 1. Public Access Gateway And OTP Auth

This step should implement the real customer access entry at `konto-klienta`.

The goal is to make email-based OTP authentication real before any protected panel views are built.

Expected work:

- build the public `konto-klienta` page as the email + OTP gateway
- implement email-entry and OTP-entry states on the same route
- use `Supabase Auth` for OTP send and verification behavior
- return a generic success response for unknown email addresses
- enforce the accepted resend / retry limits in the application flow where required
- create the authenticated session after successful OTP verification
- support first successful verified login for an email that already has eligible B2C orders
- link `customer_profiles.auth_user_id` to the verified auth identity when the accepted rules allow it
- implement logout behavior at the session level

Important rule:

- this step should not yet introduce the broader authenticated customer-panel design
- the only customer-facing surface here is the public access gateway needed to authenticate

### 2. Protected Routing And Return Behavior

This step should implement the routing and authorization behavior needed by the future panel routes.

The goal is to make the protected route model correct before the real panel views are built.

Expected work:

- protect:
  - `konto-klienta/zamowienia`
  - `konto-klienta/zamowienia/[orderNumber]`
  - `konto-klienta/dane-konta`
- preserve the intended destination when an unauthenticated customer attempts to open a protected route
- return the customer to that intended destination after successful OTP verification
- if a customer with a valid session enters `konto-klienta`, redirect them to `konto-klienta/zamowienia`
- ensure route protection is based on verified authenticated identity, not only on guest checkout email usage

Important rule:

- this step is routing and session behavior only
- it should not yet commit to the broader authenticated panel UI composition

### 3. Logged-In Checkout Integration

This step should connect the new customer-auth system back into the already completed checkout flow.

The goal is to prove that `Phase 06` and `Phase 07` work together correctly for returning customers.

Expected work:

- ensure authenticated checkout prefill continues to work from reusable customer data
- ensure the checkout email stays locked for authenticated customers
- ensure a new order created during authenticated checkout is linked to the authenticated customer identity according to the accepted rules
- support the guest -> login -> return-to-checkout behavior from the checkout login CTA
- keep the cart intact across the auth roundtrip in the same browser
- keep the authenticated checkout consent area minimal:
  - one flat required checkbox for `regulamin` + `polityka prywatności`
  - one flat checkbox for saving / updating reusable customer data
  - no newsletter / marketing checkbox in authenticated checkout
- ensure logout returns checkout behavior to guest mode where appropriate
- verify that post-payment profile persistence still behaves correctly for guest and authenticated flows

Important rule:

- this step is integration and correctness work, not the place to design the main customer-panel views
- mocked cross-system journey coverage that depends on real auth/session behavior plus the local payment mock should live in follow-up step `7.5`, not inside Step 3 Vitest work

### 4. Orders Area

This step should introduce the first real authenticated customer-panel views.

The goal is to make order access the main post-login customer experience.

Expected work:

- build `konto-klienta/zamowienia` as the default authenticated landing page
- list all eligible B2C orders associated with the authenticated email identity
- include active `awaiting_payment` orders while they are still inside the valid payment window
- exclude expired `awaiting_payment` orders from the main list according to the accepted IA rules
- build `konto-klienta/zamowienia/[orderNumber]` using the public order number rather than the internal database ID
- show current status and full status history
- show order-time snapshots rather than current profile defaults
- include invoice visibility / download handling when available
- place eligible cancellation and return entry points on the order detail page only

This step is also the right place to introduce the first broader authenticated panel UI composition because the first real authenticated destination now exists.

### 5. `Dane Konta`

This step should implement the reusable customer-data view.

The goal is to make the lightweight profile model editable without turning the panel into a classic account-management system.

Expected work:

- build `konto-klienta/dane-konta`
- load the current reusable customer defaults from `customer_profiles`
- support editing of reusable contact, shipping, and billing / invoice defaults for future checkout use
- preserve the accepted v1 rule that email is the identity key and is not self-service editable in the panel
- ensure profile edits affect future checkout defaults only
- ensure historical orders continue to show their original order-time snapshots

This step should stay narrowly focused on reusable customer data.

It should not expand into classic account settings, password management, newsletter / marketing consent management, or broad profile features outside the accepted v1 scope.

Newsletter / marketing consent remains outside `Dane konta` for v1. If checkout offers newsletter opt-in, checkout remains the only in-app capture point; the account details page should not mention subscribing, unsubscribing, provider status, or marketing preferences.

## Expected Implementation Sequence

The implementation order inside `Phase 07` was:

1. public access gateway and OTP auth
2. protected routing and return behavior
3. logged-in checkout integration
4. orders area
5. `Dane konta`

This sequence kept the architecture stable:

- verified identity comes before protected views
- route and redirect correctness comes before panel UI
- checkout integration is proven before broader panel work expands
- the first real authenticated destination is the order area defined by the IA
- reusable customer-data editing lands after the main post-purchase order surface exists

## Follow-Up Step 7.5 - Playwright Coverage

After the customer-panel implementation is complete, the next follow-up step should add the first browser-level `Playwright` coverage for the real B2C journey.

This is intentionally sequenced after `Phase 07`, not inside it, because the critical browser path should validate:

- storefront purchase
- thank-you recovery states
- customer login / OTP flow
- protected-route redirect behavior
- post-purchase order access inside the panel
- reusable customer-data behavior where it matters most

This is also the right place for the mocked integration cases that are too cross-system for comfortable `Vitest` ownership.

In practice, Step `7.5` should own:

- the local mock-payment browser journey from checkout submit to paid confirmation
- the guest -> OTP login -> return-to-checkout roundtrip
- the guest purchase -> thank-you -> customer-panel access roundtrip
- the authenticated checkout prefill / locked-email regression in a real browser session
- the Supabase-backed OTP session / redirect / protected-route behavior with the local payment mock acting as the external provider boundary

Important rule:

- keep pure domain, mapper, validation, and small server-action protection in `Vitest`
- move browser-level mocked auth + checkout + payment journeys into `Playwright` step `7.5` so they are exercised once as a full path instead of duplicated as awkward integration-style mocks in earlier steps

This step should stay focused on the most important end-to-end journeys rather than broad UI exhaustiveness.

## Not In Scope For This Phase

- classic account registration
- password management
- historical order migration
- advanced profile functionality
- a separate public login route outside `konto-klienta`
- broader authenticated panel UI work beyond the agreed order area and `Dane konta` v1 surfaces

## Done Criteria

Phase 07 is considered complete because the implementation satisfies the accepted criteria:

- customers can authenticate through email + OTP at `konto-klienta`
- successful OTP verification creates a real session and supports the accepted profile-linking behavior
- protected customer routes preserve the intended destination and return the customer there after auth
- authenticated checkout works correctly with prefill, locked email, and identity-aware order linkage
- customers can view eligible orders in `konto-klienta/zamowienia`
- customers can open order details through `konto-klienta/zamowienia/[orderNumber]`
- the order detail page shows current status, status history, and order snapshots correctly
- eligible invoice, cancellation, and return entry points exist in the right place
- customers can use `konto-klienta/dane-konta` to edit reusable future-checkout defaults
- historical orders remain immutable snapshots even after profile edits
- the customer panel reflects the agreed v1 structure and access rules
