# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Orientation

Audiofast is a premium audio distributor's site (Next.js storefront + Sanity CMS) that is being extended with a **B2C direct-sales layer** (cart, checkout, online payment, orders, customer accounts, coupons, returns).

Read these existing docs before deep work — do not duplicate them here:

- `CODEBASE_OVERVIEW.md` — definitive deep-dive on the storefront, Sanity content model, GROQ query system, caching/invalidation, Presentation, filtering, and Studio internals. The B2C layer is documented in `.ai/b2c/` (see below).
- `.ai/b2c/` — the living planning hub for the B2C initiative. Start at `.ai/b2c/README.md` → `b2c-implementation-overview.md` → `open-threads.md`. Business rules, architecture decisions, phases, and the production-readiness runbook all live here.
- `.cursor/rules/` — enforced conventions: `scss.mdc` (also `.cursorrules`), `next.mdc`, `sanity-rules.mdc`. Follow these; SCSS in particular has strict nesting/units/transition rules.

## Monorepo layout

Turborepo + Bun workspaces. Five apps:

- `apps/web` — Next.js 16 (App Router, React 19 + Compiler, Turbopack) public storefront **and** all B2C runtime (checkout, payment, order/customer APIs, server actions).
- `apps/studio` — Sanity v6 Studio (`sanity` 6.20; editorial content model, migrations, custom tools/plugins).
- `apps/b2c-admin` — separate **Sanity App SDK** React app (runs via `sanity dev`, not Next.js) for operators: Orders, Coupons, Analytics.
- `apps/functions` — **Sanity Functions** declared in the root `sanity.blueprint.ts`: `invalidate-sync-tags` (publish → `/api/revalidate-tags/`) and `denormalize-products` (product `denorm*` fields). Each function directory has its own `package.json`; deploy with `bun run blueprints:deploy` (manual, not CI).
- `apps/cms-activity` — standalone **Sanity App SDK** app "Raport pracy CMS" (History API per-editor activity report + Excel export, listed in the Dashboard, report allowlisted; see its README). Shares nothing with `b2c-admin`.

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
bun run blueprints:deploy    # deploy the Sanity Functions stack (sanity.blueprint.ts)
bun run check:parity --base <url> --out <dir> [--compare <baselineDir>]   # published HTML parity crawl (run against an isolated `next start`, never a dev server)
bun run check:stega-leaks --base <url> --mode published|draft|both        # stega/data-sanity leak crawl
bun run scan:dataset-stega   # read-only dataset scan for stored stega markers
bun run walkthrough:summary <run>/results.md   # Presentation audit summariser (exit 0 = no FAIL rows)
```

App-specific (run inside the app dir):

- `apps/web`: `bun run test` / `bun run test:run` (vitest), `bun run test:e2e` (Playwright, uses `.env.e2e.local`), `bun run generate:redirects`, `bun run verify:build-env`. The web `build` script runs `verify:build-env` then `generate:redirects` before `next build`.
- `apps/studio`: `bun run test` (vitest: Presentation routes/locations completeness), `bun run migrate:denormalize` (+ `:dry`) for batch denorm recompute.
- `apps/functions`: `bun run test` (vitest), `bunx sanity functions logs <name>` (from the repo root) to see Function runs.
- `apps/b2c-admin`: `bun run test` (vitest).

**Node:** `.nvmrc` pins Node 24 (the Vercel runtime). Run the vitest suites under Node 24: jsdom 30 needs Node 22.22+ / 24.15+ and does not support Node 25.

**Run a single test:** `cd apps/web && bunx vitest run path/to/file.test.ts` (or `-t "test name"`). Tests are co-located as `*.test.ts(x)` next to source.

## Two data backends — know which one you're touching

This is the most important architectural fact:

- **Sanity CMS** = all editorial/catalog content (products, brands, blog, reviews, pages, page-builder blocks, settings, redirects). GROQ queries live in `apps/web/src/global/sanity/query.ts` (~2400 lines, fragment-composed). Products carry **denormalized fields** (`denormBrandSlug`, `denormBrandName`, `denormCategorySlugs`) maintained by the `denormalize-products` Sanity Function — don't read these expecting live joins.
- **Supabase (Postgres)** = structured + transactional data. Originally just product pricing (`pricing_*` tables); now **also the B2C system of record**: orders, order items, customer profiles, coupons, returns, invoice storage. Clients in `apps/web/src/global/supabase/` (`server.ts`, `client.ts`, `admin.ts` service-role, `server-auth.ts`). SQL migrations in `supabase/migrations/`. RLS is enforced — see `rls.integration.test.ts` and the hardening migrations; respect it when adding queries.

## B2C layer (apps/web)

The transactional code is concentrated under `apps/web/src/global/b2c/` and `apps/web/src/components/b2c/`, with routes under Polish-named segments:

- Storefront flow: `app/koszyk/` (cart) → `app/koszyk/twoje-dane/` (checkout data) → payment → `app/podziekowania-za-zakup/[orderNumber]/` (thank-you).
- Customer account: `app/konto-klienta/` (email-OTP auth, order history, invoice download, profile edit).
- Domain logic: `global/b2c/{cart,checkout,configuration,customer-auth,utils,...}` — heavily unit-tested; prefer extending these pure modules over inlining logic in components/routes.
- **Payments: Przelewy24 (P24).** Integration lives in `global/b2c/checkout/server/` (`p24-client`, `p24-sign`, `p24-notification`, `payment-update`). Status callback at `app/api/payment/status/`. Driven by `P24_*` env vars (see `turbo.json` `globalEnv`); `P24_FORCE_MOCK` / `P24_MODE` toggle mock vs live — checkout supports a zero-total path that bypasses P24.
- Admin APIs the b2c-admin app calls: `app/api/admin/{orders,coupons,analytics,b2c}/`.

## Conventions worth internalizing

- **Styling:** SCSS Modules co-located as `styles.module.scss`. Strict rules in `.cursorrules`/`scss.mdc` — rem units (not px), media queries nested inside the parent class (breakpoints `56.1875` / `47.9375` / `35.9375` rem), transitions in `ms` with explicit properties (never `transition: all`), camelCase BEM-like names. These SCSS rules apply to `apps/web`/`apps/studio` only; the App SDK apps (`apps/b2c-admin`, `apps/cms-activity`) use Sanity UI plus a small plain `App.css`.
- **Sanity schemas:** always `defineField`/`defineType`, named exports, a lucide-react (fallback sanity/icons) icon per type. After schema changes run `bun run typegen`.
- **Env vars:** the full allowlist is `turbo.json` `globalEnv` — add new vars there or Turbo won't pass them through to tasks.
- **Sanity fetching:** every cached Sanity read goes through strict `defineLive` in `global/sanity/live.ts` (`sanityFetch` / `sanityFetchCached` / `sanityFetchPublished`); pass `perspective` + `stega` from `getDynamicFetchOptions()` resolved outside `'use cache'`, and never put `children` inside a cache scope. Cart/checkout correctness reads stay on `sanityFetchFresh`.
- **Caching:** Next.js `use cache` with **sync-tag** invalidation: publish → `invalidate-sync-tags` Function → `app/api/revalidate-tags/` (`revalidateTag('sanity:'+tag, 'max')` + warm). Do not add hand cache tags: the only ones left are `product-pricing*` (Supabase, expired by `pricing-ingest`), `cpoProduct:<slug>` (checkout) and `geocode`. See CODEBASE_OVERVIEW.md "Caching & Revalidation".
- **Presentation:** „Podgląd” in the Studio is gated by `SANITY_STUDIO_PRESENTATION_ENABLED` (`true` in the deployed Studio since 2026-10-28; set it to `false` and redeploy to hide it). Vision, Releases and Scheduled Drafts exist only under `sanity dev`, never in the deployed Studio. Metadata, JSON-LD, sitemap and B2C must stay published and stega-free; run `check:stega-leaks` and the parity crawl after touching fetch or render code.

## Language note

UI copy, route segments, Sanity desk labels, and the `.ai/b2c/` business docs are in **Polish**. Match existing Polish naming for user-facing strings and route segments.

## Held upgrades

Every dependency is at latest except these, which are blocked upstream. Re-check the unblock condition before trying again; do not re-research them.

- **TypeScript 7** (stay on 6.0.x): `typescript-eslint` peers `typescript >=4.8.4 <6.1.0`, and forcing TS 7 crashes ESLint. TS 7 also drops the JS compiler API that `next build` type-checks with. Unblock: a `typescript-eslint` release that peers TS 7, and Next supporting TS 7 outside `experimental.useTypeScriptCli`.
- **ESLint 10** (stay on 9.39.x, with `@eslint/js` 9): `eslint-plugin-react` 7.37.x peers `^9.7` and its `react/display-name` rule calls the removed `context.getFilename()` (lsse tried 10 and rolled back). Unblock: an `eslint-plugin-react` release that supports ESLint 10 (and `eslint-plugin-import` peering `^10`).
- **`@sanity/eslint-config-studio` 7** (stay on 6): it requires ESLint 10. Unblock: the ESLint 10 hold above.
- **`@types/node` 26** (stay on 24.x): `@types/node` follows the deployed runtime, and Vercel runs `apps/web` on Node 24 (`.nvmrc`). Unblock: the Vercel project moving to Node 26.
- **Bun 1.4** (`packageManager` stays `bun@1.3.2`): out of scope for the dependency pass; both reference repos stay on 1.3.2.
