# Phase 05 - Buyable PDP And Cart

Status: in progress
Owner: planning
Last updated: 2026-04-14
Depends on: `phase-04-commerce-foundation.md`
Related files: `../architecture/cart-and-checkout-model.md`, `../architecture/cpo-and-b2c-relation.md`, `../architecture/commerce-table-model.md`, `../business/product-buyability-rules.md`, `../business/pricing-and-tax-rules.md`, `../business/coupon-rules.md`, `../testing-strategy.md`

## Objective

Implement the first real storefront commerce layer on top of the existing Audiofast catalog experience.

This phase should turn eligible product pages into buyable product pages, introduce a browser-persisted mixed cart for standard and `CPO` items, include coupon handling, and add the first real automated testing layer for the new commerce logic.

## Why This Phase Exists

Phase 04 finalized the backend model and schema direction, but the live storefront is still inquiry-first.

The current application already has:

- standard product pages with pricing/configuration and inquiry
- `CPO` product pages with price display and inquiry
- `Sanity` fields for `Sprzedaż Online`, `Zwrot`, and `CPO` availability
- `Supabase` pricing/configuration data for standard products
- generated `Supabase` types for the new order-domain schema

What it still does not have is the fully wired user-facing cart flow, especially:

- cart page and cart entry in navigation
- coupon application in the storefront UI
- cart revalidation wired to live backend truth
- cart-side reconfiguration UI
- browser-level cart journey coverage

This phase exists to close that gap without yet implementing checkout, order creation, payment, customer access, or admin workflows.

## Accepted Direction For This Phase

The detailed implementation direction for Phase 05 is now:

- testing starts in this phase and should not be postponed again
- coupon logic is included in this phase
- coupon creation UI is not required yet; coupons may be created directly in `Supabase` for v1 implementation/testing
- add-to-cart confirmation should use a minimal popup/modal, not the previously proposed right-side panel
- `Playwright` may be deferred at the start of this phase, but it should be installed near the end of Phase 05 before the phase is closed
- the popup should stay intentionally simple and provide only:
  - `Continue buying`
  - `Go to cart`
- inquiry flow must remain available throughout this phase
- no `buy now` shortcut is introduced in v1

## Inputs

- resolved cart and checkout model
- finalized product buyability rules
- finalized `CPO` relation and availability model
- accepted Phase 04 commerce foundation and table model
- current web/storefront implementation in `Next.js`
- current `Sanity` product and `CPO` schema fields
- `../testing-strategy.md`

## Main Deliverables

- initial testing foundation for B2C work
- shared runtime buyability logic for standard and `CPO` products
- dual CTA storefront behavior on eligible PDPs
- configurable add-to-cart flow for standard products
- fixed-specimen add-to-cart flow for `CPO` products
- browser-persisted mixed cart
- quantity editing and line removal
- full standard-product reconfiguration in cart
- cart coupon entry and validation
- cart revalidation / invalidation handling
- minimal add-to-cart confirmation popup
- minimal cart entry in the storefront navigation

## Current Implementation Snapshot

The Phase 05 work already completed in code includes:

- `Vitest`, `React Testing Library`, `MSW`, and `jsdom` setup in `apps/web`
- saved testing structure conventions for future implementation work
- shared runtime buyability rules for standard and `CPO` products
- storefront query/type alignment for the B2C buyability fields
- PDP buyability enforcement for both standard and `CPO` product pages
- dual CTA visibility on PDPs, with inquiry always preserved
- initial cart domain structure under `src/global/b2c/cart/`
- cart line builders for standard and `CPO` items
- cart merge, quantity, reconfiguration, coupon, totals, and revalidation domain logic
- browser cart runtime foundation with provider, reducer, context, and storage hydration
- real standard-product add-to-cart wiring into the cart runtime
- real `CPO` add-to-cart wiring into the cart runtime
- `CPO` PDP cart-toggle behavior that now allows removing the specimen directly from the PDP
- minimal add-to-cart confirmation popup for successful add actions
- minimal storefront navigation update with cart / customer access and responsive mobile behavior
- real `cart` route shell with breadcrumbs, checkout steps, and `noindex` metadata
- real cart page UI with mixed standard + `CPO` line rendering
- quantity editing, line removal, confirmation, and cart-side loading / empty states
- real cart coupon application / clear flow with validation, persistence rules, refresh-time revalidation messaging, and cart summary integration
- full standard-product reconfiguration in cart with saved-selection preload, merge handling, guarded close behavior, and responsive modal UX
- cart sidebar with summary, coupon UI shell, and support card
- server-side `Sanity` wiring for cart support content and empty-state content with code fallbacks
- removal toast feedback for `CPO` cart removal from the PDP
- unit and component coverage for the currently implemented rule-heavy slices

At this point, the project has:

- real buyability logic
- real cart domain logic
- real test foundation
- real browser cart runtime
- real PDP add-to-cart behavior for standard and `CPO`
- real confirmation feedback after successful add-to-cart
- real storefront cart access in navigation
- real first cart-route handoff from storefront CTAs and navigation
- real cart management UI for mixed standard + `CPO` lines
- real quantity editing and line-removal UX in the cart
- real cart loading and empty-state UX
- real cart coupon logic wired end to end from the cart UI into the shared cart runtime
- real full standard-product reconfiguration flow inside the cart
- real server-driven cart support and empty-state content

But it does not yet have:

- live cart revalidation integration against backend truth
- invalidation handling connected to real runtime refresh cycles
- real checkout handoff from the cart page
- minimal commerce analytics for the cart actions
- browser-level cart journey coverage and final closure checks

## Broad Remaining Backlog

The broad remaining backlog for Phase 05 is now:

1. wire cart revalidation to live backend truth
2. surface cart invalidation states cleanly and block checkout when needed
3. connect the cart page to the first real checkout handoff
4. add minimal commerce analytics for the cart actions
5. add the first browser-level cart flow before closing the phase

This backlog should stay intentionally broad.

The next slices should be implemented step by step, but this file should continue describing the Phase 05 target at a high level rather than becoming a low-level ticket list.

## Work Included In This Phase

### 1. Introduce The Testing Foundation First

This phase should begin by adding the first real test tooling required for B2C work.

Expected setup:

- `Vitest`
- `React Testing Library`
- `@testing-library/jest-dom`
- `MSW`
- `jsdom`

Preferred additional setup:

- defer `Playwright` until the first real cart flow exists, then install it before Phase 05 is closed
- keep the initial `Playwright` setup intentionally small and limited to the first critical browser cart flow(s)

The point of this setup is not to backfill the whole site.

It exists so that the new commerce rules introduced in this phase can be protected immediately.

### 2. Create A Shared Runtime Buyability Layer

The storefront should stop inferring buyability indirectly from whichever UI happens to be present.

Instead, `Next.js` should compute final runtime buyability from the accepted business rules.

#### Standard Product Buyability

A standard product is buyable only when:

- runtime `Sprzedaż Online` is true
- valid price/configuration data exists in the pricing layer

A standard product is non-buyable when:

- runtime `Sprzedaż Online` is false
- or valid price data is missing
- or valid runtime product mapping is missing

#### `CPO` Buyability

A `CPO` item is buyable only when:

- it is not archived
- runtime `Sprzedaż Online` is true
- valid price exists
- `availabilityStatus` is `available`

`CPO` is non-buyable when:

- archived
- or `Sprzedaż Online` is false
- or price is missing
- or `availabilityStatus` is `on_hold`, `sold_out`, or `manually_unavailable`

#### Runtime Principle

- `Next.js` never reads Excel directly
- runtime truth comes from `Sanity` plus `Supabase`
- storefront CTA behavior must be driven by explicit buyability helpers, not scattered conditional UI logic

### 3. Align Queries And Types With The Locked B2C Contract

The current storefront schema/query layer must be extended so the web app actually receives the fields needed to implement buyability and cart behavior.

Phase 05 should include:

- exposing `isSellableOnline` and `isReturnable` on standard product queries
- exposing `isSellableOnline`, `isReturnable`, `availabilityStatus`, and related runtime `CPO` state on `CPO` queries
- refreshing generated query result types after query changes
- introducing shared storefront-facing types/view models where cart and PDP work need normalized item shape

This phase should also make sure the storefront has access to the stable item identity needed later by coupons and order creation:

- standard product identity via `price_key`
- `CPO` identity via specimen key

### 4. Upgrade Standard PDPs Into Buyable PDPs

Standard product pages should preserve the current configurator experience, but the pricing area should now support real cart entry.

Expected behavior:

- inquiry CTA remains available
- `Add to cart` appears only for buyable products
- non-buyable products remain inquiry-only
- no direct `Go to checkout` shortcut

The standard add-to-cart flow must:

- use the existing configurator output
- validate required configuration completeness before adding
- carry the exact selected model/options into the cart
- carry the current known price into the cart
- preserve a human-readable configuration snapshot for later cart rendering

This phase should also add analytics for successful standard-product add-to-cart behavior.

### 5. Upgrade `CPO` PDPs Into Shared-Commerce PDPs

`CPO` PDPs should join the same commerce system, but as fixed specimen lines rather than configurable product lines.

Expected behavior:

- inquiry CTA remains available
- `Add to cart` appears only when the `CPO` specimen is buyable
- non-buyable `CPO` items remain inquiry-only
- quantity remains effectively one specimen per line
- there is no configuration step before add

The `CPO` add-to-cart flow must preserve:

- stable specimen reference
- purchase-time name/brand/price snapshot
- current known availability state
- current returnability state

### 6. Build The Browser-Persisted Cart Layer

The cart in v1 should follow the already accepted structural model:

- browser/session-based
- not synced across devices
- preserved through login/logout changes in the same browser

This phase should introduce:

- cart state storage in the application layer
- cart hydration/persistence strategy
- line add/update/remove behavior
- explicit cart clear behavior

The cart line model must support both:

- standard configurable product lines
- fixed `CPO` specimen lines

The Phase 05 cart structure should already be intentionally close to the future `order_items` model so Phase 06 can convert cart truth into order truth without redesigning the data shape.

### 7. Implement Cart Merge Rules

The cart must follow the accepted merge behavior:

- same standard product + same configuration merges into one line
- same standard product + different configuration creates separate lines
- `CPO` lines stay separate
- `CPO` quantity stays effectively one specimen per line

These rules should be implemented in a pure deterministic domain layer and protected with unit tests.

### 8. Replace The Planned Side Panel With A Minimal Popup

The accepted add-to-cart confirmation pattern for implementation is now a very simple popup/modal.

It should:

- open after successful add-to-cart
- confirm that the item was added
- show item name, image, and current price
- provide exactly two primary actions:
  - `Continue buying`
  - `Go to cart`

It should not:

- become a mini-cart
- include quantity editing
- include coupon editing
- include configuration editing
- include `Go to checkout`

Closing or continuing should preserve the current PDP state.

### 9. Implement The Dedicated Cart Page

This phase should introduce the dedicated cart page for v1.

The cart page should include:

- mixed rendering for standard and `CPO` lines
- line quantity editing for standard products
- line removal
- standard-line configuration summary
- `CPO` specimen summary
- cart subtotal
- applied coupon summary
- cart invalid-state messaging
- CTA to proceed to checkout
- empty-cart state

This page should also be reachable from a minimal cart entry in the storefront navigation.

### 10. Support Full Standard Reconfiguration Inside Cart

Standard configurable lines must be fully editable after they enter the cart.

The reconfiguration flow should:

- open in a larger modal/overlay editing workspace
- load the current saved configuration
- allow the customer to change the existing configuration
- keep the original line unchanged until the customer explicitly saves
- leave the line untouched if the customer cancels

Save behavior must handle:

- recalculated line price
- updated human-readable summary
- possible merge with another line if the saved configuration becomes identical to an existing one

For `CPO` lines:

- there is no reconfiguration flow
- the only line-level actions are removal and later checkout participation if still valid

### 11. Add Cart Revalidation And Invalid-State Handling

The cart must not assume that the product state from the moment of add-to-cart is still valid later.

Phase 05 should introduce soft cart revalidation at a small number of meaningful moments:

- when the cart page is opened
- when the user tries to leave the cart for checkout

Expected behavior:

- if a standard product becomes non-buyable, the line stays visible but blocks checkout
- if standard-product price changes, the line updates to the current valid price and the change is shown clearly
- if a standard configuration becomes invalid, the customer must explicitly reconfigure it
- if a `CPO` item becomes unavailable, the line stays visible but blocks checkout until removed
- if cart contains both valid and invalid lines, checkout remains blocked
- the system must not silently auto-correct line configuration

The hard final validation at order-creation time belongs to Phase 06 and should happen at checkout submit / buy.

Phase 05 should establish the cart-side invalidation model and the earlier soft revalidation points, but it should not turn the cart into a constantly revalidating experience after every small edit.

### 12. Include Coupon Logic In The Cart

Coupon handling is included in Phase 05.

The cart should become the only editable coupon entry point in v1.

Phase 05 should support:

- one active coupon at a time
- coupon code entry in cart
- validation against the live `coupons` table
- discount calculation in the cart summary
- clear invalid-state messaging

The supported v1 coupon types are:

1. fixed amount for full order
2. fixed amount for selected products
3. percentage for full order
4. percentage for selected products

Validation rules must reflect the locked business model:

- code exists
- coupon is active
- coupon is inside optional start/end window
- global usage limit is not exceeded
- selected-product coupons match at least one current cart line

Cart behavior rules:

- coupon editing happens only in cart
- if cart contents change and coupon becomes invalid, keep the code visible
- invalid coupon must be marked invalid clearly
- invalid coupon must not be silently removed

Operational simplification for this phase:

- coupon admin UI is out of scope
- coupons may be created directly in `Supabase` during this phase

### 13. Align Totals With The Future Order Model

Even though Phase 05 does not create orders yet, the cart calculations should already align with the accepted order-domain model.

The cart calculation layer should be able to produce values compatible with:

- order subtotal
- order discount total
- order grand total
- per-line discount effect
- per-line total

This reduces Phase 06 risk and avoids redesigning totals logic during checkout implementation.

### 14. Add Minimal Commerce Analytics

The storefront should begin emitting the basic commerce analytics introduced by this phase, at minimum:

- `add_to_cart`
- `remove_from_cart`
- `view_cart`

If the implementation naturally reaches the handoff into checkout entry, the event structure should also be prepared for later `begin_checkout` tracking in Phase 06.

## Recommended Implementation Order

1. install and wire the test foundation
2. create the shared buyability / cart / coupon rule layer
3. extend queries and types to expose the required runtime fields
4. implement standard PDP dual CTA behavior and add-to-cart
5. implement `CPO` PDP dual CTA behavior and add-to-cart
6. connect the cart domain to browser cart state and persistence
7. wire real add-to-cart behavior from PDPs into that cart state
8. add minimal popup confirmation
9. add cart access in navigation
10. build cart page UI
11. add standard reconfiguration flow
12. wire cart revalidation and invalid-state behavior against live data
13. expose coupon behavior in cart UI
14. add analytics and test coverage for the completed slice
15. install `Playwright` once the first real cart flow is stable
16. add the first critical browser flow(s)

## Expected Testing Work

This phase should add automated protection for the rule-heavy behavior introduced here.

Expected test coverage includes:

- standard buyability rule tests
- `CPO` buyability rule tests
- cart merge rule tests
- cart line creation tests
- standard add-to-cart tests
- `CPO` add-to-cart tests
- standard-product reconfiguration tests
- coupon validation and discount tests
- cart invalidation / revalidation tests
- after `Playwright` is installed near the end of the phase, one first browser flow covering PDP -> add to cart -> cart

The testing goal is to protect new commerce rules, not to backfill the whole website.

## Not In Scope For This Phase

- final order creation
- payment provider handoff
- webhook handling
- checkout form implementation
- customer OTP authentication
- customer-panel implementation
- admin-panel implementation
- coupon admin UI
- invoice attachment flow
- shipment / courier workflow

## Done Criteria

Phase 05 can be considered complete when:

- test tooling required for B2C work is installed and usable
- standard PDPs correctly enforce buyable vs inquiry-only behavior
- `CPO` PDPs correctly enforce buyable vs inquiry-only behavior
- eligible standard products can be added to cart with full configuration snapshot
- eligible `CPO` items can be added to the same cart as fixed specimen lines
- cart persists in the browser and supports multiple items
- standard products support quantity editing and full reconfiguration inside cart
- `CPO` lines remain non-reconfigurable and effectively quantity one
- coupon application works in cart according to the accepted v1 rules
- invalid or outdated lines stay visible but block checkout until fixed or removed
- add-to-cart confirmation uses the minimal popup flow
- `Playwright` has been installed before phase closure and covers at least the first critical browser cart flow
- the new business rules introduced in this phase have automated protection

## Completion Note

Phase 05 is complete only when the storefront truly supports the selective direct-purchase path for both accepted product shapes without breaking the existing inquiry-first product experience.
