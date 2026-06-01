# Product Buyability Rules

Status: completed
Owner: planning
Last updated: 2026-04-08
Depends on: `excel-contract.md`
Related files: `pricing-and-tax-rules.md`, `../architecture/cart-and-checkout-model.md`, `../architecture/cpo-and-b2c-relation.md`

## Purpose

This file defines when a product can be purchased directly and how the storefront should behave based on that status.

The B2C model covers two buyable product shapes:

- standard configurable catalog products
- fixed `CPO` specimen products

## Current Decisions

### Buyable Standard Product

A standard catalog product is buyable only when:

- runtime `Sprzedaż Online` is true
- valid price data is available

The upstream source of the two business flags is Excel, but the runtime value used by the storefront is the synced result stored in `Sanity`.

### Non-Buyable Standard Product

A standard catalog product is non-buyable when:

- runtime `Sprzedaż Online` is false
- or it has no valid price
- or it has no valid product `URL` / `price_key` mapping

### Standard Product Aggregation Rule

The sellable and returnable flags are product-level, not model-level.

Rules:

- product identity is the `URL` / `price_key`
- multiple pricing rows with the same `URL` are still one product
- if at least one row for a given `URL` has `TAK`, the product gets that flag

### Buyable `CPO` Product

A `CPO` specimen is buyable only when:

- it is not archived
- runtime `Sprzedaż Online` is true
- it has valid price data
- its operational availability status is `available`

### Non-Buyable `CPO` Product

A `CPO` specimen is non-buyable when:

- it is archived
- or runtime `Sprzedaż Online` is false
- or it has no valid price
- or its operational availability is `on_hold`, `sold_out`, or `manually_unavailable`

## CTA Visibility Rules

### For Buyable Products

Show both:

- `Ask about product`
- `Add to cart`

### For Non-Buyable Products

Show only:

- `Ask about product`

## Configuration Rules

For standard configurable products:

- buyability is controlled at the product level
- if a product is buyable, all of its current configurations are buyable in v1
- customers must be able to carry the chosen configuration into the cart
- customers must be able to fully reconfigure the item inside the cart

For `CPO` products:

- the product is treated as an already-defined specimen, not a configurable base product
- the customer adds the item as-is
- there is no option selection step
- quantity stays effectively limited to one specimen per line
- cart reconfiguration does not exist for `CPO` items

## Operational Availability Rule For `CPO`

The `CPO` buyability model needs one lightweight operational layer in addition to business-managed product data.

The agreed v1 statuses are:

- `available`
- `on_hold`
- `sold_out`
- `manually_unavailable`

Rules:

- order creation may move `available` to `on_hold`
- payment expiration may move `on_hold` back to `available`
- payment success may move `on_hold` to `sold_out`
- manual operator change may set `manually_unavailable`
- `manually_unavailable` blocks new order creation
- this operational state is stored in `Sanity` for v1 and must not be overwritten by normal Excel sync

## Archived `CPO` Rule

- archive state and availability state are separate
- archived `CPO` items are not buyable for new customers
- archiving does not block completion of an already-created valid awaiting-payment order
- if an archived `CPO` item later returns internally to `available`, it still remains non-buyable because it is archived

## Runtime And Failure Rules

- `Next.js` never reads Excel directly for buyability
- the storefront uses the last successfully persisted runtime values already stored in `Sanity` and `Supabase`
- v1 does not require a special stale-sync UI

## Notes

The current model is intentionally simple and should not be expanded into per-configuration eligibility unless a business need appears later.
