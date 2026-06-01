# B2C Scope

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: `b2c-implementation-overview.md`
Related files: `business/product-buyability-rules.md`, `business/returns-and-cancellations-rules.md`, `milestones.md`

## Purpose

This file defines what is in scope for the first B2C release, what is intentionally out of scope, and what is simplified for version one.

## In Scope For V1

- selected products can be sold directly on the site
- Excel remains the source of truth for key business flags
- sellable products show both `Ask about product` and `Add to cart`
- non-sellable products remain inquiry-only
- configured standard products can be added to cart
- `CPO` specimen products can also be added to the same cart and checkout flow
- full product reconfiguration is allowed inside the cart
- simple cart with multi-product support
- Poland-only checkout
- online payment with `Przelewy24`
- operational order storage and lifecycle handling
- email OTP-based customer access
- customer order list and order detail access
- invoice PDF attachment workflow
- coupon support for agreed v1 types
- operator admin panel based on `Sanity App SDK`
- cancellation and return logic based on agreed v1 rules

## Explicit V1 Simplifications

- no stock synchronization
- no full reservation engine for `CPO` products
- no payment provider fallback
- free / simple shipping
- manual courier and tracking entry in admin
- `CPO` availability stays intentionally lightweight and operator-controlled
- no partial returns
- one internal role only
- no imported historical orders in the customer panel
- no classic password-based account system

## Out Of Scope For V1

- advanced stock / warehouse management
- multi-country support
- multi-currency support
- installment / financing flows
- automated refund handling
- multi-role internal permissions
- advanced shipping-price logic
- partial return workflow
- fallback payment gateway routing
- historical order migration into the customer panel

## Future Scope Candidates

- `Apaczka` shipment creation directly from admin
- broader shipping logic
- additional payment methods or fallback providers
- more advanced coupon rules
- richer customer profile functionality
- more advanced returns handling
- richer operator permissions

## Open Questions Affecting Scope

There are currently no major unresolved scope-shaping threads documented in `.ai/b2c`.

The next scope-affecting decisions are more likely to come from:

- the final Excel contract
- final data ownership boundaries
- implementation trade-offs discovered while expanding the architecture docs

## Notes

This file should be updated whenever a future feature is either:

- moved into scope
- moved out of scope
- explicitly postponed to a later phase
