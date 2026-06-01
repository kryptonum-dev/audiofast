# Commerce Table Model

Status: draft
Owner: planning
Last updated: 2026-04-09
Depends on: `commerce-data-model.md`, `customer-auth-and-access.md`, `invoice-and-documents.md`
Related files: `system-map.md`, `order-lifecycle.md`, `payment-process-model.md`, `../business/coupon-rules.md`, `../business/returns-and-cancellations-rules.md`

## Purpose

This file records the accepted v1 backend table structure for the Audiofast B2C system.

Its job is to make the backend shape implementation-ready by defining:

- which tables exist
- why each table exists
- which columns each table should contain
- where JSON is used intentionally instead of more tables
- how the tables relate to each other
- what has been intentionally left out of v1 to keep the system lean

This file is the table-level companion to `commerce-data-model.md`.

## Design Principles

### 1. Keep The Table Count Low

The v1 backend should stay modest.

The model prefers:

- one shared `orders` table for standard and `CPO` orders
- one shared `order_items` table for standard and `CPO` lines
- JSON fields for snapshots and lightweight operational metadata
- no extra tables for concepts that do not yet need independent querying or workflows

### 2. Preserve Purchase-Time Truth

Orders must preserve the truth of the transaction at the time it happened.

That means:

- later Excel syncs do not mutate old orders
- later `Sanity` edits do not mutate old orders
- profile changes affect future orders only

### 3. Keep Payment Handling Minimal

The accepted v1 payment model is intentionally simplified:

- no separate `payment_attempts` table
- one short `awaiting_payment` window of `15 minutes`
- no special long-lived retry-on-same-order flow in v1
- provider-confirmed success remains the source of truth

### 4. Keep `CPO` Availability Out Of Supabase

`CPO` operational availability remains on the `Sanity` `CPO` document in v1.

Supabase still stores the order that may cause availability changes, but it is not the runtime source for `CPO` buyability.

## Existing Tables Kept As-Is

These tables already exist and remain the standard-product pricing/configuration layer:

- `pricing_variants`
- `pricing_option_groups`
- `pricing_option_values`
- `pricing_numeric_rules`

These are not part of the new order-domain model and should continue serving:

- standard product extended pricing
- standard product option configuration

## New V1 Tables

The accepted new business tables are:

- `orders`
- `order_items`
- `customer_profiles`
- `coupons`
- `return_cases`

Authentication is handled by:

- `Supabase Auth`

Actual invoice files are stored in:

- `Supabase Storage`

## Table: `orders`

### Purpose

`orders` is the shared order header table for both:

- standard product purchases
- `CPO` purchases

It stores:

- customer linkage
- order lifecycle state
- top-level payment state
- purchase-time customer and address snapshots
- order totals
- coupon snapshot
- shipment metadata
- invoice metadata

### Accepted Columns

- `id`
- `order_number`
- `customer_profile_id` nullable
- `customer_email`
- `current_status`
- `status_history` `jsonb`
- `payable_until`
- `payment_provider`
- `payment_reference` nullable
- `payment_verified_at` nullable
- `customer_snapshot` `jsonb`
- `shipping_address_snapshot` `jsonb`
- `subtotal_cents`
- `discount_total_cents`
- `grand_total_cents`
- `used_discount` `jsonb` nullable
- `shipment_data` `jsonb` nullable
- `invoice_data` `jsonb` nullable
- `created_at`
- `updated_at`
- `paid_at` nullable
- `shipped_at` nullable
- `completed_at` nullable
- `cancelled_at` nullable
- `returned_at` nullable

### Order Number Format

The accepted public order number format is:

- `AF-YYYY-NNNNN`

Example:

- `AF-2026-00001`

Rules:

- `AF` is the fixed Audiofast prefix
- `YYYY` is the calendar year of order creation
- `NNNNN` is a zero-padded sequence number
- the sequence resets each new year
- the order number is generated when the order is created
- internal relations should still use `orders.id`

### Column Meaning

#### Identity

- `id`: internal UUID primary key
- `order_number`: public order number used in emails, panel URLs, and support communication

The current direction is to keep both:

- an internal ID for clean relations
- a public order number for customer/business use

#### Customer Linkage

- `customer_profile_id`: optional link to reusable customer defaults
- `customer_email`: order-time email identity, always stored directly on the order

#### Status And Payment Window

- `current_status`: main order lifecycle status
- `status_history`: JSON timeline of status changes
- `payable_until`: hard `awaiting_payment` expiration timestamp

#### Minimal Payment Tracking

- `payment_provider`: expected to be `przelewy24` in v1
- `payment_reference`: provider-side reference / transaction identifier if available
- `payment_verified_at`: moment payment was verified as successful

#### Purchase-Time Snapshots

- `customer_snapshot`: customer/contact data at purchase time
- `shipping_address_snapshot`: shipment-recipient and shipping-address data at purchase time

#### Totals

- `subtotal_cents`: total before discount
- `discount_total_cents`: total discount applied to the order
- `grand_total_cents`: final payable amount

#### Discount

- `used_discount`: JSON snapshot of the one coupon used on the order

#### Shipment / Invoice

- `shipment_data`: JSON metadata for manual shipment handling
- `invoice_data`: JSON metadata/reference to invoice PDF stored in Supabase Storage

#### Lifecycle Timestamps

- `created_at`, `updated_at`
- `paid_at`, `shipped_at`, `completed_at`, `cancelled_at`, `returned_at`

### Accepted Runtime Rules

- `awaiting_payment` is active only for `15 minutes`
- after `payable_until`, the order is no longer payable
- expired unpaid orders remain in the database
- expired unpaid orders do not appear in normal customer-panel order lists
- expired unpaid orders do not appear in the normal active admin workflow list
- if Przelewy24 confirms payment successfully, provider truth wins even if the customer never returns to the site

### Status History JSON

The accepted v1 direction is:

- keep `status_history` as `jsonb`
- do not create a separate status-history table yet

This keeps the schema small while still preserving a readable timeline for:

- customer order detail
- admin order detail

### Accepted JSON Shapes On `orders`

#### `customer_snapshot`

The accepted v1 shape is:

- `firstName`
- `lastName`
- `email`
- `phone` nullable

This snapshot represents:

- who placed the order

#### `shipping_address_snapshot`

The accepted v1 shape is:

- `firstName`
- `lastName`
- `phone` nullable
- `street`
- `postalCode`
- `city`
- `country`

This snapshot represents:

- the actual shipment recipient
- the actual shipment address

This means the order does not need a second buyer shipping-address object.

#### `used_discount`

The accepted v1 shape is:

- `couponId`
- `couponCode`
- `discountType`
- `discountValueCents` nullable
- `discountPercent` nullable
- `matchedProductKeys`
- `totalDiscountCents`

This keeps the order-level coupon history self-contained even if the live coupon later changes.

#### `shipment_data`

The accepted v1 shape is:

- `carrier`
- `trackingNumber`
- `trackingUrl` nullable
- `shippedAt`

#### `invoice_data`

The accepted v1 shape is:

- `recipientType`
- `companyName` nullable
- `taxId` nullable
- `invoiceAddress` nullable
- `storagePath` nullable
- `attachedAt` nullable

`recipientType` values:

- `private`
- `company`

`invoiceAddress` should contain:

- `street`
- `postalCode`
- `city`
- `country`

This object intentionally combines:

- checkout-time invoice/billing branch data
- later PDF attachment linkage

It intentionally avoids extra metadata that is not part of the v1 admin workflow.

## Table: `order_items`

### Purpose

`order_items` stores the purchased lines belonging to one order.

It supports both:

- standard configurable products
- `CPO` specimen products

### Accepted Columns

- `id`
- `order_id`
- `line_type`
- `line_position`
- `quantity`
- `product_key`
- `product_name`
- `brand_name`
- `unit_price_cents`
- `line_subtotal_cents`
- `line_discount_total_cents`
- `line_total_cents`
- `item_snapshot` `jsonb`
- `is_returnable`
- `created_at`
- `updated_at`

### Column Meaning

#### Identity / Relation

- `id`: internal UUID primary key
- `order_id`: foreign key to `orders.id`

#### Classification

- `line_type`: `standard` or `cpo`
- `line_position`: preserves the original checkout/cart order of the line

#### Quantity

- `quantity`: normal quantity for standard products; effectively `1` for `CPO`

#### Shared Identity Snapshot

- `product_key`: stable purchase-time key
  - standard product: `price_key`
  - `CPO`: `Klucz`
- `product_name`: purchase-time item name
- `brand_name`: purchase-time brand name

#### Pricing Snapshot

- `unit_price_cents`: final unit price
- `line_subtotal_cents`: subtotal before discount
- `line_discount_total_cents`: total discount applied to this line
- `line_total_cents`: final line total after discount

#### Policy Snapshot

- `is_returnable`: purchase-time returnability flag

#### Flexible Item Snapshot

- `item_snapshot`: JSON object for line-specific detail

For standard lines, this should hold:

- model selection and chosen configuration detail

For `CPO` lines, this should hold:

- relevant purchase-time `CPO` context

The current direction intentionally avoids creating a second display-only configurator summary layer.

### Accepted JSON Shapes On `order_items`

#### Standard Product `item_snapshot`

The accepted v1 shape is:

- `model` nullable
- `selectedOptions`

Each `selectedOptions` entry should contain:

- `groupName`
- `inputType`
- `valueName` nullable
- `numericValue` nullable
- `unit` nullable
- `parentGroupName` nullable
- `parentValueName` nullable

This shape is intentionally rich enough to preserve:

- products with no model, one model, or multiple models
- standard select options
- numeric / range selections
- nested or conditional child groups

It intentionally does not include:

- price deltas
- frontend-only labels
- display summaries

#### `CPO` `item_snapshot`

The accepted v1 shape is:

- `availabilityStatusAtPurchase` nullable
- `archivedAtPurchase` nullable

## Table: `customer_profiles`

### Purpose

`customer_profiles` stores reusable customer defaults for:

- future checkout prefill
- the authenticated `Dane konta` page

It is not:

- the source of historical order truth
- the session/auth system

### Accepted Columns

- `id`
- `auth_user_id`
- `email`
- `first_name`
- `last_name`
- `phone`
- `default_shipping_address` `jsonb`
- `default_invoice_data` `jsonb`
- `created_at`
- `updated_at`

### Column Meaning

- `auth_user_id`: link to the Supabase Auth user
- `email`: unique business/customer identity key
- `first_name`, `last_name`, `phone`: reusable contact defaults
- `default_shipping_address`: reusable shipping defaults
- `default_invoice_data`: reusable company/invoice defaults

### Accepted Rules

- create profile only after the first successful paid order
- do not create profiles for unpaid / abandoned / expired orders
- future guest orders on an existing email must not overwrite profile defaults automatically
- profile changes affect future orders only

### Accepted JSON Shapes On `customer_profiles`

#### `default_shipping_address`

The accepted v1 shape is:

- `firstName`
- `lastName`
- `phone` nullable
- `street`
- `postalCode`
- `city`
- `country`

This intentionally mirrors the order-level shipment snapshot shape.

#### `default_invoice_data`

The accepted v1 shape is:

- `recipientType`
- `companyName` nullable
- `taxId` nullable
- `invoiceAddress` nullable

`invoiceAddress` should contain:

- `street`
- `postalCode`
- `city`
- `country`

## Table: `coupons`

### Purpose

`coupons` stores the active discount definitions used by cart/checkout validation.

### Accepted Columns

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

### Column Meaning

- `code`: customer-entered coupon code
- `is_active`: manual enable/disable switch
- `discount_type`: one of:
  - `fixed_order`
  - `fixed_product`
  - `percent_order`
  - `percent_product`
- `discount_value_cents`: fixed-value amount in grosze
- `discount_percent`: percentage amount
- `product_keys`: optional array of eligible product keys
- `usage_limit`, `usage_count`: global usage control for v1
- `starts_at`, `expires_at`: optional activation window

### Accepted Rules

- no separate `scope_type`
- one coupon max per order
- a coupon may reference multiple product keys
- product-specific coupons apply to all matching products in the order
- fixed-product coupons apply per eligible unit quantity
- `usage_count` increments only after successful payment

### Coupon Data On Orders

Coupons do not need a separate usage table in v1.

Instead:

- `orders.used_discount` stores the order-level coupon snapshot
- `orders.discount_total_cents` stores the final total discount
- `order_items.line_discount_total_cents` stores line-level discount effect

## Table: `return_cases`

### Purpose

`return_cases` stores the separate return workflow attached to an order.

This exists because:

- return request handling is intentionally separate from the main order status

### Accepted Columns

- `id`
- `order_id`
- `status`
- `reason`
- `created_at`
- `updated_at`
- `closed_at`
- `completed_at`

### Column Meaning

- `order_id`: foreign key to `orders.id`
- `status`: one of:
  - `open`
  - `closed_without_return`
  - `completed`
- `reason`: optional customer/admin reason text

### Accepted Rules

- returns are whole-order only in v1
- no partial-return line table exists
- at most one open return case per order at a time
- historical closed/completed cases may still exist for the same order

## Authentication And Session Layer

The accepted direction is:

- use `Supabase Auth` for OTP-based customer authentication and session handling
- do not create a separate custom OTP challenge table in the business schema

This means:

- Auth handles verified identity and sessions
- `customer_profiles` handles reusable customer defaults
- `orders` and `order_items` remain the commerce source of truth

## Invoice Storage Direction

The accepted v1 direction is:

- invoice PDFs live in private `Supabase Storage`
- `orders.invoice_data` stores the file reference and metadata
- the admin upload UI may still be implemented inside the `Sanity App SDK` panel
- customer download should pass through normal order authorization checks in the application layer

## Tables Intentionally Not Added In V1

To keep the model lean, v1 intentionally avoids:

- a separate `payment_attempts` table
- a separate `order_status_history` table
- a separate `coupon_usages` table
- a separate `shipment_metadata` table
- a separate `invoice_metadata` table
- a separate `CPO` availability table
- item-level return tables
- refund tables

## Accepted Constraints

The accepted minimal useful constraints are:

### Uniqueness

- `orders.order_number` must be unique
- `customer_profiles.email` must be unique
- `customer_profiles.auth_user_id` must be unique when present
- `coupons.code` must be unique

### Foreign Keys

- `order_items.order_id` references `orders.id`
- `return_cases.order_id` references `orders.id`
- `orders.customer_profile_id` references `customer_profiles.id`
- `customer_profiles.auth_user_id` links to the Supabase Auth user identity

### Value Rules

- `order_items.quantity` must be greater than `0`
- `order_items.line_type` must be one of:
  - `standard`
  - `cpo`
- if `order_items.line_type = cpo`, quantity should effectively be `1`
- `orders.current_status` must be one of the accepted order statuses
- `return_cases.status` must be one of:
  - `open`
  - `closed_without_return`
  - `completed`
- `coupons.discount_type` must be one of:
  - `fixed_order`
  - `fixed_product`
  - `percent_order`
  - `percent_product`

### Operational Rule

- at most one open return case should exist per order at a time

This may be enforced either:

- as a database-level partial uniqueness rule
- or as a strict application rule if that proves simpler in implementation

## Accepted Minimal Useful Indexes

The accepted minimal useful indexes are:

- `orders(order_number)`
- `orders(customer_email)`
- `orders(customer_profile_id)`
- `orders(current_status)`
- `order_items(order_id, line_position)`
- `return_cases(order_id)`
- `coupons(code)`

The v1 model intentionally does not require:

- JSON indexes
- advanced analytics indexes
- additional optimization indexes beyond the common operational lookups

## Main Remaining Work After This Table Model

This file captures the accepted table set and direction, but implementation still needs:

- exact admin/frontend query patterns
- implementation of the application flows that will use the accepted tables and JSON shapes

## Notes

This file should be updated whenever the accepted v1 table model changes.
