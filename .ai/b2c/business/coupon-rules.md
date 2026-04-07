# Coupon Rules

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: current coupon decisions
Related files: `../architecture/commerce-data-model.md`, `../architecture/admin-panel-sanity.md`

## Purpose

This file defines the agreed business behavior for coupons in the B2C system.

## Current Decisions

### Supported Coupon Types In V1

1. Fixed amount for the full order
2. Fixed amount for a selected product
3. Percentage for the full order
4. Percentage for a selected product

### Scope Rules

- a coupon can be global
- a coupon can be attached to selected products

### Simplification Rules

- only one coupon can be applied per order
- usage limits are global only in v1
- expiry windows can be optional

## Questions Still To Clarify Later

- what exact product selection UX should exist in admin?
- are minimum order thresholds needed in v1?
- should inactive coupons remain visible in admin history?
- how should invalid or expired coupon errors be phrased in the UI?

## Proposed Future Sections

### 1. Coupon Data Fields

- code
- active/inactive
- type
- scope
- value
- usage limit
- usage count
- expiration date

### 2. Validation Rules

- valid for order
- valid for selected product
- usage limit not exceeded
- not expired

### 3. Calculation Rules

- when discount is applied
- whether discount is shown at cart and checkout
- how order totals are recalculated

### 4. Admin Rules

- create
- edit
- deactivate
- monitor usage

## Notes

Coupon logic should stay intentionally modest in v1 and avoid stacking, per-customer quotas, or advanced promotion engines.
