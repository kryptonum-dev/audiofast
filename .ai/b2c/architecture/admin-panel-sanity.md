# Admin Panel - Sanity

Status: closed
Owner: planning
Last updated: 2026-05-07
Depends on: resolved admin-panel architecture discussion
Related files: `../business/coupon-rules.md`, `invoice-and-documents.md`, `order-lifecycle.md`, `email-flow.md`, `cpo-and-b2c-relation.md`

## Purpose

This file records the resolved v1 information architecture for the operator-facing B2C panel built with `Sanity App SDK`.

It defines:

- the top-level admin navigation
- the role of the order list
- how `CPO` operational context appears inside the shared order workflow
- the structure of the order detail page
- where shipment, invoice, return, and coupon work should live
- the small v1 analytics area

## Final Resolution

### 1. Top-Level Navigation

The completed v1 admin panel has three top-level destinations:

- `Orders`
- `Coupons`
- `Analytics`

Rules:

- `Orders` is the main operational area
- standard-product and `CPO` order context is handled together inside `Orders`; there is no separate top-level `CPO` area in v1
- `Coupons` is a separate management area, not mixed into order detail
- `Analytics` exists as a very small top-level area in v1 so the structure can grow later
- no separate dashboard is needed beyond these destinations
- no extra top-level settings, finance, or returns areas are needed in v1

### 2. Default Entry

The default landing page of the admin panel should be:

- the order list

This first screen should help the operator:

- scan orders quickly
- recognize what needs attention
- open the correct order detail page

### 3. `CPO` Context

The original planning direction considered a separate `CPO` area. Phase 08 implementation intentionally kept the v1 panel smaller: `CPO` information appears where it is operationally needed, inside order listing/detail and coupon product selection.

This keeps operators in one shared order workflow while still helping them:

- recognize `CPO` order lines
- see `CPO` product context inside order detail
- use normal order operations for status, shipment, invoice, cancellation, and return work
- choose eligible `CPO` products when creating product-scoped coupons

### 4. Order List View

The order list should be:

- minimal
- operational
- mainly for scanning and navigation

At a broad level, it should support:

- pagination
- later filtering as needed

It should not try to be the place where most order work happens.

The list may show lightweight indicators such as:

- current status
- invoice availability
- return-request indicator
- whether the order contains a `CPO` item
- other small operational badges if useful later

The detailed contents of each order row can be finalized later during implementation planning.

### 5. Order Detail View

Each order should open into:

- one single long order-detail page

The order detail page should be the main work surface for operators.

It should not be split into:

- tabs
- nested subpages
- separate operational screens for shipment, invoices, or returns

### 6. Order Detail Section Order

The preferred broad order of sections on the order detail page is:

1. order summary / header
2. status and key actions
3. customer data
4. items and totals
5. shipment section
6. invoice section
7. return case section
8. status history

This keeps the page aligned with the natural operator workflow:

- understand the order
- understand current state
- act on operational sections
- review history when needed

For mixed orders, the `items and totals` section should clearly distinguish:

- standard configurable products
- `CPO` specimen products

If a `CPO` item is present, the order detail should also show its current operational availability state and the fact that the operator may override it manually when needed.

### 7. Status And Core Workflow

The main status change control should live:

- in the status/actions area on order detail

It should not live primarily on:

- the order list

Status remains the central workflow control, but shipment, invoice, and return handling should stay as clearly separate sections rather than being mixed into one overloaded action block.

If an order contains a `CPO` specimen, the operator should also be able to understand the specimen's current operational availability and linked-order context without leaving the main order workspace.

### 8. Shipment, Invoice, And Return Sections

These areas should each have their own dedicated section on the order detail page:

- shipment
- invoice
- return case

This means:

- shipment entry is handled in the shipment section
- invoice upload/publication is handled in the invoice section
- return handling is handled in the return section
- `CPO` context should appear in order detail when relevant, but there is no separate top-level `CPO` area in v1

### 9. Return Case Placement

Return handling should stay:

- inside the order detail page
- as a dedicated section

It should not become:

- a separate top-level admin area in v1

The return section should appear when relevant, especially:

- when a return case exists
- when the operator needs to work with a return case for that order

### 10. Coupon Management

Coupon management should live:

- as a separate top-level admin area

It should be treated as:

- a distinct operational area
- not part of one specific order page

### 11. Analytics

The v1 admin panel should include:

- a very small top-level `Analytics` area

Its purpose is not to become a full reporting system yet.

The current direction is:

- simple revenue over a selected period
- optionally total orders in the same period

This exists mainly to establish the architecture for future analytics growth.

### 12. List Vs Detail Responsibility

The panel should follow this clear responsibility split:

- order list = scan, recognize, navigate
- order detail = do the actual order work

The operator should not need to leave the order detail page to handle normal order operations such as:

- status progression
- shipment data
- invoice work
- return handling
- `CPO` context review when the order contains a unique specimen item

### 13. Customer-Facing Side Effects

Some admin actions may create customer-facing consequences, but this file keeps that only at the structural level.

Broadly:

- status changes may trigger customer emails according to `email-flow.md`
- invoice publication may trigger invoice delivery communication
- return-case handling may affect what the customer sees for return state

Detailed customer-facing trigger rules belong in the domain files, not here.

## Notes

This file records the v1 admin-panel information architecture as completed in Phase 08.

Future row contents, field lists, filters, and component-level UI changes should be treated as follow-up refinements rather than Phase 08 blockers.
