# Phase 07 - Customer Panel

Status: planned
Owner: planning
Last updated: 2026-04-09
Depends on: `phase-06-checkout-and-payments.md`
Related files: `../architecture/customer-panel-ia.md`, `../architecture/customer-auth-and-access.md`, `../architecture/order-lifecycle.md`, `../testing-strategy.md`, `../architecture/commerce-table-model.md`

## Objective

Implement the lightweight OTP-based customer panel for post-purchase order access.

## Why This Phase Exists

The B2C model does not use classic accounts, so the customer panel is the main self-service post-purchase surface.

This phase turns the resolved access model and panel IA into a usable customer experience.

## Inputs

- customer-panel IA
- checkout/auth model
- order-lifecycle model
- invoice/document direction
- `../testing-strategy.md`

## Main Deliverables

- Supabase-Auth-backed email + OTP access flow
- order list view
- order detail view
- `Dane konta` view
- status history visibility
- eligible cancellation and return entry points

## Work Included In This Phase

### 1. Access Flow

- email entry
- OTP verification
- redirect-to-intended-page behavior

### 2. Authenticated Panel Views

- `Zamowienia`
- order detail
- `Dane konta`
- logout action

### 3. Order Actions

- invoice visibility/download when available
- customer cancellation where eligible
- customer return request where eligible

## Not In Scope For This Phase

- classic account registration
- password management
- historical order migration
- advanced profile functionality

## Done Criteria

Phase 07 can be considered complete when:

- customers can authenticate by OTP
- customers can view eligible orders and order details
- the customer panel reflects the agreed v1 structure and action rules
