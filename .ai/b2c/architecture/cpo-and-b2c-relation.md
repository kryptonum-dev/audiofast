# CPO And B2C Relation

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: `data-ownership.md`, `cart-and-checkout-model.md`
Related files: `commerce-data-model.md`, `admin-panel-sanity.md`, `../business/product-buyability-rules.md`

## Purpose

This file explains how the existing `CPO` product domain should fit into the Audiofast B2C model.

Its role is to make one point explicit:

- `CPO` is not a separate ecommerce project
- `CPO` is a second buyable product variant inside the same B2C system

## Current Resolution

The B2C system should support one shared commerce flow for two product variants:

- standard catalog products that the customer configures before adding to cart
- `CPO` specimen products that already represent one defined item with fixed setup and price

This means both variants should be able to use:

- the same cart
- the same checkout
- the same order model
- the same payment flow
- the same customer panel
- the same operator admin panel

## Product Variant Difference

### Standard Product

The standard product model remains:

- configurable before add to cart
- reconfigurable in cart
- quantity-based
- priced from the pricing layer

### `CPO` Product

The `CPO` product model should be treated as:

- a specific specimen rather than a generic configurable base product
- added to cart as-is
- not reconfigurable in cart
- effectively quantity one per specimen
- priced as one fixed item snapshot

## Shared Cart And Checkout Model

The cart and checkout should not split into separate flows.

Instead, they should use one mixed line-item model with at least:

- `standard` line type
- `cpo` line type

The key difference is not the checkout flow itself.
The key difference is what each line stores and validates.

For a standard line:

- product reference
- configuration snapshot
- price snapshot
- quantity

For a `CPO` line:

- specimen reference
- specimen snapshot
- fixed price snapshot
- current operational availability state

## `CPO` Operational Availability

`CPO` needs one lightweight operational layer because each specimen is unique.

This should not become a full stock or reservation subsystem.

Current direction:

- a minimal v1 state set may be enough, for example `available`, `locked_by_order`, `sold`, and `manually_unavailable`
- when an order is created with a `CPO` item, the system may automatically move that specimen into `locked_by_order`
- if payment is confirmed, the specimen may move into a sold / unavailable state
- the Audiofast operator may still manually change the availability state when needed

This layer exists only to protect unique items and to give operators control.

## Admin Control Principle

The Audiofast operator should retain manual power over `CPO` operational availability.

That means:

- the system may set the default safe state automatically
- the operator may manually override the `CPO` state in admin
- the operator should be able to understand why the item is currently unavailable

At a minimum, the operator should be able to see:

- current `CPO` availability state
- whether the item is locked by an order
- the linked order reference when relevant

## Data Ownership Direction

The intended split is:

- Excel owns business-managed `CPO` inputs such as specimen presence in the offer, key, descriptive data, and price input
- Sanity owns the public/editorial `CPO` document
- Supabase owns commerce-operational truth for orders and `CPO` availability state
- Next.js enforces buyability based on the combined result of these sources

This prevents a normal Excel sync from accidentally reopening a `CPO` item that operations intentionally blocked.

## Admin Panel Implication

The B2C admin panel should include a dedicated top-level `CPO` area in v1.

This is justified because `CPO` work is specimen-centric rather than order-centric.

The `CPO` area should help operators answer questions such as:

- which `CPO` items currently exist in the active offer
- which ones are `available`, `locked_by_order`, `sold`, or manually unavailable
- which order is currently linked to a specimen

At the same time:

- mixed orders should still clearly show when a line is `CPO`
- order detail should still expose the relevant `CPO` availability context
- manual override should be available in both the `CPO` operational workflow and the relevant order workflow when appropriate

The existing `CPO` content area in Sanity can remain the place for content editing.
The B2C admin surface should remain the place for commerce-operational decisions.

## Phase 03 Implication

This relation must be locked before deep commerce modeling because it affects:

- Excel contract scope
- data ownership boundaries
- cart line structure
- order item snapshots
- admin control design

Without this decision, Phase 04 would risk modeling standard products only and bolting `CPO` on afterward.

## Open Questions To Carry Forward

- what exact `CPO` availability states should exist in v1 beyond `locked_by_order`
- how should a `CPO` item be shown publicly when it is visible but not currently buyable
- how should operator override be audited in the final implementation
