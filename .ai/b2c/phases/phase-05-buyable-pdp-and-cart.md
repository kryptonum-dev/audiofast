# Phase 05 - Buyable PDP And Cart

Status: planned
Owner: planning
Last updated: 2026-04-07
Depends on: `phase-04-commerce-foundation.md`
Related files: `../architecture/cart-and-checkout-model.md`, `../business/product-buyability-rules.md`, `../business/pricing-and-tax-rules.md`, `../testing-strategy.md`

## Objective

Implement the storefront product-detail and cart behavior needed to support direct purchase of eligible products.

## Why This Phase Exists

This is the phase where the catalog platform begins to behave like a selective commerce storefront.

It should make the direct-purchase path real while preserving the current product experience.

## Inputs

- resolved cart and checkout model
- finalized product buyability rules
- pricing/tax presentation direction
- commerce-foundation outputs
- `../testing-strategy.md`

## Main Deliverables

- PDP buyability logic
- dual CTA behavior
- configurable add-to-cart flow
- cart with multi-product support
- full cart reconfiguration support

## Work Included In This Phase

### 1. PDP Buyability

- enforce buyable vs inquiry-only products
- show the correct CTA set

### 2. Cart Entry

- carry the selected configuration into cart
- preserve pricing and product snapshot requirements

### 3. Cart Editing

- support quantity changes
- support full product reconfiguration inside cart
- support coupon entry point if confirmed in planning

## Not In Scope For This Phase

- final order creation
- payment provider handoff
- customer-panel implementation
- admin-panel implementation

## Done Criteria

Phase 05 can be considered complete when:

- buyable products can be added to cart reliably
- inquiry-only products stay inquiry-only
- the cart model works for configurable products without breaking the product experience
