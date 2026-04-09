# Email Flow

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: current lifecycle and authentication decisions
Related files: `invoice-and-documents.md`, `order-lifecycle.md`, `customer-auth-and-access.md`, `payment-process-model.md`

## Purpose

This file defines the current v1 transactional email model for the Audiofast B2C system.

It covers:

- which customer-facing emails exist
- which events trigger them
- which events stay silent
- OTP email rules
- invoice attachment behavior
- how skipped order-status transitions should affect email sending

This file is intentionally focused on customer-facing transactional email. Internal operator notification emails are out of scope for v1.

## Core Principles

The current v1 email approach is:

- customer-facing only
- practical and minimal
- based on real lifecycle events, not on every possible technical state
- separated from admin-only operational actions when possible

## Sending Architecture

Transactional B2C emails should be sent:

- from the `Next.js` backend / application layer
- through the existing Microsoft Graph-based mail infrastructure

This means:

- the email-delivery engine should live in secure server-side application logic
- the admin panel may trigger or initiate actions that lead to emails
- but the `Sanity App SDK` layer should not itself be treated as the email sender

At the architecture level, this keeps email sending aligned with:

- order state changes
- OTP verification flow
- secure backend authorization logic

## OTP Emails

### OTP Access Email

OTP emails are required for customer-panel access.

Current rules:

- OTP uses a one-time code
- OTP is not a magic link
- OTP validity is `15 minutes`
- OTP email is separate from order-lifecycle emails

### Unknown Email Behavior

The OTP flow should preserve the generic-response principle.

This means:

- the UI should not reveal whether an email has B2C orders
- the overall access flow should stay privacy-conscious

## Order Lifecycle Emails

### No Email For `awaiting_payment`

In v1, no customer email should be sent when:

- checkout is submitted
- the customer is redirected to payment
- the order is only in `awaiting_payment`

### Paid / Order Confirmation Email

When payment is confirmed and the order becomes `paid`:

- send the main order confirmation email

This must happen only after real provider confirmation:

- not on checkout submit
- not on redirect alone

This email should still be sent even if:

- the customer already saw a thank-you page
- the customer already has temporary access to the new order

The reason is that email remains the reliable fallback if redirect/session handling fails.

### Required Content For The Paid / Confirmation Email

The paid / confirmation email should include at minimum:

- order number
- basic order summary
- purchased items / configurations summary
- total
- the email used for order access
- a clear CTA explaining that future order access is available via email + OTP

### Processing Email

When the order changes to `processing`:

- send a customer email

If Audiofast provides a fulfillment estimate or note:

- include it in the email

If no such note exists:

- the email should still send in a simpler form

### Shipped Email

When the order changes to `shipped`:

- send a customer email

If shipment metadata exists:

- include courier
- include tracking number

If shipment metadata is missing:

- the shipped email may still be sent as a simpler shipment confirmation

### No Email For `completed`

In v1, changing the order to `completed` should not trigger a customer email.

`Completed` is treated primarily as an internal closure state.

## Invoice Emails

### Invoice Availability Email

Adding an invoice to the order should trigger its own dedicated email.

This should happen:

- when an invoice is actually attached / added
- regardless of whether the main order status changes at the same moment

### Invoice Attachment Rule

The invoice email should include:

- the invoice PDF as an attachment

### No Invoice In Status Emails

To keep behavior simple and predictable:

- invoice delivery should not be mixed into status emails such as `processing` or `shipped`
- invoice communication should happen only through the dedicated invoice-added event

## Cancellation Emails

### Customer-Initiated Cancellation

If a customer cancels an eligible order and the cancellation is accepted/applied:

- send a cancellation confirmation email

### Admin-Initiated Cancellation

If Audiofast changes an order to `cancelled`:

- send a customer cancellation email

From the customer's perspective, the order outcome still changed and should be clearly communicated.

## Return Emails

### Return Request Acknowledgment

When the customer initiates a return request:

- send an immediate acknowledgment email

This is important because:

- the main order status does not become `returned` immediately
- the customer still needs confirmation that the request was received

### Final Returned Email

When Audiofast finishes the return process and sets the order to `returned`:

- send a final return-completion email

### No Final Return Email For Closed-Without-Return Cases

If the separate return case is closed without return:

- do not send the final returned/completion email

The final return-completion email is reserved only for:

- real completed returns
- the main order transition to `returned`

## Silent Events

The following should remain silent in v1:

- checkout handoff / `awaiting_payment`
- `awaiting_payment` expiration after `15 minutes`
- `completed`
- same-status re-save actions

## Status-Jump Email Rule

Because the order-status model allows forward jumps in a single select:

- email sending must be based only on the actual selected resulting status
- skipped intermediate statuses must not trigger their own emails automatically

Example:

- if admin changes an order directly from `paid` to `shipped`
- send only the `shipped` email
- do not also send the `processing` email

## Re-Send Protection

If the admin re-saves the same status without changing it:

- do not resend the same lifecycle email in v1

## Recipient Rules

In v1, lifecycle emails should be sent only to:

- the order email address used for that order

## Scope Boundary

In v1, the email system should remain:

- customer-facing only
- not an internal operator notification system

Internal operations should rely on:

- the admin panel
- status history
- order management UI

## Notes

This file should now be treated as the canonical high-level email model for v1.
