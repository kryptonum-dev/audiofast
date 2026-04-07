# Commerce Data Model

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: `data-ownership.md`, `../business/coupon-rules.md`
Related files: `system-map.md`, `order-lifecycle.md`, `payment-process-model.md`, `cpo-and-b2c-relation.md`

## Purpose

This file defines the high-level operational entities needed for the B2C system.

It is intentionally conceptual for now and should later evolve into a more detailed data-modeling document.

## Core Entity Candidates

### Order

Represents a customer purchase attempt / transaction record.

Likely concerns:

- internal order number
- customer identity snapshot
- address snapshot
- order state
- totals
- coupon application summary
- linkage to minimal internal payment-attempt tracking

### Payment Attempt

Represents one technical payment attempt for an order.

This is intentionally:

- an internal technical safety layer
- not a separate business-facing order-status model

Likely concerns:

- order linkage
- local attempt identifier / sequence
- provider transaction/reference ID
- created timestamp
- confirmation / result timestamp
- minimal reconciliation metadata needed for retry, webhook truth, and duplicate protection

### Order Item

Represents a purchased item within an order.

Likely concerns:

- line type (`standard` or `cpo`)
- product / specimen identifier
- product name snapshot
- configuration snapshot where applicable
- quantity
- item price snapshot
- returnability snapshot

The current direction should explicitly support two line variants:

- standard configurable product lines
- `CPO` specimen lines

For `CPO` lines, the snapshot likely also needs:

- `CPO` specimen key
- specimen-specific title / brand snapshot
- fixed-price snapshot
- no configuration snapshot

### Customer Identity

Represents the lightweight customer identity used for B2C order access.

Likely concerns:

- email
- saved profile data
- customer preferences needed for future checkout prefill

Current rules:

- email is the identity key for customer-panel access
- the first order for a new email creates the initial reusable profile data
- guest checkout for an existing email must not overwrite reusable profile defaults automatically
- authenticated customers may update reusable profile defaults through `Dane konta` or explicit opt-in during checkout

### Customer Access / OTP

Represents temporary access or verification data for email-based customer panel entry.

Likely concerns:

- email identity linkage
- code / token
- expiration
- attempt handling
- verification result
- resend throttling

### Customer Session

Represents authenticated browser/device access after OTP verification.

Likely concerns:

- customer identity linkage
- session expiration
- browser/device scope
- logout / invalidation behavior

### Post-Purchase Temporary Access

Represents the short-lived single-order access granted immediately after guest checkout success.

Likely concerns:

- single-order linkage
- expiration window
- no full email-identity access

### Coupon

Represents a discount rule managed internally.

Likely concerns:

- code
- type
- scope
- value
- active flag
- expiration
- global usage limit

### Coupon Usage

Tracks application or redemption of coupons against orders.

### Shipment Metadata

Represents manual shipment-related information.

Likely concerns:

- courier
- tracking number
- timestamps

### Invoice Metadata

Represents invoice document linkage and publication state.

Likely concerns:

- file reference
- file name
- added date
- customer-visible state

### Order Status History

Tracks important order lifecycle changes over time.

### `CPO` Operational Availability

Represents the lightweight commerce-operational state of a unique `CPO` specimen.

Likely concerns:

- `CPO` specimen linkage
- current availability state
- optional linked order
- reason / source of the current state
- manual override information
- last-updated timestamp

Current direction:

- this is not a general stock system
- this exists only because a `CPO` item is a unique specimen
- a minimal v1 state set may be enough, for example `available`, `locked_by_order`, `sold`, and `manually_unavailable`
- the system may automatically move the item into `locked_by_order` when an order is created
- the Audiofast operator may manually change the state in admin when needed

### Return Case

Represents the separate return-handling process attached to an order.

Likely concerns:

- order linkage
- creation source
- current return-case state
- optional customer reason
- request timestamp
- internal notes
- closure without return vs completed return

The return case should be able to exist without immediately changing the main order status to `returned`.

## Questions Still To Resolve

- exact coupon usage lifecycle
- exact document storage linkage
- exact `CPO` availability state list and audit shape

## Proposed Future Sections

### 1. Entity List

### 2. Required Fields Per Entity

### 3. Snapshot Rules

### 4. Derived Fields

### 5. Audit / History Needs

### 6. Relationships Between Entities

### 7. Customer Identity And Access Model

### 8. Payment Attempt Model

### 9. `CPO` Availability Model

### 10. Return Case Model

## Notes

The main design principle should be that orders preserve the truth of the transaction at the time it happened, even if source product data changes later.
