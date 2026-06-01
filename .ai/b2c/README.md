# Audiofast B2C Planning Hub

Status: in progress
Owner: Oliwier / implementation planning
Last updated: 2026-05-07
Depends on: `b2c-implementation-overview.md`, `open-threads.md`
Related files: all files in `.ai/b2c/`

## Purpose

This directory is the working planning system for the Audiofast B2C implementation.

It should be treated as the single planning hub for:

- business rules
- technical direction
- testing strategy
- unresolved threads
- implementation phases
- milestone tracking

This folder is meant to keep the project coherent from early planning through launch.

## How To Use This Folder

Use the files in this order:

1. Read `b2c-implementation-overview.md` for the current global understanding.
2. Read `open-threads.md` to see which topics are intentionally unresolved.
3. Check the `business/` folder for business rules.
4. Check the `architecture/` folder for system design direction.
5. Read `testing-strategy.md` for the shared cross-phase testing direction.
6. Check the `threads/` folder for topics handled in dedicated conversations.
7. Check the `phases/` folder for implementation sequencing.

## Current Core Files

- `b2c-implementation-overview.md`
  Main high-level understanding of the B2C initiative.

- `open-threads.md`
  Short dashboard of topics that were intentionally moved into separate conversations.

- `scope.md`
  What is in scope, out of scope, and simplified for v1.

- `assumptions-and-risks.md`
  Planning assumptions, dependencies, and project risks.

- `milestones.md`
  Major project milestones from planning to launch.

- `testing-strategy.md`
  Cross-phase testing direction for the new B2C implementation work.

- `architecture/commerce-table-model.md`
  Accepted v1 table-level backend structure for orders, items, profiles, coupons, returns, auth direction, and invoice storage.

## Folder Structure

### `business/`

Business rules and operational logic.

### `architecture/`

High-level system design and ownership boundaries.

### `threads/`

Dedicated planning documents for topics discussed separately.

### `phases/`

Phase-by-phase implementation planning.

## Working Rules

- Keep each topic in one primary file.
- When a decision is made, update the most relevant domain file directly.
- If a topic is unresolved and needs its own conversation, track it in `threads/`.
- Avoid mixing detailed architecture decisions into business-rule files.
- Avoid mixing backlog tasks into planning-rule files.

## Current Planning Status

Current status of the B2C planning system:

- overview created
- open-thread dashboard active
- phase-one structure created
- phase roadmap expanded
- order status model finalized
- checkout/authentication model finalized
- email communication model finalized
- customer panel IA finalized
- cart and checkout model finalized
- payment process model finalized
- admin panel architecture finalized
- root testing strategy created
- phase 03 business contract finalized
- accepted v1 commerce table model added
- `Phase 05 - Buyable PDP And Cart` completed
- `Phase 06 - Checkout And Payments` completed
- `Phase 07 - Customer Panel` completed
- `Phase 08 - Admin Operations` completed for the v1 admin scope
- Phase 08 now includes the Sanity App SDK `Orders`, `Coupons`, and simple `Analytics` areas
- focused App SDK admin tests and backend admin tests cover the v1 admin surface
- no open planning threads remain
