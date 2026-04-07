# Admin Panel - Sanity

Status: closed
Owner: planning
Last updated: 2026-04-07
Depends on: resolved admin-panel architecture discussion
Related files: `../business/coupon-rules.md`, `invoice-and-documents.md`, `order-lifecycle.md`, `email-flow.md`, `cpo-and-b2c-relation.md`

## Purpose

This file records the resolved v1 information architecture for the operator-facing B2C panel built with `Sanity App SDK`.

It defines:

- the top-level admin navigation
- the role of the order list
- the role of the `CPO` operational list
- the structure of the order detail page
- where shipment, invoice, return, and coupon work should live
- the small v1 analytics area

## Final Resolution

### 1. Top-Level Navigation

The v1 admin panel should have four top-level destinations:

- `Orders`
- `CPO`
- `Coupons`
- `Analytics`

Rules:

- `Orders` is the main operational area
- `CPO` is a separate specimen-centric operational area for understanding the current `CPO` offer and its live availability state
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

### 3. `CPO` List View

The `CPO` area should exist because `CPO` work is specimen-centric rather than order-centric.

Its role is to help the operator:

- understand which `CPO` specimens currently exist in the active offer
- understand the live state of each specimen without opening individual orders
- manually change operational availability when needed
- jump to the related order or content entry when relevant

At a broad level, the `CPO` list should support:

- current availability state
- linked order visibility where relevant
- manual availability override
- navigation to the related order
- navigation to the related `CPO` content entry if useful

This should remain a lightweight operational list rather than a second full order-management system.

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
- `CPO` availability override may still appear in order detail when relevant, but the main scanning view for specimen status should live in the top-level `CPO` area

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
- `CPO` list = understand specimen status, override availability, navigate
- order detail = do the actual order work

The operator should not need to leave the order detail page to handle normal order operations such as:

- status progression
- shipment data
- invoice work
- return handling
- `CPO` availability override when the order contains a unique specimen item

The operator should also not need to search through orders one by one to answer a different question:

- which `CPO` items currently exist and what is the state of each one

That question belongs to the top-level `CPO` area, not to the order list.

### 13. Customer-Facing Side Effects

Some admin actions may create customer-facing consequences, but this file keeps that only at the structural level.

Broadly:

- status changes may trigger customer emails according to `email-flow.md`
- invoice publication may trigger invoice delivery communication
- return-case handling may affect what the customer sees for return state

Detailed customer-facing trigger rules belong in the domain files, not here.

## Notes

This file resolves the v1 admin-panel information architecture.

Detailed row contents, field lists, filters, and component-level UI can still be refined later during implementation planning.
