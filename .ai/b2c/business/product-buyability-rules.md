# Product Buyability Rules

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: `excel-contract.md`
Related files: `pricing-and-tax-rules.md`, `../architecture/cart-and-checkout-model.md`, `../architecture/cpo-and-b2c-relation.md`

## Purpose

This file defines when a product can be purchased directly and how the storefront should behave based on that status.

The B2C model now needs to cover two buyable product shapes:

- standard configurable catalog products
- fixed `CPO` specimen products

## Current Decisions

### Buyable Standard Product

A standard catalog product is buyable only when:

- it is marked as sellable in Excel
- it has price data available

### Non-Buyable Standard Product

A standard catalog product is non-buyable when:

- it is not marked as sellable in Excel
- or it has no price

### Buyable `CPO` Product

A `CPO` specimen is buyable only when:

- it exists in the current business-controlled `CPO` offer
- it has price data available
- its operational availability state allows purchase

### Non-Buyable `CPO` Product

A `CPO` specimen is non-buyable when:

- it is no longer part of the intended `CPO` offer
- or it has no valid price
- or its operational availability is not currently purchasable

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
- quantity should stay effectively limited to one specimen per line
- cart reconfiguration should not exist for `CPO` items

## Operational Availability Rule For `CPO`

The `CPO` buyability model needs one lightweight operational layer in addition to business-managed product data.

Current direction:

- the system may automatically move a `CPO` item into a non-buyable state such as `locked_by_order` when an order is created
- the Audiofast operator may manually change the `CPO` availability state in admin
- this operational state is separate from the business input contract and should not be overwritten by normal Excel sync

## Questions Still To Finalize

- how exactly is "missing price" detected in the current data layer?
- how should price-hidden but inquiry-available products be presented visually?
- what should happen if pricing data is temporarily unavailable due to a sync issue?
- how should non-buyable `CPO` items be presented publicly when they still have a visible product page?
- should every `CPO` row in the source sheet be treated as business-sellable by default, or is an explicit sellable flag needed later?

## Future Sections To Expand

### Edge Cases

- missing Excel row
- missing sync result
- stale pricing state
- `CPO` item locked by order but manually reopened by operator
- `CPO` item present in content but intentionally not purchasable

### UI Interpretation

- button disabled vs hidden
- price hidden vs fallback text

### Technical Enforcement Points

- product page
- cart entry point
- checkout validation

## Notes

The current model is intentionally simple and should not be expanded into per-configuration eligibility unless a business need appears later.
