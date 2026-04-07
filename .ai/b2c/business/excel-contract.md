# Excel Contract

Status: draft
Owner: planning
Last updated: 2026-04-07
Depends on: current business decisions
Related files: `product-buyability-rules.md`, `returns-and-cancellations-rules.md`, `../architecture/data-ownership.md`, `../architecture/cpo-and-b2c-relation.md`

## Purpose

This file defines the expected role and structure of Excel in the B2C system.

It now needs to cover both:

- standard catalog products that may become buyable online
- `CPO` specimen products that already exist as separate item instances

## Current Principle

Excel is the source of truth for business-controlled product flags and business-managed product inputs relevant to B2C.

## Already Agreed Responsibilities For Excel

- standard-product sellable online flag
- standard-product returnable flag
- `CPO` specimen feed / sheet content used to create or update `CPO` entries

## Ownership Boundary To Preserve

Excel should remain the source of truth for business-managed product inputs.

Excel should not become the real-time source of truth for commerce-operational states such as:

- whether a `CPO` item is currently `locked_by_order`
- whether a `CPO` item was manually disabled in admin
- whether a `CPO` item is already treated as sold in the commerce layer

Those states should remain under the commerce-operational layer so that a later sync cannot accidentally reopen or relist an item that operations intentionally blocked.

## Possible Future-Ready Fields Mentioned

- dimensions
- weight

These are not required for the initial free-shipping v1, but they may become useful later for logistics integrations such as `Apaczka`.

## Required Questions To Finalize

- for standard products:
  - what is the exact column name for sellability?
  - what is the exact column name for returnability?
  - how are boolean values encoded in the spreadsheet?
  - what is the stable product identifier used during sync?
- for `CPO` products:
  - which workbook / sheet is authoritative?
  - which field is the stable `CPO` specimen key?
  - which fields are required to create/update a `CPO` item?
  - what does row removal mean operationally after B2C goes live?
- for both:
  - how are empty values interpreted?
  - who owns changes to the sheet structure?

## Proposed Final Sections For This File

### 1. Source File Definition

- which file is authoritative
- how often it changes
- who edits it

### 2. Standard Product Matching Key

- which field links Excel rows to products in the system

### 3. Standard Product Required Columns

- product identifier
- online sellability
- returnability

### 4. `CPO` Source Definition

- which workbook / sheet is authoritative for `CPO`
- whether row presence itself means "part of the current CPO offer"
- how row removal should interact with already-created `CPO` content and already-placed orders

### 5. `CPO` Required Fields

At the current planning level, the expected business-managed `CPO` inputs are:

- specimen key / identifier
- brand name
- specimen name
- price
- product URL or internal catalog linkage hint
- short business description

### 6. Optional Columns

- dimensions
- weight
- future shipping metadata

### 7. Value Format Rules

- allowed values
- empty value behavior
- invalid row behavior

### 8. Sync Expectations

- direction of sync
- frequency of sync
- failure handling
- how `CPO` business sync avoids overwriting commerce-operational availability state

### 9. Admin / Operations Boundary

- which `CPO` fields can still be changed by the Audiofast team in admin
- which `CPO` state changes belong only to the B2C operational layer
- how manual operator override should coexist with Excel-managed business inputs

### 10. Examples

- one example buyable row
- one example inquiry-only row
- one example non-returnable row
- one example `CPO` row

## Notes

This file should become much more concrete as soon as the team agrees on the final Excel structure.

The key Phase 03 principle is:

- Excel can describe what the business wants to offer
- the commerce layer must still own the live operational availability of a unique `CPO` specimen once orders exist
