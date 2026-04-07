# Order Lifecycle

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: current order-status decisions
Related files: `commerce-data-model.md`, `../business/returns-and-cancellations-rules.md`

## Purpose

This file defines the current v1 order lifecycle model for the Audiofast B2C system.

It captures:

- the internal order statuses
- what each status means
- how orders move between statuses
- what is system-controlled vs admin-controlled
- what the customer should be able to see at a structural level

Detailed email behavior does not belong here and should be finalized in the dedicated email thread.

## Status List

The current v1 status set is:

- `awaiting_payment`
- `paid`
- `processing`
- `shipped`
- `completed`
- `cancelled`
- `returned`

## Status Meanings

### `awaiting_payment`

The order is created when checkout is submitted and the customer is sent to `Przelewy24`.

This status means:

- the order exists in the system
- payment is not yet confirmed
- the payment window is still active

### `paid`

Payment has been confirmed by the payment provider callback/webhook.

This is a stable order status, not just a temporary technical event.

### `processing`

Audiofast has started handling the paid order internally.

This status is set manually by the operator.

### `shipped`

The parcel has actually been sent.

This status is set manually by the operator.

### `completed`

The order is operationally closed from Audiofast's point of view.

This status is set manually by the operator and is optional rather than mandatory immediately after shipment.

### `cancelled`

The order has been cancelled.

This is a final terminal status.

### `returned`

The order has been fully handled as a return.

This is a final terminal status and should only be used after the return process is actually completed on the Audiofast side.

## Happy-Path Flow

The normal lifecycle is:

- `awaiting_payment` -> `paid` -> `processing` -> `shipped` -> `completed`

## Exceptional End States

The current v1 exceptional final states are:

- `cancelled`
- `returned`

The current v1 model does not introduce separate main statuses such as:

- `expired`
- `payment_failed`
- `cancellation_requested`
- `return_requested`

It should also keep separate any `CPO` specimen availability states such as:

- `locked_by_order`
- `sold`
- `manually_unavailable`

Those are not main order statuses. They belong to the `CPO` operational availability layer.

## Transition Rules

### System-Controlled Transitions

#### Order Creation

- checkout submission creates the order as `awaiting_payment`
- if the order contains a unique `CPO` specimen, the commerce layer may also move that specimen into a locked availability state

#### Payment Confirmation

- only provider confirmation can move the order from `awaiting_payment` to `paid`
- browser redirect is not the source of truth
- minimal technical payment-attempt tracking may exist internally without introducing extra main order statuses
- if the order contains a `CPO` specimen, payment confirmation may also move that specimen into its final sold/unavailable state

#### Payment Expiration

- `awaiting_payment` remains active for `24 hours`
- expiration is handled by timestamp / logic, not by a separate status
- after expiration, the order is no longer payable and a fresh checkout/new order is required

### Admin-Controlled Transitions

Admin uses a single status select.

The model allows forward jumps in one action. The system does not need to force step-by-step UI transitions.

#### From `paid`

Admin may move the order to:

- `processing`
- `shipped`
- `completed`
- `cancelled`

#### From `processing`

Admin may move the order to:

- `shipped`
- `completed`
- `cancelled`

#### From `shipped`

Admin may move the order to:

- `completed`
- `returned`

#### From `completed`

Admin may move the order to:

- `returned`

### Read-Only / Terminal States

#### `awaiting_payment`

This status is effectively system-controlled and should not be manually edited through the normal admin status select.

#### `cancelled`

Terminal. No further normal status changes.

#### `returned`

Terminal. No further normal status changes.

## Transition Principles

### Forward Movement Only

In normal admin usage, statuses move forward only.

The system should not normally support:

- `shipped` -> `processing`
- `completed` -> `shipped`
- `paid` -> `awaiting_payment`

### No Auto-Insertion Of Skipped States

If the admin jumps forward from `paid` directly to `shipped` or `completed`, the system should store the selected new status directly.

It should not automatically insert skipped intermediate statuses.

This is an intentional simplification for v1.

### Email Logic Is Separate

Because skipped steps are allowed in the status select, future email logic must be based on the actual selected transition, not on all theoretical skipped statuses.

That should be finalized in the email thread.

## Cancellation Rules At The Status Level

### Customer Cancellation

Customer cancellation is allowed only when the order is in:

- `paid`
- `processing`

Customer cancellation is not available when the order is in:

- `awaiting_payment`
- `shipped`
- `completed`
- `cancelled`
- `returned`

### Admin Cancellation

Admin may set `cancelled` only from:

- `paid`
- `processing`

## Return Rules At The Status Level

### Customer Return Eligibility By Status

Customer return eligibility begins only after fulfillment.

At the status level, return can be initiated only when the order is in:

- `shipped`
- `completed`

### Admin Returned Status

Admin may set `returned` only from:

- `shipped`
- `completed`

### Return Request Separation

Customer return initiation should not immediately change the main order status to `returned`.

Instead:

- the current main order status remains `shipped` or `completed`
- a separate return request is recorded
- the separate return request should be treated as a return case attached to the order
- admin handles the case manually
- admin sets `returned` only when the return process is actually finished

### Return Case Lifecycle

The return process should be handled separately from the main order status.

For v1, the return case itself should stay minimal and support at least:

- `open`
- `closed_without_return`
- `completed`

Interpretation:

- `open` means the return process exists and is being worked on
- `closed_without_return` means the return process was closed without changing the main order status to `returned`
- `completed` means the return process is finished and the main order may move to `returned`

### Return Case Creation

A return case may be created in two ways:

- automatically, when the customer clicks `Return`
- manually, by admin, when the customer contacts Audiofast outside the customer panel

### Reopening Return Possibility

If a return case is closed as `closed_without_return` and the order is still within the active return window:

- the customer may initiate a new return request again

## Customer Visibility

At the structural level, the customer should generally be able to see the order lifecycle.

### Visible To Customers

- `paid`
- `processing`
- `shipped`
- `completed`
- `cancelled`
- `returned`

### `awaiting_payment` Visibility

`awaiting_payment` should be visible to the customer only while it is still active.

After the `24-hour` payment window passes:

- it should remain in the system
- it should remain visible in admin
- it should stop appearing as a normal active order in the customer panel

### Customer History Expectation

The client panel should show:

- the current order status
- the full status history of the order over time

That history should be readable as a customer timeline, for example showing when the order was created, paid, shipped, and so on.

## Status History

Even though the admin panel uses one current-status select, the system should store a status-change history internally.

At minimum, each entry should capture:

- previous status
- new status
- when the change happened
- whether the change was system-driven or admin-driven
- who changed it when it was a manual admin action

## Notes

This file defines the main status model only.

Detailed return workflow, customer panel behavior, and email behavior should continue to be refined in their dedicated domain files.
