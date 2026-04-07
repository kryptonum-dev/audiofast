# Returns And Cancellations Rules

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: `excel-contract.md`
Related files: `../architecture/order-lifecycle.md`

## Purpose

This file defines the current working rules for cancellations and returns in the B2C system.

## Current Decisions

### Cancellation Rule

- the customer can cancel an order only while it is in `paid` or `processing`
- the customer cannot cancel an order in `awaiting_payment`, `shipped`, `completed`, `cancelled`, or `returned`

### Admin Cancellation Rule

- admin can set `cancelled` only from `paid` or `processing`

### Returnability Source

- product returnability is controlled in Excel

### Whole-Order Rule

- if an order contains at least one non-returnable product, the whole order is non-returnable in v1

### Partial Returns

- partial returns are not allowed in v1

### Company Invoice Rule

- if the buyer purchases with company invoice data, returns can be disabled entirely

### Return Window

- self-service return is allowed only during an active return window
- in v1 the return window lasts `14 days` from the moment the order becomes `shipped`

### Return Status Eligibility

- return can be initiated only when the order is in `shipped` or `completed`

### Return Request Handling

- the client panel should provide a return action for eligible orders
- clicking return should create a separate return request
- clicking return should not immediately change the main order status to `returned`
- the separate return request should open a return-handling case for admin
- admin handles the return manually
- admin sets `returned` only after the return process is actually finished
- admin must also be able to create a return case manually when the customer contacts Audiofast outside the panel
- admin must be able to close a return case without returning the order
- if a return case is closed without return and the order is still within the active return window, the customer may start a new return request again

### Return Request Data

- return reason should be optional in v1

### Return Case States

For v1, the separate return case should stay minimal and support at least:

- `open`
- `closed_without_return`
- `completed`

Interpretation:

- `open` means a return case exists and is being handled
- `closed_without_return` means the return case was closed, but the order does not become `returned`
- `completed` means the return case is finished and the main order can become `returned`

## Questions Still To Clarify Later

- what exact operator flow handles approved cancellation?
- what exact operator flow handles approved return?
- how does refund communication relate to cancellation vs return?
- for `CPO` items, when and how may the operator manually restore availability after cancellation or return handling?

## Proposed Future Sections

### 1. Customer-Visible Rules

- when cancel action is visible
- when return action is visible
- when actions disappear
- how the panel should explain an already-requested return

### 2. Operator Rules

- who can approve or process each action
- which fields must be recorded
- when a return case is created automatically vs manually
- how an admin closes a mistaken or abandoned return request

### 3. Status Interaction

- which order states allow cancellation
- which order states allow return
- when admin may set `cancelled`
- when admin may set `returned`

### 4. Email Interaction

- customer action confirmation
- operator action confirmation
- refund / closure communication

## Notes

This rule set is intentionally simplified for v1 and should stay order-level unless the business explicitly asks for item-level returns later.

The customer panel should preserve the distinction between:

- the main order status
- separate return-request handling

The admin panel should preserve the distinction between:

- the main order status
- the separate return case used to handle return operations
