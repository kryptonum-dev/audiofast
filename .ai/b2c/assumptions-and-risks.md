# B2C Assumptions And Risks

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: `b2c-implementation-overview.md`, `open-threads.md`
Related files: `scope.md`, `business/excel-contract.md`

## Purpose

This file tracks the assumptions currently shaping the B2C plan and the risks that could affect implementation, launch quality, or scope.

## Current Assumptions

### Business Assumptions

- order volume may initially be low or unpredictable
- not all products will be sellable online
- direct sales are a selective extension of the current business
- operational simplicity is more important than feature breadth

### Data Assumptions

- Excel can be extended with the fields needed for B2C
- Excel-based flags can be synced reliably into the application layer
- existing pricing data remains usable for direct-sales flow

### Technical Assumptions

- the current codebase is stable enough to absorb a commerce layer incrementally
- `Supabase` is the correct home for operational B2C data
- `Sanity App SDK` is the preferred internal UI surface for the operator panel
- `Przelewy24` can satisfy v1 payment needs without fallback logic

### Operational Assumptions

- invoices will continue to be created manually by the business
- courier and tracking information can be managed manually in v1
- the team will provide legal content in time for launch

## Key Risks

### 1. Excel Contract Risk

If the Excel structure is not finalized early, the whole buyability and returnability model can remain ambiguous and delay implementation.

Mitigation:

- define the Excel contract early
- document required fields explicitly
- validate ownership of each field

### 2. Customer Identity Sharing Risk

The v1 customer-access model is based on ownership of the email inbox.

This means:

- all orders tied to the same email become visible within one OTP-authenticated customer identity
- different names, phone numbers, or addresses on separate orders do not create separate customer-panel identities

Mitigation:

- document this rule explicitly in the customer-panel IA and checkout/auth docs
- preserve immutable order-time customer snapshots on each order
- avoid silently overwriting reusable customer data from guest checkouts on an existing email identity

### 3. Payment Integration Risk

`Przelewy24` may introduce implementation or environment complexity not yet fully assessed in planning.

Mitigation:

- validate technical requirements early
- confirm sandbox and webhook expectations early

### 4. Document Delivery Risk

Invoice PDF delivery by email introduces file access, attachment, and operational edge cases.

Mitigation:

- define storage and attachment strategy clearly before implementation

### 5. Cart Complexity Risk

Allowing full product reconfiguration inside the cart may be more complex than a static cart model.

Mitigation:

- design the cart data shape before UI work starts
- preserve configurator compatibility in planning

### 6. Customer Access Risk

OTP-only access is lightweight but requires careful thinking around expiration, abuse prevention, and order retrieval UX.

Mitigation:

- keep the resolved authentication model aligned with panel IA decisions

### 7. Legal / Business Rule Risk

Returns, company invoice handling, and cancellation rules are simple in principle but still need careful translation into user-visible logic.

Mitigation:

- finalize rule wording before UI/logic is built

## Blockers To Watch

- missing Excel column contract
- missing order number format

## Notes

This file should evolve as planning becomes more concrete. Some assumptions should eventually disappear and become confirmed decisions.
