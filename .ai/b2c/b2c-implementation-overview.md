# Audiofast B2C Implementation Overview

Status: in progress
Owner: planning
Last updated: 2026-04-28
Depends on: current discovery and planning discussions
Related files: `README.md`, `scope.md`, `open-threads.md`, `testing-strategy.md`

## Purpose

This file is the high-level orientation document for the Audiofast B2C initiative.

It should answer only the most important top-level questions:

- what Audiofast is today
- why B2C is being added
- what the current codebase already provides
- what is still missing
- what version one is trying to achieve
- which planning principles should guide the implementation

Detailed rules should not live here. They belong in the `business/`, `architecture/`, `threads/`, `phases/`, and `testing-strategy.md` files.

## What Audiofast Is Today

Audiofast is currently a premium audio distributor and product/catalog platform rather than a classic ecommerce-first business.

The site already works as a strong brand, catalog, and content platform. It is built to:

- present brands and products
- explain technical specifications and variants
- support discovery through listings, filters, and structured content
- support trust through reviews, SEO, and editorial content
- drive inquiries for products that are not bought directly online

In business terms, the planned B2C layer is an extension of the current model, not a replacement for it.

## Why B2C Is Being Added

The client wants the ability to sell selected products directly from the Audiofast site.

This is not intended to turn the whole business into a traditional online store. The goal is more focused:

- enable direct sales for selected products
- support both standard configurable products and `CPO` specimen products in one commerce flow
- support products that make sense to sell directly
- preserve the value of the current product-detail experience
- keep operations practical and lightweight

The client has been consistently clear that the first version should stay simple and should not introduce unnecessary complexity.

## What The Codebase Already Provides

The current codebase already gives the B2C project a strong foundation.

At a high level, it already includes:

- a mature `Next.js` storefront
- a mature `Sanity` content and studio setup
- `Supabase` already used for structured product-related data such as pricing
- configurable product pages
- a recently implemented `CPO` product model with listing and detail pages
- inquiry-based product flows
- transactional email infrastructure
- strong content, SEO, and product discovery architecture
- recent experience extending the platform with major product-domain work such as CPO

This means the B2C initiative does not start from zero. It starts from an already capable catalog platform.

## What The Platform Still Lacks

The platform now has the core customer-facing transactional path in place: cart, checkout, mock payment handling, order persistence, customer order access, invoice download access, and lightweight customer profile editing.

The remaining v1 gaps are mostly operational and launch-readiness work, especially:

- operator order management
- admin-side invoice publication and shipment handling
- coupon operations
- operator handling for cancellation and return requests
- browser-level end-to-end coverage for the full customer journey
- launch hardening and production-readiness checks

These are the main gaps the remaining B2C phases are intended to close.

## Core Goal For V1

The goal of version one is to add a lightweight but real direct-purchase flow for selected products while preserving the strengths of the existing platform.

At a high level, v1 should allow Audiofast to:

- mark selected standard products as sellable
- show direct purchase alongside inquiry on eligible products
- carry configured standard products and fixed `CPO` specimens into one cart
- complete checkout and online payment
- create and manage orders
- let customers access orders through email OTP
- deliver invoice PDFs
- apply simple coupons
- support simple cancellation and return rules
- give Audiofast a dedicated `CPO` operational area in the admin panel

## Guiding Principles

The implementation should follow a few stable principles.

### Extend, Do Not Rebuild

The B2C layer should extend the existing platform rather than introduce a second disconnected commerce product.

### Keep V1 Operationally Simple

The first release should prioritize clarity, reliability, and maintainability over breadth.

### Preserve The Current Product Experience

The existing configurator and product-page model should remain central to the purchase flow.

At the same time, the B2C layer must acknowledge that Audiofast now has two different buyable product shapes:

- standard catalog products that are configured by the customer
- `CPO` products that represent already-defined specimens with fixed setup and price

These should share one commerce system rather than becoming two separate checkout models.

### Respect Existing System Roles

The implementation should fit the current architecture:

- Excel for selected business source-of-truth fields
- Sanity for internal/editorial/operator surfaces
- Supabase for operational commerce data
- Next.js for storefront and secure application logic

## Key Constraints

The current planning direction assumes several important constraints:

- not all products will be sellable online
- Excel remains the source of truth for key product-level business flags
- `CPO` products must fit the same cart, checkout, order, and admin flow as standard products
- the launch market is Poland only
- `Przelewy24` is the payment provider for v1
- shipping stays simple in v1
- customer access is email-OTP based
- no live stock integration is planned in v1
- `CPO` specimens still require a lightweight operational availability layer because they are unique items

Detailed rules for these constraints belong in the domain files, not here.

## What This Overview Should Not Repeat

This file should stay intentionally thin.

It should not try to duplicate:

- detailed business rules from `business/`
- detailed architecture planning from `architecture/`
- unresolved conversation topics from `threads/`
- phase sequencing from `phases/`
- scope breakdown from `scope.md`

## Where To Read Next

After reading this file:

1. Read `scope.md` for v1 scope and simplifications.
2. Read `open-threads.md` for unresolved planning topics.
3. Read `business/` for business rules.
4. Read `architecture/` for system direction.
5. Read `testing-strategy.md` for the cross-phase test direction.
6. Read `phases/` for implementation sequencing.

## Current Status

The planning system now exists, the critical v1 flow threads have been closed, the Phase 03 business contract has been finalized, the accepted v1 table model is documented, and `Phase 05 - Buyable PDP And Cart`, `Phase 06 - Checkout And Payments`, and `Phase 07 - Customer Panel` are now complete.

The completed customer-facing B2C path now includes:

- selective direct purchase and cart behavior for standard and `CPO` products
- checkout, order creation, local mock payment handling, and paid-order recovery
- OTP-based customer access at `konto-klienta`
- protected customer-panel routes with return-to behavior
- customer order list, order detail, invoice access, cancellation / return entry points, and `Dane konta`

The most important next planning work is:

- adding browser-level coverage in follow-up Step `7.5`
- implementing `Phase 08 - Admin Operations`
- continuing the remaining policy-flow and launch-readiness work
