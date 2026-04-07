# Payment Process Model

Status: closed
Owner: planning
Last updated: 2026-04-07
Depends on: resolved payment-flow discussion
Related files: `order-lifecycle.md`, `customer-auth-and-access.md`, `email-flow.md`, `system-map.md`, `commerce-data-model.md`, `customer-panel-ia.md`

## Purpose

This file records the resolved v1 payment-process model for the Audiofast B2C system.

It defines:

- what happens from checkout submission to finished purchase
- how `Przelewy24` handoff, redirect, webhook confirmation, and recovery fit together
- how retries and expiration work
- how thank-you and order-access behavior should react to real payment confirmation

## Final Resolution

### 1. Checkout Submit And Order Creation

When the customer submits checkout:

- the order should be created immediately
- the order should be created before redirecting to `Przelewy24`
- the order should start in `awaiting_payment`
- the public order number should already exist at that moment

After checkout submit:

- the system should work against the created order
- the cart is no longer the active transaction object

If the customer later changes the basket materially and starts a new checkout:

- a new order may be created

The system does not need to implement automatic reuse/deduplication of existing unpaid orders in v1.

### 2. Business-Facing Payment Model

The v1 business-facing order model remains intentionally minimal:

- `awaiting_payment`
- `paid`

This means:

- there is no separate business payment-state model in v1
- failed, cancelled, or abandoned payment outcomes do not introduce extra business-facing order statuses
- the order remains `awaiting_payment` until payment is truly confirmed

### 3. Internal Technical Payment Tracking

Even though there is no separate business payment-state model, the implementation still requires minimal technical payment-attempt tracking for safety.

This tracking is:

- internal
- not customer-facing
- not a separate business-status layer

At minimum, each payment attempt should preserve:

- order linkage
- local payment-attempt identifier / sequence
- provider transaction or reference ID
- created timestamp
- result / confirmation timestamp when known
- enough provider linkage to reconcile callbacks and retries safely

This tracking exists to support:

- retry on the same order within the active window
- webhook truth handling
- duplicate-callback protection
- redirect vs webhook mismatch handling

### 4. Payment Attempts

The system should allow:

- multiple payment attempts on the same order while it is still within the active `24-hour` window

Rules:

- only one active payment attempt should exist at a time
- retrying payment within the valid window should stay on the same order
- once the order expires after `24 hours`, it becomes non-payable and requires a fresh checkout/new order

### 5. Source Of Truth

Payment truth in v1 is:

- the payment webhook

Rules:

- the webhook is the absolute source of truth for payment success
- browser redirect is never the source of truth
- redirect messaging may inform the interim UI state, but it must not finalize the order as paid on its own

### 6. Redirect And Verification Behavior

If the customer returns from `Przelewy24` before webhook confirmation arrives:

- the site should show a pending-verification state
- the site should not show final success yet
- the page may perform short automatic polling/refresh to resolve into the confirmed state if possible

If redirect reports failure/cancellation but the order is still active:

- the page should offer a retry-payment path

If redirect appears successful but webhook never confirms:

- the order must remain non-final
- the system must not treat it as paid

If redirect never happens but webhook confirms payment:

- the order should still move forward normally
- normal post-payment behavior should still happen

If redirect reports failure but webhook later confirms payment:

- final truth wins
- the page should switch into the successful confirmed state as soon as that truth is known

### 7. Thank-You Route And Guest Access

The thank-you route family should be dynamic and capable of showing at least:

- pending verification
- paid / confirmed
- invalid or expired access

Guest temporary thank-you access may exist before final payment confirmation, but:

- it must reflect the real current payment truth
- it must not falsely confirm payment

The thank-you page should show at least:

- order number
- basic order summary
- current payment-related situation
- what the customer can do next

If payment becomes confirmed while the guest is still on the thank-you page:

- the page should update into the confirmed view automatically if possible

### 8. Authenticated Access Behavior

If the customer is already authenticated during checkout:

- they should reach the order detail only once the correct payment truth is known
- if payment is still being verified, an interim pending state is acceptable first

For active unpaid orders:

- the customer panel should expose the order while the `24-hour` window is still active
- the order detail should allow retry/resume payment

For expired unpaid orders:

- direct order-detail access should still be possible
- the page should clearly show that the order is expired
- repayment should no longer be possible

If the user starts OTP login from a direct order link:

- successful login should return them to that exact order detail page

### 9. Retry / Resume Surfaces

The main retry-payment surfaces in v1 are:

- the guest thank-you flow for short-lived single-order access
- the authenticated order detail page for active unpaid orders

Retry logic should remain available only while:

- the order is still within the active payment window

### 10. Idempotency And Safety Rules

The payment system must behave idempotently.

This means duplicate or repeated provider events must not:

- create duplicate successful payment effects
- send duplicate confirmation emails
- insert duplicate final order transitions

Rules:

- only the first confirmed successful payment event may move the order from `awaiting_payment` to `paid`
- later duplicate success callbacks should be treated as safe no-ops
- technical callback noise should stay out of the customer-visible order history

### 11. Customer Visibility

Customer-facing visibility should stay simple:

- active unpaid orders are visible while still payable
- expired unpaid orders stop appearing as normal active orders in the customer panel
- expired unpaid orders may still be accessed directly and viewed as expired

The customer does not need to see:

- raw payment-attempt logs
- provider callback history
- technical payment metadata

### 12. Admin Visibility

Detailed payment-attempt visibility in the admin panel is not mandatory for v1.

The important v1 requirement is:

- reliable internal payment handling

Deeper admin payment-attempt inspection can remain an implementation/detail concern rather than a planning-level feature requirement.

### 13. Email Rules

Payment-related email rules remain strict:

- no customer email on checkout submit
- no customer email on redirect alone
- the main order confirmation email sends only after real payment confirmation
- `awaiting_payment` expiration remains silent in v1
- if the customer retries payment on the same order and that payment later succeeds, the normal confirmation email should still send once at the first real successful confirmation

## Notes

This file resolves the broad payment-process model for v1.

Low-level `Przelewy24` SDK details, webhook payload mapping, and exact callback parameter handling can still be defined later during implementation work.
