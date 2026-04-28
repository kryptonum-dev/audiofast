# Phase 07 Step 06 - Cancellation Request Flow

Status: customer-side implemented
Owner: planning
Last updated: 2026-04-28
Depends on: `phase-07-step-04-orders-area.md`, `../../architecture/order-lifecycle.md`, `../../business/returns-and-cancellations-rules.md`

## Purpose

Define the minimal implementation path for customer-initiated order cancellation.

The selected direction is:

- do not add `cancellation_requested` as a main order status
- keep `orders.current_status` as the operational status
- add a separate cancellation request attached to an order
- keep cancelled orders visible in the customer panel

## Implementation Status

The customer-side flow is implemented.

Completed:

- `order_cancellation_requests` data model exists in Supabase.
- Customer request helper verifies ownership, allows only `paid` and `processing`, blocks duplicate open requests, and keeps `orders.current_status` unchanged.
- Customer server action requires an authenticated session and revalidates order detail/list paths.
- Order detail loader returns cancellation request summary, eligibility state, and customer-facing copy.
- Order detail UI shows eligible, pending, rejected, accepted/cancelled, and unavailable states with toast feedback.
- Focused Vitest coverage verifies paid and processing eligibility, shipped ineligibility, duplicate request blocking, ownership enforcement, and DTO/UI-state mapping through the order-detail loader.

Still future:

- Admin list/detail UI for open cancellation requests.
- Admin accept/reject actions.
- Operational refund coordination after an accepted cancellation.

## Mental Model

Order status answers: what is happening with the order?

Cancellation request status answers: what is happening with the customer's cancellation request?

Example:

- order status: `processing`
- cancellation request status: `open`

This means the order is still operationally in progress, but Audiofast needs to accept or reject the cancellation request.

## Implementation Phases

### 1. Data Model

Create an `order_cancellation_requests` table.

Minimal fields:

- `id`
- `order_id`
- `customer_email`
- `status`: `open`, `accepted`, `rejected`
- `reason`
- `customer_message`
- `admin_note`
- `requested_at`
- `resolved_at`
- `resolved_by`

### 2. Customer Request Logic

Create a server helper for cancellation requests.

Responsibilities:

- verify the authenticated customer owns the order
- allow requests only for `paid` and `processing`
- block duplicate open requests
- create an `open` cancellation request
- do not change `orders.current_status` yet

### 3. Customer Mutation

Create a customer-facing server action.

Responsibilities:

- require an authenticated customer session
- call the cancellation request helper
- revalidate the order detail and order list
- return typed UI results

### 4. Order Detail Data

Extend the order detail loader.

Add:

- active cancellation request summary
- cancellation eligibility state
- customer-facing cancellation message
- button state for available / pending / unavailable / already cancelled

### 5. Customer UI

Update the order detail cancellation section.

States:

- eligible: show `Poproś o anulowanie`
- pending: show request submitted / awaiting Audiofast confirmation
- rejected: show rejected message and current order state
- cancelled: show cancelled state
- unavailable: explain why cancellation is no longer possible

### 6. Future Admin Flow

Future admin panel should show open cancellation requests.

Admin actions:

- accept request
- reject request
- add internal note

When accepted:

- set request status to `accepted`
- set order status to `cancelled`
- set `cancelled_at`
- append status history
- mark refund handling as pending/manual

When rejected:

- set request status to `rejected`
- keep order status unchanged
- show rejection state to the customer

### 7. Visibility Rules

Cancelled orders remain visible in the customer panel.

Only expired unpaid `awaiting_payment` orders disappear from the normal customer list.

### 8. Tests

Cover:

- eligible `paid` order can request cancellation
- eligible `processing` order can request cancellation
- `shipped` order cannot request cancellation
- duplicate open requests are blocked
- order ownership is enforced
- cancelled orders remain visible
- detail DTO returns correct cancellation UI state
