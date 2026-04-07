# Customer Panel IA

Status: closed
Owner: planning
Last updated: 2026-04-07
Depends on: resolved customer-panel structure discussion
Related files: `../open-threads.md`, `customer-auth-and-access.md`, `order-lifecycle.md`

## Purpose

This file records the resolved v1 information architecture for the Audiofast B2C customer panel.

It defines:

- the public entry point
- the authenticated views
- the URL structure
- how thank-you pages relate to the panel
- where order actions live
- how reusable customer data fits the panel

## Final Resolution

### 1. Panel Entry Point

The public customer-access entry point is:

- `konto-klienta`

This route is the email + OTP gateway for returning-customer access.

If the customer already has a valid session:

- entering `konto-klienta` should redirect to the main order list

The OTP email-entry step and OTP code-entry step should remain on the same route as different UI states rather than separate public pages.

### 2. Authenticated View Set

The authenticated customer panel contains only these main destinations in v1:

- `Zamowienia`
- `Dane konta`

There is:

- no separate dashboard
- no extra profile/settings sections beyond reusable customer data

Logout should be exposed as a global action in the authenticated panel navigation rather than as a separate route.

### 3. URL Structure

The preferred Polish-facing route structure is:

- `konto-klienta`
- `konto-klienta/zamowienia`
- `konto-klienta/zamowienia/[orderNumber]`
- `konto-klienta/dane-konta`

Rules:

- `konto-klienta` is the public access gateway
- `konto-klienta/zamowienia` is the default authenticated landing page
- `konto-klienta/zamowienia/[orderNumber]` uses the public order number, not an internal database ID
- protected routes should preserve the intended destination and return the customer there after successful OTP verification

### 4. Order List View

The order list is the default authenticated landing page.

At the structural level:

- it lists all B2C orders associated with the authenticated email identity
- clicking an order opens the order detail view
- active `awaiting_payment` orders should appear in the main list while still within the active payment window
- expired `awaiting_payment` orders should disappear from the customer list after the `24-hour` window

Detailed list contents, sorting, and presentation can be finalized later during implementation planning.

### 5. Order Detail View

Each order has a single dedicated detail page.

At the structural level:

- the detail page is a single page rather than a tabbed area
- it should show the current status and full order history
- invoice access lives on the order detail page only
- the invoice area may temporarily exist without any invoice document yet
- cancellation action lives on the order detail page only
- return action lives on the order detail page only

Detailed page composition can be finalized later during implementation planning.

### 6. Return Request Placement

Return handling must remain visibly separate from the main order status.

The order detail page should include:

- a separate return-request section

Rules:

- this section is customer-visible only when a return case for that order is active in the admin flow
- the customer cannot remove, hide, or manually dismiss the section
- the customer should not get user-facing handling for `closed_without_return` beyond what is necessary for the currently active case state
- return-completion or closure communication may still happen outside the panel through email/manual handling

### 7. Thank-You Page Relationship

The thank-you page is not part of the customer panel.

It should be:

- a normal Audiofast page
- dynamically rendered per completed order
- located outside the `konto-klienta` route family

Current direction:

- use a simple public-facing route such as `podziekowania-za-zakup`
- use short-lived secure state or token handling behind the scenes
- avoid exposing raw order identifiers or raw email values in the URL

If the thank-you page is opened without valid temporary access:

- show a dedicated invalid/expired state
- provide a CTA to `konto-klienta`
- do not show a hard `404`

### 8. Thank-You Access Scope

The thank-you page grants only basic immediate post-purchase access.

It should allow:

- viewing the newly completed order
- viewing basic confirmation information

It should not allow:

- access to all orders for the email
- cancellation actions
- return actions
- invoice actions that belong to the authenticated customer panel

The thank-you page should include a link to the customer-panel entry point:

- `konto-klienta`

### 9. Logged-In Purchase Outcome

If the customer is already OTP-authenticated during checkout:

- after successful purchase, redirect directly to the new order detail page inside the customer panel

There is no need for a separate in-panel thank-you page for authenticated customers in v1.

### 10. Email And Deep-Link Behavior

Where possible, customer-facing emails should link toward the target order detail.

Security behavior:

- if the customer is already authenticated, the deep link should open the target order detail directly
- if the customer is not authenticated, the system should send them through `konto-klienta`
- after successful OTP verification, the system should return them to the intended order detail page

The same post-login return behavior should apply to manual navigation to protected panel URLs.

### 11. Dane Konta View

`Dane konta` is a single authenticated page for reusable customer data.

In v1 it should mean:

- reusable checkout defaults
- editable customer/contact data
- editable billing/invoice data used for future orders

It is:

- one single page
- editable
- authenticated-only

It is not:

- a classic account-management area
- a password/security settings area
- a historical-order editor

### 12. Reusable Data And Order Snapshot Rules

Historical orders must always preserve the original order-time snapshot.

The reusable `Dane konta` profile follows these rules:

- the first order for a new email creates the initial reusable checkout data
- guest checkout for an email that already has orders must not overwrite reusable data
- logged-in checkout should prefill from reusable data
- if the logged-in customer changes checkout data, the order uses the submitted values for that order snapshot
- reusable data updates only if the logged-in customer explicitly opts in through a checkbox during checkout or edits `Dane konta` directly

### 13. Identity Rule

The customer-panel identity model for v1 is explicitly based on control of the email inbox.

This means:

- all B2C orders tied to the same email belong to one OTP-authenticated customer identity
- those orders remain accessible together even if names, phone numbers, or addresses differ between orders
- order detail pages must always show the order-specific snapshot, not the current reusable profile values

## Notes

This file resolves the customer-panel structure thread for v1.

Detailed UI composition can still be refined later during implementation planning, but the core view model and routing model should now be treated as decided.
