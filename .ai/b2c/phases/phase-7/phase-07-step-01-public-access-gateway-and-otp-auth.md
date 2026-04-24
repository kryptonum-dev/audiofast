# Phase 07 Step 01 - Public Access Gateway And OTP Auth

Status: draft / development-ready
Owner: planning
Last updated: 2026-04-24
Depends on: `../phase-07-customer-panel.md`, `../../architecture/customer-auth-and-access.md`, `../../architecture/customer-panel-ia.md`
Related files: `../phase-07-customer-panel.md`, `../../architecture/customer-auth-and-access.md`, `../../architecture/customer-panel-ia.md`, `../../testing-strategy.md`

## Purpose

This file turns `Phase 07` Step 01 into an implementation-ready plan.

It defines:

- the accepted Step 01 auth strategy
- the current repo and Supabase facts that shape the implementation
- the mini-steps required to take the step from `0` to `100%`
- the order those mini-steps should be implemented in
- what Step 01 must deliver before later protected routes and panel views begin

## Current Project Facts

The current project state is important for this step:

- `public.customer_profiles` already exists and already stores reusable customer identity defaults
- `public.orders` already exists and already stores paid-order commerce truth
- `public.customer_profiles.auth_user_id` is nullable and is the bridge to `auth.users.id`
- RLS for `customer_profiles`, `orders`, `order_items`, and `return_cases` already assumes authenticated customer access will resolve through `auth.uid()` -> `customer_profiles.auth_user_id`
- the repo already has:
  - a browser `Supabase` client utility
  - a cookie-aware server `Supabase` auth client utility
  - checkout logic that already understands authenticated vs guest behavior
  - post-payment profile persistence that can link `customer_profiles.auth_user_id`
- the live `Supabase` project currently has commerce-side rows, but no real customer auth users yet

This means Step 01 is not only an OTP UI task.

It is also the step that must establish the first working bridge between existing commerce-side customer identity and real `Supabase Auth` session identity.

## Initial Live `Supabase Auth` Config Snapshot

The current hosted `Supabase Auth` config was inspected directly from the live project before implementation work continued.

Important current values:

- `site_url = http://localhost:3000`
- `uri_allow_list = ""`
- `disable_signup = false`
- `mailer_otp_exp = 3600`
- `mailer_otp_length = 6`
- `mailer_templates_magic_link_content` is still the default link-based template using `{{ .ConfirmationURL }}`
- `sessions_timebox = 0`
- `sessions_inactivity_timeout = 0`
- `smtp_host = null`
- `smtp_port = null`
- `smtp_user = null`
- `smtp_admin_email = null`

This means the live project is not yet aligned with the accepted Step 01 direction.

The most important mismatches are:

- production customer auth is still pointing at localhost as the site URL
- the passwordless email content is still magic-link-shaped instead of OTP-code-shaped
- OTP lifetime is still `60 minutes` instead of the accepted `15 minutes`
- public signup is still open at the auth-project level
- fixed `30-day` session timeboxing is not configured
- production-grade email delivery for auth is not configured

## Target Hosted Auth Config For Mini-Step 1

The intended hosted config for Mini-Step 1 is:

- `site_url = https://audiofast.pl`
- `uri_allow_list` should include:
  - `https://audiofast.pl/**`
  - `https://www.audiofast.pl/**`
  - `http://localhost:3000/**`
- `disable_signup = true`
- `mailer_otp_exp = 900`
- `mailer_subjects_magic_link = Kod logowania Audiofast`
- `mailer_templates_magic_link_content` should become OTP-code based and render `{{ .Token }}` instead of `{{ .ConfirmationURL }}`
- `sessions_timebox = 2592000`
- `sessions_inactivity_timeout = 0`
- `sessions_single_per_user = false`
- `rate_limit_email_sent = 5`
- `smtp_max_frequency = 60` may remain unchanged because it already matches the accepted resend cooldown

Important note:

- the hosted project still needs real auth-email delivery credentials before this mini-step can be considered truly complete from an operational perspective

## Current Execution Blockers

Two live blockers were discovered while attempting to apply Mini-Step 1 directly:

### 1. Management API Write Access

The current available `Supabase` management token can read project config, but the live `PATCH /config/auth` request is rejected with an access-control error.

That means the current session can inspect the project but cannot mutate hosted auth settings directly.

### 2. Missing SMTP Credentials

The hosted project currently has no SMTP host, port, username, password, or sender configured.

So even with correct config-write privileges, Mini-Step 1 would still remain operationally incomplete until real auth-email delivery credentials are provided.

## Current Mini-Step 1 Outcome

After the manual hosted-dashboard updates in this implementation pass, Mini-Step 1 should now be treated as:

- complete enough for development
- not complete for production

The current accepted development-state outcome is:

- `Site URL` was updated away from localhost toward the real production domain
- redirect URLs were configured for production and localhost development
- public signup was disabled in hosted auth settings
- email OTP expiry was reduced from `60 minutes` to the accepted `15-minute` window
- the `Magic link` email template was converted into an OTP-code email using `{{ .Token }}`
- the built-in `Supabase` email sender remains acceptable for local/development testing only
- the `Sessions` screen still cannot enforce the fixed `30-day` timebox because that hosted capability is not available on the current plan
- custom SMTP is still not configured, so production-grade customer auth-email delivery remains blocked

This means the step is now ready for:

- local implementation
- development testing
- OTP flow wiring against team/test inboxes

This step is still not ready for:

- public launch
- real customer email delivery at scale

## Development Vs Production Status

Mini-Step 1 should now be interpreted as:

### Development

- acceptable to proceed
- use the hosted `Supabase` built-in email sender for development/testing only
- continue implementation of the app-side OTP flow, profile linking, and route protection

### Production

Still blocked by:

- missing custom SMTP credentials
- unresolved production auth-email sender configuration
- inability to enforce the exact fixed `30-day` hosted session policy on the current plan

## Accepted Step 01 Strategy

The accepted implementation strategy for this step is:

- use `Supabase Auth` for email OTP and session handling
- use an email one-time code, not a magic link
- keep `konto-klienta` as the single public customer-access gateway
- keep email-entry and OTP-entry on the same route as different UI states
- return a generic success response for unknown or ineligible emails
- avoid broader authenticated customer-panel UI in this step
- do not rely on open public auth auto-signup for customer-panel access
- only allow the full OTP flow for emails that are already eligible in the B2C system
- bootstrap the missing `auth.users` record for an eligible customer email when necessary
- link `customer_profiles.auth_user_id` only after verified auth identity exists

Important architectural rule:

- `Supabase Auth` is the verified identity and session layer
- `customer_profiles` remains the reusable commerce/customer-profile layer

Step 01 must preserve that separation.

## Core Goal

Step 01 is complete only when `konto-klienta` is a real working customer-access gateway that can:

1. accept an email
2. send an OTP code to an eligible customer
3. verify that code
4. create a real authenticated session
5. link the verified auth identity to the existing commerce-side customer identity
6. support logout cleanly

This step should stop there.

It should not expand into the broader authenticated customer-panel views yet.

## What Step 01 Must Deliver

- real `konto-klienta` public gateway behavior
- real email OTP send and verify flow
- generic response behavior for unknown emails
- first-login auth bootstrap for eligible customer emails that do not yet exist in `auth.users`
- post-verification linkage between `auth.users.id` and `customer_profiles.auth_user_id`
- stable authenticated session behavior for the current browser
- logout behavior
- compatibility with the already implemented authenticated checkout assumptions

## What Step 01 Does Not Need To Deliver

This step should intentionally defer the following:

- the broader authenticated customer-panel design
- order list UI
- order detail UI
- `Dane konta` UI
- protected panel page composition
- cancellation and return UX

Those belong to later `Phase 07` steps.

## Recommended Mini-Step Order

### 1. Lock The `Supabase Auth` Configuration

Before any app code is added, the team should lock the external auth configuration.

Expected work:

- configure the email template to send an OTP code instead of a magic link
- set OTP expiry to the accepted `15-minute` window
- configure `Site URL` and allowed redirect URLs
- configure production-ready email delivery through custom SMTP
- confirm the intended signup policy for the project

Reason:

- if this is not frozen first, the application can be implemented correctly but still fail at real message delivery or send the wrong auth email shape

### 2. Freeze The Eligibility Rule

Before OTP requests go live, the project should explicitly freeze which emails are eligible for customer-panel access.

Expected work:

- define the normalized email rule
- define which commerce-side data makes an email eligible
- freeze the generic-response behavior for ineligible emails

Important direction:

- Step 01 should not reveal whether an email exists in the system

Accepted rule for the current implementation track:

- use `orders` as the primary eligibility source of truth
- an email is eligible when it has at least one order in a customer-visible lifecycle state:
  - `paid`
  - `processing`
  - `shipped`
  - `completed`
  - `cancelled`
  - `returned`
- an email is also eligible when it has at least one `awaiting_payment` order whose `payable_until` timestamp is still in the future
- an email is not eligible when it has:
  - no matching orders
  - only expired `awaiting_payment` orders
- `customer_profiles` may still be loaded as internal metadata for later auth-linking work, but a profile row on its own must not grant access

### 3. Add The First-Login Auth Bootstrap Path

The live project currently has commerce-side customer rows but no customer auth users.

So before OTP verification can work reliably, the project needs a bootstrap strategy for first login.

Expected work:

- detect whether an eligible customer email already has an `auth.users` row
- if not, create the missing auth user through the accepted server-side path
- keep the flow compatible with later OTP verification rather than classic signup

Important rule:

- this bootstrap exists to support existing eligible customer emails
- it should not become open public self-registration

Accepted implementation direction for the current track:

- resolve eligibility first
- only eligible emails may reach the bootstrap path
- look up an existing auth user by normalized email
- if an auth user already exists, reuse it
- if no auth user exists, create one server-side through the service-role admin path
- create the auth user as passwordless-compatible and email-confirmed so later OTP login can proceed without open public signup
- treat duplicate create races as recoverable by reloading the just-created auth user
- do not link `customer_profiles.auth_user_id` in this mini-step yet

This mini-step only ensures that the eligible customer email has a corresponding `auth.users` row.

The later verified OTP step remains the actual proof of inbox ownership.

### 4. Build The OTP Request Action

Create the application entry point that handles email submit from `konto-klienta`.

Expected work:

- accept the submitted email
- normalize and validate it
- check eligibility
- run first-login bootstrap when required
- trigger OTP send
- always return generic customer-facing success copy

Accepted implementation direction for the current track:

- keep the OTP orchestration in a server-only service, with a thin Next.js server action wrapper for the future public gateway form
- reuse mini-step 3 as the single bootstrap entry, so OTP send only happens after eligibility and auth-user existence are resolved
- call `supabase.auth.signInWithOtp` with `shouldCreateUser: false`, so this path cannot silently become open public signup
- return the same generic success state for invalid and ineligible emails, and move the UI into the OTP-entry step without revealing account existence
- only return a retryable explicit error when the actual OTP delivery request fails unexpectedly, because that is an operational issue rather than an eligibility signal

### 5. Build The Public `konto-klienta` Gateway UI

Create the public page at `konto-klienta` with the two required UI states.

Expected work:

- email-entry state
- OTP-entry state
- resend timer
- invalid-code handling
- customer-friendly generic messaging

Important rule:

- this page is a public auth gateway, not the full customer panel

### 6. Build The OTP Verification Path

Implement the application step that verifies the one-time code and establishes the session.

Expected work:

- accept email + OTP code
- verify the code through `Supabase Auth`
- create the real authenticated session
- handle wrong-code and expired-code outcomes cleanly

Accepted implementation direction for the current track:

- verify the numeric code through `supabase.auth.verifyOtp({ email, token, type: 'email' })`
- use the cookie-aware server auth client so successful verification writes the real authenticated session for the current browser
- normalize the email and OTP input before verification, and reject malformed six-digit codes before touching `Supabase Auth`
- map `Supabase Auth` verification failures into three UI-safe outcomes: `invalid_code`, `expired_code`, and generic operational failure
- keep the public gateway on `konto-klienta`, but move it into a temporary authenticated success state after verification because the protected order-list route does not exist yet in the current implementation track
- let server-rendered `konto-klienta` detect an already-authenticated session and render that temporary authenticated state on refresh until the real panel landing route is introduced later

### 7. Link Verified Auth Identity To `customer_profiles`

After successful verification, resolve the verified auth user against the existing commerce-side customer identity.

Expected work:

- load the matching `customer_profiles` row
- attach `auth_user_id` when it is currently null
- leave already-correct links unchanged
- handle collision/conflict cases safely when the profile is already linked to another auth user

This is the most important internal side effect of Step 01 because later RLS-protected customer-panel reads depend on it.

Accepted implementation direction for the current track:

- run profile-linking immediately after successful OTP verification, before redirecting into the authenticated route family
- prefer matching `customer_profiles` by `auth_user_id` first and then by normalized email as the fallback bridge
- if the matched email profile has `auth_user_id = null`, attach the verified auth user id
- if the matched profile is already linked to another auth user, do not overwrite it; log the conflict and keep the customer session valid
- add the first authenticated landing route at `konto-klienta/zamowienia` and redirect successful login there instead of keeping a temporary authenticated holding state on the public gateway

### 8. Add SSR Session Refresh Plumbing

Before protected panel routes are implemented later, the project should add the session-refresh plumbing expected by `Supabase` SSR guidance.

Expected work:

- add the request-time session refresh layer
- ensure server authorization continues to rely on `auth.getUser()`
- keep session cookies coherent across browser and server rendering

Accepted implementation direction for the current track:

- add a single `src/proxy.ts` file because the project uses the `src` folder and Next.js 16 proxy convention
- merge the new Supabase session-refresh logic into the existing proxy file so legacy redirects and auth-cookie refresh continue to coexist in one request entry point
- build the proxy around `createServerClient` with `cookies.getAll` / `cookies.setAll`
- call `supabase.auth.getUser()` inside the proxy on normal app requests to let Supabase refresh expired sessions when needed

### 9. Add Logout

Add the minimal logout behavior required for authenticated customer access.

Expected work:

- invalidate the current session
- clear the session state cleanly for the current browser
- return the customer to the public access entry

Accepted implementation direction for the current track:

- add a dedicated server action for customer logout using the cookie-aware auth server client
- call `supabase.auth.signOut()` for the current browser session only
- expose logout on the first authenticated customer route (`konto-klienta/zamowienia`) even before the full panel navigation exists
- always redirect logout back to the public `konto-klienta` gateway

### 10. Reconfirm Checkout Compatibility

The auth step should finish by proving it works with the already completed checkout flow.

Expected work:

- confirm authenticated checkout prefill still works
- confirm the checkout email remains locked when authenticated
- confirm the authenticated customer identity is carried into checkout correctly
- confirm logout returns checkout behavior to guest mode where expected

### 11. Add Focused Test Coverage

Step 01 should land with automated protection for the rule-heavy parts.

Expected coverage:

- eligible existing-customer OTP request
- ineligible email generic response
- first-login bootstrap behavior
- OTP verification success
- wrong / expired OTP handling
- profile-link success
- profile-link conflict handling
- logout
- authenticated checkout recognition after login

## Recommended Implementation Sequence

The recommended implementation order inside Step 01 is:

1. lock `Supabase Auth` configuration
2. freeze the eligibility rule
3. add first-login auth bootstrap
4. build the OTP request action
5. build the public `konto-klienta` gateway UI
6. build the OTP verification path
7. link verified auth identity to `customer_profiles`
8. add SSR session refresh plumbing
9. add logout
10. reconfirm checkout compatibility
11. add focused code-level test coverage

This sequence keeps the architecture stable:

- the external auth system is configured before product code depends on it
- eligibility and auth bootstrap are solved before the UI goes live
- verified identity linkage is treated as a core correctness step, not an afterthought
- session plumbing lands before later protected routes depend on it
- broader panel UI remains deferred until the later `Phase 07` steps
- mocked browser journeys that depend on real `Supabase` auth/session state plus checkout/payment behavior are deferred to follow-up step `7.5` in `Playwright`

## Done Criteria

Step 01 can be considered complete when:

- `konto-klienta` works as the public email + OTP gateway
- only eligible customer emails can proceed through the real customer-access flow
- the customer-facing response remains generic for unknown or ineligible emails
- the flow can bootstrap missing auth users for existing eligible customer emails
- OTP verification creates a real authenticated session
- verified auth identity is linked safely to `customer_profiles.auth_user_id`
- logout works correctly
- the existing checkout auth assumptions remain valid after login
- the step has focused code-level automated protection for the critical auth and linkage rules
- broader mocked auth + checkout + payment journey coverage is tracked in follow-up step `7.5` rather than being forced into Step 01
