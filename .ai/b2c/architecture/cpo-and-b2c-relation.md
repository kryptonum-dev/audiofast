# CPO And B2C Relation

Status: completed
Owner: planning
Last updated: 2026-04-08
Depends on: `data-ownership.md`, `cart-and-checkout-model.md`
Related files: `commerce-data-model.md`, `admin-panel-sanity.md`, `../business/product-buyability-rules.md`

## Purpose

This file explains how the existing `CPO` product domain fits into the Audiofast B2C model.

Its role is to make one point explicit:

- `CPO` is not a separate ecommerce project
- `CPO` is a second buyable product variant inside the same B2C system

## Current Resolution

The B2C system uses one shared commerce flow for two product variants:

- standard catalog products that the customer configures before adding to cart
- `CPO` specimen products that already represent one defined item with fixed setup and price

This means both variants use:

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

The `CPO` product model is treated as:

- a specific specimen rather than a generic configurable base product
- added to cart as-is
- not reconfigurable in cart
- effectively quantity one per specimen
- priced as one fixed item snapshot

## Shared Cart And Checkout Model

The cart and checkout do not split into separate flows.

Instead, they use one mixed line-item model with at least:

- `standard` line type
- `cpo` line type

For a standard line:

- product reference
- configuration snapshot
- price snapshot
- quantity

For a `CPO` line:

- specimen reference
- specimen snapshot
- fixed price snapshot
- current known availability state

Detailed purchase-time snapshot structure belongs to Phase 04.

## `CPO` Business Contract

The current `CPO` business feed comes from Excel and syncs into `Sanity`.

Agreed business inputs include:

- `Marka`
- `Nazwa`
- `Klucz`
- `Cena`
- `URL`
- `Opis`
- `Sprzedaż Online`
- `Zwrot`

One row represents one unique specimen.

## `CPO` Operational Availability

`CPO` needs one lightweight operational layer because each specimen is unique.

This is intentionally not a full stock subsystem.

### Agreed v1 Status Set

- `available`
- `on_hold`
- `sold_out`
- `manually_unavailable`

### Status Meanings

- `available`: eligible for purchase if all other business rules also allow it
- `on_hold`: reserved by an existing order / awaiting-payment flow
- `sold_out`: final sold state
- `manually_unavailable`: manually blocked by the Audiofast team

### Automatic State Changes

- valid order creation may move `available` to `on_hold`
- payment expiration may move `on_hold` back to `available`
- payment success may move `on_hold` to `sold_out`

### Manual Override Principle

- the Audiofast operator may manually change availability in v1
- v1 does not require strict restriction logic on manual transitions
- however, `manually_unavailable` must block creation of new orders

### Minimal v1 Metadata

At minimum, the operational layer should preserve:

- current availability status
- `holdUntil`
- optional linked order reference when relevant

Reason / source tracking can remain optional for v1.

## Archive And Availability Stay Separate

Archive state and availability state must not be merged into one stored field.

Instead:

- archive / active-offer visibility represents whether the specimen belongs in the public offer
- availability status represents the operational state of the specimen

These are combined only in runtime logic.

### Runtime Buyability Rule

A `CPO` item is buyable only when all of these are true:

- the row still exists in the business feed and the document is not archived
- `Sprzedaż Online` is true
- valid price exists
- availability status is `available`

### Archived Product Rule

- archived `CPO` items are not buyable for new customers
- archive does not cancel an already-created valid awaiting-payment order
- if an archived specimen is still `on_hold`, the existing buyer may still complete payment
- if that payment later expires, the specimen may become `available` internally again but still remains non-buyable because it is archived

## Data Ownership Direction

The agreed split is:

- Excel owns upstream `CPO` business inputs
- Sanity owns the public/editorial `CPO` document
- Sanity also owns live `CPO` operational availability in v1
- Supabase owns the orders that may trigger availability updates
- Next.js updates `Sanity` availability based on order/payment events and reads `Sanity` for storefront buyability

This prevents normal Excel sync from reopening or relisting a specimen that operations intentionally blocked.

## Admin Panel Implication

The earlier planning direction considered a dedicated top-level `CPO` area for v1. Phase 08 intentionally completed a smaller admin surface: `CPO` context is handled inside the shared `Orders` workflow and the coupon product picker, without a separate top-level `CPO` destination.

The admin surface should still help operators answer questions such as:

- which `CPO` items currently exist in the active offer
- which ones are `available`, `on_hold`, `sold_out`, or `manually_unavailable`
- which specimen is archived and therefore not part of the active offer
- which order is currently linked to a specimen when relevant

At the same time:

- mixed orders should still clearly show when a line is `CPO`
- order detail should still expose the relevant `CPO` availability context
- archived `CPO` items may still appear in order context when needed

## Phase 03 Implication

This relation had to be locked before deep commerce modeling because it affects:

- Excel contract scope
- data ownership boundaries
- cart line structure
- order item snapshots
- admin control design
