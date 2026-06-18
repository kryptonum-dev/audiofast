# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Orientation

Audiofast is a premium audio distributor's site (Next.js storefront + Sanity CMS) that is being extended with a **B2C direct-sales layer** (cart, checkout, online payment, orders, customer accounts, coupons, returns).

Read these existing docs before deep work — do not duplicate them here:
- `CODEBASE_OVERVIEW.md` — definitive deep-dive on the storefront, Sanity content model, GROQ query system, caching/revalidation, filtering, and Studio internals. **Note:** it predates the B2C layer and still says the site is "not e-commerce" — that is now outdated (see below).
- `.ai/b2c/` — the living planning hub for the B2C initiative. Start at `.ai/b2c/README.md` → `b2c-implementation-overview.md` → `open-threads.md`. Business rules, architecture decisions, phases, and the production-readiness runbook all live here.
- `.cursor/rules/` — enforced conventions: `scss.mdc` (also `.cursorrules`), `next.mdc`, `sanity-rules.mdc`. Follow these; SCSS in particular has strict nesting/units/transition rules.

## Monorepo layout

Turborepo + Bun workspaces. Three apps:
- `apps/web` — Next.js 16 (App Router, React 19 + Compiler, Turbopack) public storefront **and** all B2C runtime (checkout, payment, order/customer APIs, server actions).
- `apps/studio` — Sanity v5 Studio (editorial content model, migrations, custom tools/plugins).
- `apps/b2c-admin` — separate **Sanity App SDK** React app (runs via `sanity dev`, not Next.js) for operators: Orders, Coupons, Analytics.

Shared config in `packages/eslint-config` and `packages/typescript-config`.

## Commands (run from repo root unless noted)

```bash
bun install                  # install
bun run dev                  # web + studio dev servers (filtered)
bun run dev:all              # all apps incl. b2c-admin
bun run dev:b2c-admin        # b2c-admin only (Sanity App SDK, port 3334)
bun run build                # turbo build all
bun run lint                 # turbo lint
bun run check-types          # turbo tsc --noEmit
bun run format               # prettier across repo
bun run typegen              # regenerate Sanity types (extract schema + typegen) — run after editing studio schemas
```

App-specific (run inside the app dir):
- `apps/web`: `bun run test` / `bun run test:run` (vitest), `bun run test:e2e` (Playwright, uses `.env.e2e.local`), `bun run generate:redirects`, `bun run verify:build-env`. The web `build` script runs `verify:build-env` then `generate:redirects` before `next build`.
- `apps/studio`: `bun run migrate:denormalize` (+ `:dry`) for batch denorm recompute; studio build/deploy bump Node heap to 8 GB.
- `apps/b2c-admin`: `bun run test` (vitest).

**Run a single test:** `cd apps/web && bunx vitest run path/to/file.test.ts` (or `-t "test name"`). Tests are co-located as `*.test.ts(x)` next to source.

## Two data backends — know which one you're touching

This is the most important architectural fact:

- **Sanity CMS** = all editorial/catalog content (products, brands, blog, reviews, pages, page-builder blocks, settings, redirects). GROQ queries live in `apps/web/src/global/sanity/query.ts` (~2400 lines, fragment-composed). Products carry **denormalized fields** (`denormBrandSlug`, `denormCategorySlugs`, `denormFilterKeys`, …) recomputed on publish and via the revalidation webhook — don't read these expecting live joins; they're maintained automatically.
- **Supabase (Postgres)** = structured + transactional data. Originally just product pricing (`pricing_*` tables); now **also the B2C system of record**: orders, order items, customer profiles, coupons, returns, invoice storage. Clients in `apps/web/src/global/supabase/` (`server.ts`, `client.ts`, `admin.ts` service-role, `server-auth.ts`). SQL migrations in `supabase/migrations/`. RLS is enforced — see `rls.integration.test.ts` and the hardening migrations; respect it when adding queries.

## B2C layer (apps/web)

The transactional code is concentrated under `apps/web/src/global/b2c/` and `apps/web/src/components/b2c/`, with routes under Polish-named segments:
- Storefront flow: `app/koszyk/` (cart) → `app/koszyk/twoje-dane/` (checkout data) → payment → `app/podziekowania-za-zakup/[orderNumber]/` (thank-you).
- Customer account: `app/konto-klienta/` (email-OTP auth, order history, invoice download, profile edit).
- Domain logic: `global/b2c/{cart,checkout,configuration,customer-auth,utils,...}` — heavily unit-tested; prefer extending these pure modules over inlining logic in components/routes.
- **Payments: Przelewy24 (P24).** Integration lives in `global/b2c/checkout/server/` (`p24-client`, `p24-sign`, `p24-notification`, `payment-update`). Status callback at `app/api/payment/status/`. Driven by `P24_*` env vars (see `turbo.json` `globalEnv`); `P24_FORCE_MOCK` / `P24_MODE` toggle mock vs live — checkout supports a zero-total path that bypasses P24.
- Admin APIs the b2c-admin app calls: `app/api/admin/{orders,coupons,analytics,b2c}/`.

## Conventions worth internalizing

- **Styling:** SCSS Modules co-located as `styles.module.scss`. Strict rules in `.cursorrules`/`scss.mdc` — rem units (not px), media queries nested inside the parent class (breakpoints `56.1875` / `47.9375` / `35.9375` rem), transitions in `ms` with explicit properties (never `transition: all`), camelCase BEM-like names.
- **Sanity schemas:** always `defineField`/`defineType`, named exports, a lucide-react (fallback sanity/icons) icon per type. After schema changes run `bun run typegen`.
- **Env vars:** the full allowlist is `turbo.json` `globalEnv` — add new vars there or Turbo won't pass them through to tasks.
- **Caching:** Next.js `use cache` with tag-based invalidation via `app/api/revalidate/` (reverse-lookup from Sanity webhooks). See CODEBASE_OVERVIEW.md "Caching & Revalidation" before changing cached query tags.

## Language note

UI copy, route segments, Sanity desk labels, and the `.ai/b2c/` business docs are in **Polish**. Match existing Polish naming for user-facing strings and route segments.
