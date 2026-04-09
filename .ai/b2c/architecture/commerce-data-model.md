# Commerce Data Model

Status: in progress
Owner: planning
Last updated: 2026-04-09
Depends on: `data-ownership.md`, `../business/coupon-rules.md`
Related files: `system-map.md`, `order-lifecycle.md`, `payment-process-model.md`, `cpo-and-b2c-relation.md`, `commerce-table-model.md`

## Purpose

This file defines the high-level operational entities needed for the B2C system.

It should stay conceptual enough to explain the domain clearly, while the exact table layout lives in:

- `commerce-table-model.md`

## Accepted Core Entities

### Order

Represents one purchase attempt / transaction record.

The accepted v1 direction is:

- one shared `orders` table for both standard and `CPO` purchases
- order stores the main lifecycle status
- order stores purchase-time snapshots and totals
- order stores lightweight payment, shipment, invoice, and discount metadata
- public order number format is `AF-YYYY-NNNNN`

Key concerns:

- internal ID plus public order number
- customer linkage
- current order status
- status history
- payment validity window
- purchase-time customer/address snapshot
- totals and discount result

### Order Item

Represents one purchased line belonging to an order.

The accepted v1 direction is:

- one shared `order_items` table for both standard and `CPO` lines
- line stores quantity, price snapshot, discount effect, and returnability
- line stores flexible product-specific detail in `item_snapshot`

Key concerns:

- line type (`standard` or `cpo`)
- product/specimen key
- product and brand snapshot
- quantity
- line subtotal / line discount / line total
- configuration snapshot for standard products
- purchase-time `CPO` context for `CPO` lines

The accepted `item_snapshot` direction is:

- standard products keep model plus rich selected-option context
- `CPO` lines keep only minimal purchase-time `CPO` state context

### Customer Profile

Represents reusable customer defaults for future checkout and `Dane konta`.

The accepted v1 direction is:

- customer auth/session is handled by `Supabase Auth`
- reusable business defaults live in `customer_profiles`
- profile is created only after the first successful paid order
- profile changes affect future orders only

The accepted profile default shapes now include:

- `default_shipping_address`
- `default_invoice_data`

### Coupon

Represents one discount rule.

The accepted v1 direction is:

- one `coupons` table
- no separate `scope_type`
- one coupon max per order
- product-specific coupons may reference multiple product keys
- product-specific fixed discounts apply per eligible unit quantity
- usage count increments only after payment success

The accepted order-level discount snapshot now lives in:

- `orders.used_discount`

### Return Case

Represents the separate return workflow attached to an order.

The accepted v1 direction is:

- one minimal `return_cases` table
- whole-order return handling only
- no partial-return tables in v1
- at most one open return case per order at a time

### `CPO` Operational Availability

Represents the lightweight operational state of a unique `CPO` specimen.

The accepted v1 direction is:

- stays on the `CPO` document in `Sanity`
- does not get its own `Supabase` table
- status set: `available`, `on_hold`, `sold_out`, `manually_unavailable`
- archive state remains separate from availability state

## Explicit V1 Non-Entities

To keep the model lean, v1 intentionally does not introduce separate business tables for:

- payment attempts
- order status history
- shipment metadata
- invoice metadata
- coupon usages
- `CPO` availability

Those concerns are handled through:

- small scalar fields on `orders`
- JSON fields on `orders`
- or `Sanity` state in the case of `CPO`

## Payment Model Direction

The accepted v1 payment foundation is:

- one short `awaiting_payment` window of `15 minutes`
- no long-lived retry-on-same-order flow
- no separate `payment_attempts` table
- the provider confirmation/webhook is the source of truth
- if the customer abandons the Przelewy24 page, they do not get a dedicated resume-payment flow in v1
- if the payment window expires, the customer must start a new checkout / new order

## Invoice / Document Direction

The accepted v1 invoice direction is:

- invoice PDF lives in private `Supabase Storage`
- the order stores the invoice file reference and metadata in `invoice_data`
- upload UI may still be implemented in the `Sanity App SDK` admin panel

## Questions Still To Resolve

- exact admin/frontend query patterns
- final migration definitions

## Notes

The main design principle is still:

- orders preserve the truth of the transaction at the time it happened, even if source product data changes later
