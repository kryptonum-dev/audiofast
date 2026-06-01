# Coupon Rules

Status: completed
Owner: planning
Last updated: 2026-04-09
Depends on: current coupon decisions
Related files: `../architecture/commerce-data-model.md`, `../architecture/admin-panel-sanity.md`, `../architecture/commerce-table-model.md`

## Purpose

This file defines the agreed business behavior for coupons in the B2C system.

## Current Decisions

### Supported Coupon Types In V1

1. Fixed amount for the full order
2. Fixed amount for selected products
3. Percentage for the full order
4. Percentage for selected products

### Simplification Rules

- only one coupon can be applied per order
- usage limits are global only in v1
- expiry windows can be optional
- no stacking
- no per-customer quota logic

## Coupon Table Direction

The accepted v1 `coupons` table should contain at least:

- `id`
- `code`
- `is_active`
- `discount_type`
- `discount_value_cents` nullable
- `discount_percent` nullable
- `product_keys` nullable
- `usage_limit` nullable
- `usage_count`
- `starts_at` nullable
- `expires_at` nullable
- `created_at`
- `updated_at`

The accepted `discount_type` set is:

- `fixed_order`
- `fixed_product`
- `percent_order`
- `percent_product`

There is intentionally:

- no separate `scope_type`

Scope is derived from:

- the selected `discount_type`
- whether `product_keys` is populated

## Product Matching Rules

Coupons may reference multiple product keys.

This means:

- one coupon may apply to multiple standard products
- one coupon may apply to multiple `CPO` items if desired later through keys
- selected-product matching should use the same item identity key used by `order_items.product_key`

## Calculation Rules

### Order-Wide Coupons

- `fixed_order` applies once to the whole order
- `percent_order` applies once to the whole order subtotal

### Product-Specific Coupons

Product-specific coupons should apply to all matching eligible products in the order.

If a fixed product coupon matches multiple products or quantities:

- discount applies per eligible unit quantity, not just per line

Example:

- coupon value: `20 PLN`
- two eligible units in the order
- total discount: `40 PLN`

### Order And Item Storage

The accepted v1 storage model is:

- `orders.used_discount` stores the one coupon snapshot used by the order
- `orders.discount_total_cents` stores the total discount effect on the order
- `order_items.line_discount_total_cents` stores the line-level effect for the purchased item

## Validation Rules

Coupon is valid only when:

- code exists
- coupon is active
- coupon is within its optional active window
- global usage limit is not exceeded
- for selected-product coupons, at least one matching item exists in the current cart/order

If cart contents change and the coupon becomes invalid:

- keep the code visible
- mark it invalid clearly
- do not silently remove it

## Usage Count Rule

The accepted v1 rule is:

- increment `usage_count` only after successful payment confirmation

Do not consume coupon usage at:

- `awaiting_payment`
- redirect only
- abandoned payment

## Admin Rules

V1 admin should support:

- create coupon
- edit coupon
- deactivate coupon
- monitor usage count

## Questions Still To Clarify Later

- what exact product selection UX should exist in admin?
- are minimum order thresholds needed in v1?
- should inactive coupons remain visible in admin history?
- how should invalid or expired coupon errors be phrased in the UI?

## Notes

Coupon logic should stay intentionally modest in v1 and avoid advanced promotion-engine behavior.
