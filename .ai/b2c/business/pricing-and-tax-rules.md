# Pricing And Tax Rules

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: current pricing decisions
Related files: `product-buyability-rules.md`, `../architecture/system-map.md`

## Purpose

This file captures the high-level pricing presentation rules for the B2C storefront.

## Current Decisions

- prices are shown in `PLN`
- storefront prices are expected to be gross prices with VAT included
- a product with no price is not buyable

## Current Assumptions

- existing pricing data from the current system can support the first B2C release
- no additional pricing currency logic is needed in v1
- no country-specific tax branching is needed in v1

## Questions Still To Clarify Later

- what exact VAT wording should appear in UI, if any?
- how are rounding and formatting rules handled consistently?
- how should configurable products present price changes throughout selection?
- how should cart and checkout totals be broken down visually?

## Proposed Future Sections

### 1. Display Rules

- PDP price presentation
- cart price presentation
- checkout price presentation

### 2. Missing Price Rules

- hide price
- hide buy action
- keep inquiry path

### 3. Coupon Interaction Rules

- price before discount
- discount application
- final total display

### 4. Tax Messaging

- tax included wording
- invoice implications

## Notes

This file should later be connected to the exact pricing behavior of the existing configurator and the future cart / checkout calculations.
