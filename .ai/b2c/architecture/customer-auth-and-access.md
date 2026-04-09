# Customer Auth And Access

Status: in progress
Owner: planning
Last updated: 2026-04-09
Depends on: current customer identity and access decisions
Related files: `system-map.md`, `commerce-data-model.md`, `order-lifecycle.md`, `customer-panel-ia.md`, `cart-and-checkout-model.md`, `payment-process-model.md`, `commerce-table-model.md`

## Purpose

This file defines the current v1 customer auth, identity, and access model for the Audiofast B2C system.

It covers:

- guest-first purchase access
- email identity rules
- checkout-linked identity behavior
- immediate post-purchase access
- OTP-based customer-panel authentication
- lightweight customer profile behavior
- session and security rules at a high level

Detailed panel information architecture and URL structure are documented in `customer-panel-ia.md`.

## Core Model

The v1 model is intentionally lightweight:

- checkout is fully guest-first
- purchase does not require login
- email is the identity key for later customer access
- email OTP is used for real customer-panel authentication
- the system behaves like lightweight customer access, not a classic account system

## Checkout Entry

### Guest-First Purchase

The customer can:

- configure products
- use the cart
- go to checkout
- complete payment

without logging in first.

There is:

- no required account creation
- no required OTP before purchase
- no classic password system

## Identity Model

### Email As The Identity Key

The customer email address is the main identity key for linking orders in the B2C customer panel.

This means:

- all paid B2C orders tied to the same email belong to the same lightweight customer identity
- names and addresses may vary between orders
- order ownership for panel access is based on verified email identity, not on name matching

### Email Change Policy

In v1:

- the customer cannot self-serve an email change inside the panel

This remains an intentional simplification because email is both:

- the access identity
- the order-linking key

## Auth Layer

### Supabase Auth

The accepted v1 direction is:

- use `Supabase Auth` for OTP authentication and session handling
- do not build a separate custom OTP challenge table in the business schema

This means:

- `Supabase Auth` handles verified identity and authenticated session state
- `customer_profiles` holds reusable business/customer defaults
- `orders` remain the commerce source of truth

### OTP Format

The OTP model in v1 is:

- one-time code
- not a magic link
- valid for `15 minutes`

### Session Rules

After successful OTP verification:

- session duration is `30 days`
- duration is fixed, not rolling
- multiple concurrent sessions are allowed across devices/browsers
- customer can log out from the current session

### Public Access Method

Returning customer access uses:

- email entry
- one-time OTP code sent by email

The resolved public entry point and customer-panel route structure are documented in:

- `customer-panel-ia.md`

## Checkout Data Behavior

### Logged-Out Checkout

When the customer is not authenticated:

- checkout behaves as a guest checkout
- the email entered in checkout is not yet verified identity access

### Logged-In Checkout

When the customer already has a valid authenticated session:

- checkout should prefill saved profile data
- the checkout email should not be editable
- the new order should be linked to the currently authenticated customer identity

### Logged-In Checkout Data Updates

When the customer is already authenticated and edits checkout data:

- the submitted checkout values should always be stored in the new order snapshot
- reusable profile data should update only if the customer explicitly opts in through a checkbox during checkout
- if the customer does not opt in, the existing reusable profile data should remain unchanged

## Profile Behavior

### Lightweight Profile Model

The lightweight customer profile exists for:

- reusable checkout defaults
- authenticated `Dane konta`
- future-order convenience

There is still no separate registration concept.

### Initial Profile Creation

The accepted v1 rule is:

- create `customer_profiles` only after the first successful paid order
- do not create profiles for unpaid / expired / abandoned orders

### Existing Profile Protection

For guest checkout on an email that already has paid-order history:

- the order still belongs to that same email identity
- the order snapshot is stored normally
- existing reusable profile data must not be overwritten automatically

### Profile Data Reuse

Saved profile data should:

- prefill future checkouts
- support repeat purchases with less friction

The customer should also have an authenticated reusable-data view in the customer panel where those defaults can be edited directly.

The accepted reusable profile JSON shapes are:

- `default_shipping_address`:
  - `firstName`
  - `lastName`
  - `phone` nullable
  - `street`
  - `postalCode`
  - `city`
  - `country`
- `default_invoice_data`:
  - `recipientType`
  - `companyName` nullable
  - `taxId` nullable
  - `invoiceAddress` nullable

### Historical Order Data

Profile changes affect:

- future orders only

Historical orders must preserve:

- the original order-time customer data snapshot

## Immediate Post-Purchase Access

### If The Customer Was Already Logged In

If the customer already has a valid authenticated session when they complete purchase:

- they can be redirected to the new order summary inside the customer panel

### If The Customer Was Not Logged In

If the customer completes checkout as a guest:

- they should get a thank-you / order-summary flow
- they should receive only short-lived access to the single newly created order
- this is not the same as full email-identity customer-panel access
- the thank-you flow may show pending verification before real payment confirmation is known

### Short-Lived Single-Order Access

The guest post-payment access window should last:

- `60 minutes`

This short-lived access is intended only for:

- immediate order confirmation
- immediate order review

It should not unlock:

- all orders for that email
- the full customer-panel identity

## OTP Access Behavior

### What OTP Unlocks

Successful OTP verification authenticates the email identity and grants access to:

- paid B2C orders associated with that email
- the lightweight customer panel for that email identity

### Generic Response For Unknown Email

If someone enters an email with no eligible B2C orders:

- the system should still show a generic success response

For example:

- "If we found orders for this email, we sent a code."

This avoids revealing whether an email exists in the system.

### Resend / Wrong Attempt Limits

Current v1 direction:

- resend allowed after `60 seconds`
- maximum `5` OTP sends per hour per email
- maximum `5` wrong attempts per code
- after that, a new code is required

### Extra Verification For Actions

In v1:

- cancel / return actions should not require an extra OTP step if the current session is already valid

## Payment-Redirect Failure Recovery

If payment succeeds but the redirect back to the website fails:

- provider confirmation remains the source of truth
- the order should still exist correctly in the system
- recovery can rely on:
  - order confirmation email
  - later OTP login

This avoids depending on fragile browser-only redirect success.

If the customer returns before provider confirmation arrives:

- the customer-facing flow may show a pending verification state until real payment truth is known

## Security Boundaries

The key security distinction in v1 is:

- entering an email during guest checkout does not equal verified ownership of that email identity
- real email-identity access requires OTP verification

That is why guest post-purchase access is intentionally limited to:

- the single newly created order
- a short-lived window

## System Responsibility Split

At a high level:

- `Supabase Auth` stores verified auth identity and session state
- `customer_profiles` stores reusable business/customer defaults
- `Next.js` handles application authorization logic around orders, panel access, and secure customer flows
- `Sanity` is not the system of record for customer auth data

## Open Topics Moved Elsewhere

This file intentionally does not define:

- panel layout
- panel navigation
- customer-panel URLs
- list/detail information architecture

Those belong in the dedicated customer-panel IA document.

## Notes

This file should be treated as the canonical high-level source for customer auth and access behavior in v1, including checkout-linked identity rules.
