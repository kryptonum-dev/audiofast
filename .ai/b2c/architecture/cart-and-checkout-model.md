# Cart And Checkout Model

Status: closed
Owner: planning
Last updated: 2026-04-07
Depends on: resolved storefront flow discussion
Related files: `customer-auth-and-access.md`, `../business/product-buyability-rules.md`, `../business/pricing-and-tax-rules.md`, `../business/coupon-rules.md`, `cpo-and-b2c-relation.md`

## Purpose

This file records the resolved v1 structural model for the Audiofast B2C cart and checkout flow.

It defines:

- the broad purchase flow from PDP to payment handoff
- the cart model for standard configurable products and `CPO` specimen products
- how checkout is structured
- where coupons, company invoice data, and reusable customer data fit
- how add-to-cart confirmation and global navigation should behave

## Final Resolution

### 1. Broad Purchase Flow

The v1 purchase flow is:

- `PDP -> cart -> checkout -> payment`

Rules:

- no `buy now` shortcut in v1
- checkout always starts from cart, even for a single item
- the cart exists as a dedicated page
- the customer should not be redirected to cart immediately after `Add to cart`
- the broad flow is shared, but the PDP entry differs by line type: standard products are configured first, while `CPO` products are added as fixed specimens

### 2. Cart Persistence

The v1 cart should be:

- browser/session-based
- not synced across devices
- preserved through login/logout changes in the same browser

The cart should persist until one of these happens:

- the customer completes a successful purchase
- the customer removes items manually
- the cart is explicitly cleared

After successful purchase:

- the cart should be cleared

### 3. Cart Line Model

The cart must support two item variants inside one shared model:

- standard configurable product line
- fixed `CPO` specimen line

For standard configurable products, the cart line should preserve:

- a stable product reference
- a human-readable product snapshot
- a configuration snapshot
- the current known price snapshot
- quantity

For `CPO` products, the cart line should preserve:

- a stable `CPO` specimen reference
- a human-readable specimen snapshot
- the current known fixed price snapshot
- the current known availability state

Rules:

- the stored price must still be revalidated before order creation
- same standard product + same configuration should merge into one line with increased quantity
- same standard product + different configuration should create separate lines
- `CPO` lines should stay separate and should not rely on reconfiguration
- quantity is allowed in v1 for standard products
- `CPO` quantity should effectively remain one specimen per line

### 4. Add-To-Cart Confirmation Pattern

The standard v1 add-to-cart confirmation pattern is:

- a right-side add-to-cart panel

It should:

- confirm that the item was added
- show the added item image, name, and price
- show related products
- provide two primary actions:
  - `Go to cart`
  - `Continue buying`

Rules:

- this panel is a lightweight confirmation layer, not a mini-cart
- it should not contain quantity editing, coupon editing, or configuration editing
- clicking `Continue buying` should close the panel and preserve the current PDP state
- related products should be link-only suggestions, not quick-add buttons
- the panel should not include a direct `Go to checkout` shortcut

### 5. Cart Editing And Reconfiguration

The cart should support:

- quantity editing
- line removal
- full reconfiguration of configurable items

Reconfiguration rules:

- reconfiguration means editing the current product configuration, not changing the line into a different product
- the original cart line stays unchanged until the customer explicitly saves the new configuration
- cancelling the edit leaves the cart exactly as it was

Current v1 direction:

- reconfiguration should happen in a large modal / overlay experience
- this should behave like a focused editing workspace rather than a small classic popup

If a configurable cart line becomes invalid or outdated:

- `Edit configuration` should be the primary fix action

For `CPO` lines:

- there is no reconfiguration flow
- the fix action is remove the line or restore its availability through operator action if relevant

### 6. Coupon Model

Coupon handling in v1 should follow this structure:

- the main coupon entry point is the cart
- cart should show the applied discount result
- checkout should reflect the applied coupon result

Rules:

- coupon editing/application happens in cart
- checkout shows the coupon as read-only summary rather than a second independent coupon flow
- if cart contents change and the coupon becomes invalid, the system should preserve the code and clearly mark it invalid rather than silently removing it

### 7. Checkout Structure

Checkout should be:

- a single page
- guest-first
- entered from cart

At the structural level it should contain:

- contact data
- shipping data
- billing / invoice data
- order summary
- legal consents
- payment handoff

Rules:

- the order summary should remain visible within checkout rather than being separated into a distinct review page
- the customer can return to cart without losing entered checkout data in the same browser session
- no separate order-notes field is needed in v1

### 8. Shipping Model

Shipping remains intentionally simple in v1.

Rules:

- no complex delivery-method selection step
- no advanced shipping-price logic
- shipping is included in the purchase price for v1
- checkout summary should show a delivery line such as `dostawa w cenie`
- this delivery line does not need to appear in cart

### 9. Company Invoice Branch

Company invoice handling should be:

- an explicit branch within checkout

Rules:

- a simple toggle/checkbox enables the company invoice branch
- enabling it reveals additional company-data fields on the same checkout page
- this branch affects billing/invoice data only, not the shipping flow itself
- if company invoice affects return rights, checkout should explain that consequence before payment
- this explanation does not require a separate extra acknowledgment checkbox in v1

### 10. Reusable Customer Data

Logged-in checkout behavior should follow the already agreed identity model:

- checkout prefills from reusable customer data
- authenticated checkout keeps the email locked
- submitted checkout data always becomes the order snapshot for that order

Rules:

- reusable defaults update only if the authenticated customer explicitly opts in through a checkbox during checkout
- the save-to-default checkbox should appear only when relevant
- guest checkout on an email with existing orders must remain fully guest-like and must not reveal that reusable customer data exists for that email
- the first order on a new email creates the initial reusable customer profile automatically
- `Dane konta` and checkout defaults are one shared reusable-data model

There should also be:

- an optional login CTA in cart/checkout for returning customers who want to use saved data

If the customer starts checkout as a guest and then logs in during that same session:

- the system should not silently overwrite already entered fields
- at most, it may apply saved defaults only in a controlled way

### 11. Validation And Revalidation

The broad validation split is:

- PDP validates buyability and required configuration completeness before add-to-cart
- cart revalidates line eligibility before checkout
- checkout performs final validation before order creation

Revalidation timing:

- soft revalidation when entering or refreshing checkout
- hard final revalidation at the moment of order creation

Rules:

- if a product becomes non-buyable after entering cart, the line stays visible but blocks purchase until fixed or removed
- if price changes, the cart/checkout should update to the current valid price and communicate the change clearly
- if a selected configuration is no longer valid, the customer should be forced to reconfigure rather than the system silently auto-correcting it
- if a `CPO` item is no longer operationally available, the line stays visible but blocks purchase until removed or manually restored by the operator
- if a cart contains both valid and invalid lines, checkout must remain blocked until invalid lines are fixed or removed
- order creation must snapshot the final validated transaction truth
- order creation may automatically move a `CPO` item into a locked operational state so the same specimen is not freely re-added during an active purchase attempt

### 12. Flow Boundaries

The cart and checkout model should explicitly assume:

- inquiry-only products remain completely outside the cart/checkout flow
- no live stock or stock-count logic is part of v1
- `CPO` operational availability is still allowed as a lightweight exception because it protects unique specimens rather than modeling full stock
- out-of-stock communication, if needed operationally, is handled manually by the Audiofast team

### 13. Global Navigation Impact

The v1 purchase-flow model requires a minimal commerce update to the global navigation.

It should add:

- cart entry
- `konto-klienta` entry

No broader global-navigation expansion is needed in this thread.

## Notes

This file resolves the broad structural cart and checkout model for v1.

Visual layout, labels, field microcopy, and component-level UI details can still be refined later during implementation planning.
