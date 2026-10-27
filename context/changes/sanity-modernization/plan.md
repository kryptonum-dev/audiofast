# Sanity Modernization Implementation Plan

## Overview

This change updates every dependency in the monorepo and rebuilds audiofast's Sanity integration:

- the leaked Sanity read token is fixed first;
- Sanity reads move to `defineLive` (strict) with Cache Components, three-layer pages and fully prerendered slugs, plus smaller queries;
- Sanity Functions take over invalidation and product denormalization, and the 1007-line webhook is retired;
- a complete, lsse-level Presentation tool is built and covers every document type;
- the whole Presentation surface is audited end to end, using the lsse walkthrough run through Claude in Chrome.

The goals are a cheaper, fresher and safer site and a real visual-editing experience for editors.

Upstream: [research.md](research.md) (synthesis), [research/](research/) 01–11 (raw reports), [decisions.md](decisions.md) (D1–D10 user answers, P1–P10 planning answers). decisions.md overrides research wherever the two differ.

## Current State Analysis

- **Security.**
  - `NEXT_PUBLIC_SANITY_API_READ_TOKEN` ships to the browser, confirmed in a production chunk. It leaks via `apps/web/src/global/sanity/client.ts:30-33` and `components/shared/Image.tsx:4`.
  - `.ai/sanity-price-sync-implementation.md:113` has a committed `sk…`-shaped literal.
  - `settings.analytics.metaConversionToken` sits in a publicly readable dataset.
  - `NEXT_REVALIDATE_TOKEN` is both the webhook bearer and a Sanity write token (research/10 §0).
- **Dependencies.**
  - The Studio runs `sanity@6.10.1`, a deprecated version with a Portable Text data-loss bug.
  - Real majors are pending: `@sanity/client` 8, `@sanity/ui` 4, `@sanity/icons` 5, `@sanity/sdk-react` 3, `@portabletext/react` 8, TS 6, vitest 5 / jsdom 30 / msw 3.
  - Version table: research/06.
- **Fetch layer** (research/04, 08).
  - One env-switched client and three wrappers in `global/sanity/fetch.ts`.
  - ~75 call sites, 14 `'use cache'` scopes, a root layout under `'use cache'`.
  - `limitBuildTimeStaticParams` prerenders one item per type, so ~1.5k pages go cold after every deploy.
  - cacheLife profiles are all overridden to 30 days.
  - Cost hotspots, ranked in research/04 §6: request-time renders, `/api/analytics/meta`, webhook live-API lookups, the ~190 KB filter-metadata query, the CPO `expire:0` storm, uncached `/porownaj`.
- **Invalidation** (research/10).
  - `app/api/revalidate/route.ts` holds a hand-written type→tag map, live-API reverse lookups and fire-and-forget denorm writes.
  - The production webhook URL lacks a trailing slash (308).
  - Supabase pricing tags are only expired as a side effect of this webhook.
  - There are 4 Sanity webhooks, one of them stale. No Blueprint stack exists.
- **Presentation** (research/05, 09, 11).
  - None exists: it was deleted in `a73f098`.
  - Leftovers: a buggy slug-field URL line and dead env vars.
  - 18 routable types, 11 referenced-only, 22 blocks, 54 authored arrays (12 draggable as-is, 11 after `_key` re-projection, 31 not draggable with reasons).
  - ~31 stega filter leaf names, ~20 unsafe emptiness checks, 13 patch-emitting Studio surfaces.

## Desired End State

1. **Token.** No public chunk on `audiofast.pl` contains `SANITY_API_READ_TOKEN` or an `sk…` literal. The leaked token is revoked. Sanity read tokens are server-only, plus one Viewer token that reaches the browser only in draft sessions.
2. **Dependencies.** Every workspace dependency is at latest, except the documented upstream holds (TS 7, ESLint 10, `@sanity/eslint-config-studio` 7, `@types/node` 26), which are recorded in CLAUDE.md. `bun run build --force`, `check-types`, `lint` and all tests pass.
3. **Fetch layer.**
   - Every Sanity read goes through `defineLive({strict:true})`. Exceptions are documented: checkout freshness reads, write clients, blog search, auth, scripts.
   - The web runs published + CDN everywhere except draft mode.
   - All production slugs are prerendered.
   - The published HTML parity crawl matches the pre-rewrite baseline.
4. **Invalidation and denormalization.**
   - Publishes invalidate via `sanity:` sync tags from a Sanity Function: SWR, followed by a warm of key paths.
   - Product denorm fields are maintained by a Sanity Function.
   - `/api/revalidate` and its two webhooks are gone.
   - Supabase pricing and CPO availability have their own explicit invalidation.
5. **Presentation.**
   - Editors open „Podgląd” in the deployed Studio and see every routable document as a live draft on `audiofast.pl`, with click-to-edit overlays.
   - PageBuilder blocks and every draggable nested array can be reordered.
   - Every document type shows a "Używany na" panel or a static message.
   - Metadata, JSON-LD and B2C stay published and stega-free.
6. **Audit.** The Tier 0 gates are green. The walkthrough summariser exits 0 on the final run for lanes [L] and [D], with only justified BLOCKED rows. Cleanup is GROQ-asserted.

### Key Discoveries:

- `next-sanity/live` picks the one-request `next-js` build only under `cacheComponents`. The rule is visible in `node_modules/next/dist/build/webpack-config.js:1126` for webpack; Turbopack has to be verified in its build output (D10).
- `defineLive` without `strict` silently renders published content in draft mode under `cacheComponents`. Without a Viewer `browserToken`, `includeDrafts` silently turns off (research/01 §5).
- Never wrap `children` in `'use cache'`. Doing so hung Najbar's cold dev loads (research/01 §5.9).
- Listing pages need a pass-through Suspense slot built outside the cache scope. Category and CPO listing pages already await `searchParams` outside Suspense (`kategoria/[category]/page.tsx:157`, `certyfikowany-sprzet-uzywany/page.tsx:39`) (research/08).
- `pageBuilder/ProductsListing` is dead: there is no case in `PageBuilder.tsx` and no registered block. It gets deleted, not converted (research/08).
- Only `denormBrandSlug`, `denormBrandName` and `denormCategorySlugs` are read. 13 products have their categories in a different order than their denorm field, and `denormCategorySlugs[0]` is the primary category (research/10 §0).
- `queryProductBySlug`, `queryBrandBySlug` and the category branch of `queryProductsPageContent` don't project `_type`, which `createDataAttribute` needs (research/09).
- 29 bare `[]->` derefs drop `_key` and break drag (research/11).
- `CustomFiltersConfigView` and `ReviewAuthorManager` write directly to published documents (research/09 §5).

## What We're NOT Doing

- `'use cache: remote'` / Vercel Runtime Cache (D7).
- Narrowing the block union per page (P4).
- Removing Vercel preview builds, or the B2C/P24/e2e/admin-auth `VERCEL_ENV` branches (P5).
- Safari / lane [S] of the audit (D8). It is recorded as deferred.
- A Sanity usage baseline or usage export (D6).
- Public-visitor `<SanityLive>`. Live mounts in draft mode only.
- Upstream-blocked upgrades: TS 7, ESLint 10, `@sanity/eslint-config-studio` 7, `@types/node` 26.
- Content Releases rows in the audit, and the orderable-document-list drag inside Presentation. It writes published `orderRank`, so audit row J is excluded.
- Migrating the legacy blog Embeddings Index webhook (separate decision).
- Making B2C flows work inside draft mode. Buying is disabled in draft mode (P10).

## Implementation Approach

The change goes security → dependencies → measurement baseline → fetch layer → invalidation → Presentation → audit → cut-over.

- **Why this order:**
  - The security fix ships first because the token is live in production.
  - Dependencies come next, so the Sanity work is written against the final next-sanity 13.4, client 8 and Sanity 6.20 APIs.
  - The parity baseline is captured after the dependency phase and before the fetch rewrite. Any diff then belongs to the rewrite.
  - Invalidation is built on top of the defineLive sync tags and runs in parallel with the old webhook until the soak window ends.
  - Presentation reuses the strict-defineLive plumbing: perspective and stega are threaded once.
  - The audit runs last, against the deployed pair.
- **Every phase ends with:**
  - the automated gates;
  - a commit;
  - a push to `main`, plus `sanity deploy` and Functions deploy where relevant (P8).
- **Oliwier's credentialed steps.** These are collected per phase under "Oliwier steps" and are the only hand-offs: tokens, CORS, Vercel env, Sanity Manage webhook/token deletion, enabling share access.

## Critical Implementation Details

**Timing & lifecycle.**
- Phase 6 starts the parallel run: Functions on, webhook still live. The webhook's denorm block is removed in the same phase, right after the denorm Function is verified, so two writers never race.
- The webhook itself is deleted only in Phase 12. Before that, the pricing replacement must be live and the soak checks must pass.
- During the parallel run, call sites keep their existing hand `tags` alongside the sync tags (`defineLive` `tags` option). They are pruned in Phase 12, except `product-pricing*`, `cpoProduct:<slug>` and `geocode`.

**State sequencing.**
- `SANITY_STUDIO_PRESENTATION_URL=https://audiofast.pl` must be set before the Studio deploy that ships `presentationTool`, because it is inlined at build time.
- CORS-with-credentials for `https://audiofast.pl` and `http://localhost:3000` must exist before the first Presentation session, or the iframe silently renders published content.

**Debug & observability.**
- `requestTagPrefix: 'audiofast-web'` plus a per-call `requestTag` (e.g. `product.page`, `listing.products`).
- After defineLive lands, `.next/server` must not contain `fetch-sync-tags` (D10).

---

## Phase 0: Security hotfix (token leak, committed secret, Meta token)

### Overview

Close the production token leak and the other secret exposures. Ship and deploy immediately, ahead of everything else (D1, D9).

### Changes Required:

#### 1. Split the image builder from the Sanity client

**File**: `apps/web/src/global/sanity/client.ts`, new `apps/web/src/global/sanity/image.ts`, `apps/web/src/components/shared/Image.tsx`, `apps/web/src/components/pageBuilder/HeroCarousel/HeroCarousel.tsx`, all other `urlFor` importers

**Design**: none — no rendered change.

**Intent**: Client components must import only a token-free image module. The client module becomes `server-only`.

**Contract**:
- `image.ts` exports `imageBuilder` and `urlFor` (projectId and dataset only).
- `client.ts` gets `import 'server-only'` and reads `SANITY_API_READ_TOKEN`.
- No file under `apps/web/src` reads `NEXT_PUBLIC_SANITY_API_READ_TOKEN`.

#### 2. Remove every public read-token reference

**File**: `apps/web/scripts/generate-redirects.ts:13-20`, `apps/web/src/global/sanity/blog-search.ts:70-82` (legacy fallback), `turbo.json:52`, `apps/web/.env.example`, `apps/web/.env.e2e.example`, `CODEBASE_OVERVIEW.md` env table

**Design**: none — config.

**Intent**: Builds and scripts use the server-only token. The `NEXT_PUBLIC_` variable disappears from code, docs and `globalEnv`.

**Contract**: `NEXT_PUBLIC_SANITY_API_READ_TOKEN` has zero occurrences repo-wide outside `context/`.

#### 3. Scrub the committed secret

**File**: `.ai/sanity-price-sync-implementation.md:113`

**Design**: none — docs.

**Intent**: Replace the token-shaped literal with a placeholder. Oliwier revokes it if it is live.

**Contract**: `grep -rE 'sk[A-Za-z0-9]{40,}'` over tracked files returns nothing.

#### 4. Move the Meta conversion token to env and stop per-event Sanity reads

**File**: `apps/web/src/app/api/analytics/meta/route.ts:131-145`, `apps/studio` settings schema (analytics group), `turbo.json`

**Design**: none — server-only.

**Intent**:
- The pixel id and the conversion token come from server env (`META_PIXEL_ID`, `META_CONVERSION_TOKEN`).
- The route makes no Sanity request.
- The Studio field is removed and the dataset value is unset (a mutation run by Claude).

**Contract**: `/api/analytics/meta` performs zero Sanity requests.

**Oliwier steps** (Claude prints the exact commands):
- Create a new server read token (Viewer) in Sanity.
- Set `SANITY_API_READ_TOKEN`, `META_PIXEL_ID` and `META_CONVERSION_TOKEN` in Vercel Production and `.env.local`.
- Remove `NEXT_PUBLIC_SANITY_API_READ_TOKEN` from Vercel.
- Revoke the leaked token, and the `.ai` literal if it is live.

### Success Criteria:

#### Automated Verification:

- No `NEXT_PUBLIC_SANITY_API_READ_TOKEN` in code: `grep -r NEXT_PUBLIC_SANITY_API_READ_TOKEN apps turbo.json` is empty
- No token-shaped literals tracked: `git grep -E 'sk[A-Za-z0-9]{40,}'` is empty
- Type check passes: `bun run check-types`
- Web unit tests pass: `cd apps/web && bun run test:run`
- Full build passes: `bun run build --force`
- Local build has no token in client chunks: `grep -rl SANITY_API_READ_TOKEN apps/web/.next/static` is empty
- Production chunks clean after deploy: crawl script over the homepage's `_next/static` chunks finds 0 files with `SANITY_API_READ_TOKEN` or `sk…` literals

#### Manual Verification:

- Oliwier confirms the old token is revoked in Sanity Manage.
- A Meta CAPI event still arrives in Meta Events Manager.

---

## Phase 1: Dependencies — Studio, runtime, Sanity UI port

### Overview

Bring every runtime dependency to latest in tiered commits: the Studio data-loss fix first, then the web runtime, then the Sanity UI 4 / icons 5 / SDK 3 port (D2). Process rules from research/06:
- Set explicit versions and run `bun install`; never `bun update`.
- One commit per batch.
- Run each gate set per batch.
- Stop dev servers during installs.

### Changes Required:

#### 1. Studio data-loss fix (batch 1a, deployed alone)

**File**: `apps/studio/package.json`, root `package.json`

**Design**: none — dependency bump.

**Intent**:
- Bump:
  - `sanity` + `@sanity/vision` → 6.20.x;
  - root `@sanity/cli` → ^8.23;
  - `@sanity/assist`, `sanity-plugin-media`, `styled-components` → latest;
  - `@sanity/orderable-document-list` → 2.0.28, lifting the 2.0.20 pin.
- Declare `@sanity/client` explicitly in studio.
- Run `sanity deploy`.

**Contract**: The Studio is on ≥ 6.14.1. No other code changes in this commit.

#### 2. Web runtime + React convergence (batch 1b)

**File**: all four `apps/*/package.json`, `packages/*/package.json`, `apps/web/package.json` overrides

**Design**: none.

**Intent**:
- React 19.3.x, react-dom and `@types/react(-dom)` byte-identical in all four apps.
- `next` + `@next/eslint-plugin-next` 16.4.x.
- `next-sanity` 13.4.x, `@sanity/client` 8.x.
- `@portabletext/react` 8.x.
- Supabase, zod, sass, lucide-react, react-hook-form, azure, react-email and testing-library to latest.
- Move the `@types/react` overrides to the root manifest.

**Contract**:
- `apps/web` creates every Sanity client from one source (`@sanity/client` 8, re-exported through `global/sanity/client.ts`).
- e2e selectors don't depend on CSS-module class names (Next 16.4 shortens them).

#### 3. Sanity UI 4 + icons 5 + SDK 3 port (batch 1c)

**File**:
- `apps/studio/**`, `apps/b2c-admin/**`, `apps/cms-activity/**`;
- hot spots: `b2c-admin/src/admin/components/OrderDetailView.tsx`, `studio/tools/comparator/index.tsx`, `studio/tools/newsletter/index.tsx`, `studio/plugins/bulk-actions-table/**`, `cms-activity/src/components/usePeople.ts:26`.

**Design**: none — library port, layout must stay visually identical.

**Intent**:
- `space=` → `gap=` (228 sites).
- Grid `columns`/`rows` → `gridTemplateColumns`/`gridTemplateRows` (28 sites).
- 13 subpath imports.
- 61 icon imports moved to per-icon subpaths.
- `import '@sanity/ui/styles.css'` in both App SDK `App.tsx` files and `createBulkActionsTable.tsx`.
- `useProject().data`.

**Contract**: `bun.lock` has no `@sanity/ui@3` and no `@sanity/icons@3`.

#### 4. Tooling + optional majors folded in (batch 1d)

**File**:
- root `package.json`;
- `packages/eslint-config`, `packages/typescript-config`;
- every `tsconfig.json` (`apps/web/tsconfig.json:4` `baseUrl` removal, explicit `types`);
- `apps/web/vitest.setup.ts:14` (`onUnhandledRequest` → `onUnhandledFrame`);
- `apps/web/src/test/msw/**`;
- `.nvmrc`.

**Design**: none.

**Intent**:
- Bump to latest: turbo + eslint-plugin-turbo, typescript-eslint, globals, vite, `@playwright/test` (then reinstall browsers), `@types/node` 24.x, studio migration-script deps.
- Bump prettier in its own commit.
- TypeScript 6.0.x.
- vitest 5, jsdom 30, msw 3.
- Add `.nvmrc` pinned to 24, matching the Vercel runtime.

**Contract**:
- Tests stay green under vitest 5, whose default clears mocks between tests.
- jsdom 30 needs Node 22.22+ or 24.15+, so tests run under Node 24 locally.

#### 5. Cleanup + held-upgrades record

**File**: `apps/web/package.json` (drop `next-themes`, `@vercel/edge-config`; keep `minimatch` only if it is a security pin), `CLAUDE.md`, `apps/web/AGENTS.md` (turbo-managed block)

**Design**: none — docs.

**Intent**:
- Record the held upgrades with their unblock conditions.
- Fix stale CLAUDE.md lines ("Sanity v5 Studio", "8 GB heap").

**Contract**: CLAUDE.md has a "Held upgrades" section.

### Success Criteria:

#### Automated Verification:

- Studio deployed on ≥6.14.1: `bunx sanity --version` in apps/studio and `sanity deploy` succeeds
- Typegen has no unexpected drift: `bun run typegen && git diff --stat apps/web/src/global/sanity/sanity.types.ts`
- Type check passes: `bun run check-types`
- Lint passes with 0 errors: `bun run lint`
- Web unit tests pass: `cd apps/web && bun run test:run`
- b2c-admin tests pass: `cd apps/b2c-admin && bun run test`
- Full build (all Sanity apps) passes: `bun run build --force`
- No duplicate Sanity UI/icons majors: `grep -c '"@sanity/ui@3\|"@sanity/icons@3' bun.lock` returns 0
- React identical across apps: one `react@` version in `bun.lock`
- e2e suite passes: `cd apps/web && bun run test:e2e`

#### Manual Verification:

- Studio: edit Portable Text in a long blog article and a product; drag an orderable list.
- b2c-admin Orders, Coupons and Analytics, plus the Raport pracy CMS app: no layout regressions from the Grid/gap port.
- A blog article with nested lists renders correctly under `@portabletext/react` 8.

---

## Phase 2: Published HTML parity crawler + baseline

### Overview

Build the regression net for the fetch rewrite (P7) and record the baseline from the post-dependency build.

### Changes Required:

#### 1. Parity crawler

**File**: new `apps/web/scripts/check-parity.ts`, new `apps/web/scripts/lib/crawl.ts` (shared, Bun-free helpers, later reused by the stega crawler), root `package.json` script `check:parity`

**Design**: none — tooling.

**Intent**: Walk every URL in `sitemap.xml`, plus probes for listing `?page=2`, filter combinations, `/porownaj`, 404s and `/produkty/archiwalne/`. For each URL, record:
- status code;
- `<title>`;
- meta description;
- canonical;
- JSON-LD (normalized);
- stega-stripped visible text (a bag of words).

**Contract**:
- `bun run check:parity --base <url> --out <dir> [--compare <baselineDir>]`.
- Exit codes: 0 = no diff, 1 = diff, 2 = bad arguments.
- Run against an isolated local production build (`next start` on its own port), never a shared dev server.

#### 2. Baseline snapshot

**File**: `context/changes/sanity-modernization/parity/baseline/` (JSON per URL plus a summary)

**Design**: none.

**Intent**: Capture the baseline from the Phase 1 build before any fetch-layer change.

**Contract**: A baseline summary file with its URL count.

### Success Criteria:

#### Automated Verification:

- Crawler unit tests pass: `cd apps/web && bunx vitest run scripts/lib`
- Baseline captured: `context/changes/sanity-modernization/parity/baseline/summary.json` exists with every sitemap URL
- Self-compare is clean: `bun run check:parity --compare parity/baseline` against the same build exits 0

---

## Phase 3: defineLive fetch seam, client, cache config

### Overview

Replace the env-switched client and the wrappers with strict `defineLive`, so every read is published + CDN unless draft options are passed. Pass existing hand tags through (parallel run), add request tags and `minifyGroq`, and drop the Sanity preview-deployment code paths (D5, P5).

### Changes Required:

#### 1. Single client, no env switch

**File**: `apps/web/src/global/sanity/client.ts`, `apps/web/src/global/constants.ts` (Sanity usages only)

**Design**: none.

**Intent**: One client:
- `useCdn: true`;
- `perspective: 'published'`;
- `requestTagPrefix: 'audiofast-web'`;
- `stega: { enabled: false, studioUrl, filter }` (the filter list is filled in Phase 8);
- server token only.

Remove the `VERCEL_ENV`/`IS_PRODUCTION_DEPLOYMENT` switch for Sanity, including the local `'drafts'` perspective, and the unused `studioUrl` export.

**Contract**: Localhost, preview deployments and production all render published content.

#### 2. `live.ts` and helpers

**File**: new `apps/web/src/global/sanity/live.ts`; `apps/web/src/global/sanity/fetch.ts` (reduced to the non-live helpers)

**Design**: none.

**Intent**:
- `defineLive({ client, serverToken, browserToken /* Viewer */, strict: true })`.
- `getDynamicFetchOptions()`: draft cookie → `{perspective, stega}`.
- Typed `sanityFetch` (requires `perspective` and `stega`).
- `sanityFetchPublished` with its own `'use cache'`, aliased as `sanityFetchMetadata` and `sanityFetchStaticParams`, plus a published helper for actions and routes.
- Keep `sanityFetchFresh` for cart and checkout.
- Keep the retry wrapper around the live call.
- Drop the hand-set `cacheMode`.

**Contract**:
```ts
sanityFetch<Q>({ query, params, perspective, stega, tags?, requestTag }): Promise<{ data, sourceMap, tags }>
```
- Every call sits inside a `'use cache'` scope.
- Existing call-site `tags` are passed through unchanged until Phase 12.

#### 3. Cache profiles

**File**: `apps/web/next.config.ts:20-46`

**Design**: none.

**Intent**:
- Add `sanity` from `next-sanity/live/cache-life`.
- Add explicit `pricing` and `geocode` profiles.
- Remove the overrides that made `hours`/`days`/`weeks`/`max` all mean 30 days.
- Remove the preview `cacheLife('minutes')` branch (`fetch.ts:82-84`).

**Contract**: Sanity entries use `cacheLife(sanity)`. Non-Sanity caches use their named profiles.

#### 4. GROQ minification + request tags

**File**: new `apps/web/src/global/sanity/minify-groq.ts` (port from lsse), `apps/web/src/global/sanity/query.ts`

**Design**: none.

**Intent**:
- Every exported query goes through `minifyGroq` at module scope, with typegen still resolving.
- Each call site passes a stable `requestTag`.

**Contract**: Typegen query count is unchanged.

#### 5. Turbopack variant check

**File**: new `apps/web/scripts/verify-live-variant.ts`, wired into `verify:build-env` or run post-build

**Design**: none.

**Intent**: Fail if the built server output contains `fetch-sync-tags`, which would mean the two-request build was selected (D10).

**Contract**: Exit 1 if the marker is found.

### Success Criteria:

#### Automated Verification:

- Type check passes: `bun run check-types`
- Web unit tests pass (incl. new `live.test.ts` for `getDynamicFetchOptions`): `cd apps/web && bun run test:run`
- Full build passes: `bun run build --force`
- One-request variant selected: `bun apps/web/scripts/verify-live-variant.ts` exits 0
- No env-switched Sanity config remains: `grep -n "VERCEL_ENV\|IS_PRODUCTION_DEPLOYMENT" apps/web/src/global/sanity` is empty
- Parity vs baseline clean: `bun run check:parity --compare parity/baseline` exits 0

---

## Phase 4: Three-layer routes, layout, prerender-all

### Overview

Convert every route and self-fetching component to the three-layer shape, following the conversion map in research/08:
- Presentation targets become draft-capable.
- B2C and utility routes become published-only.
- Every production slug is prerendered.

### Changes Required:

#### 1. Root layout

**File**: `apps/web/src/app/layout.tsx`, `components/ui/Header/index.tsx`, `components/ui/Footer/index.tsx`, `components/shared/CookieConsent/CookieConsent.tsx`, `components/shared/Analytics.tsx`

**Design**: none — structure only; PreviewBar/VisualEditing mount points are added here but rendered in Phase 8.

**Intent**:
- Drop `'use cache'` at `layout.tsx:28` and read `draftMode()` uncached; at prerender it resolves to published.
- Header and Footer become published cached leaves, plus Suspense draft leaves.
- CookieConsent, Analytics/GTM and the settings JSON-LD render only when `!isDraft`, and only from published data.
- Never put `children` inside `'use cache'`.

**Contract**: The `next build` route table shows the same static/partial status as before, or better.

#### 2. Presentation-target routes (orchestrator → dynamic → cached)

**File**:
- `app/page.tsx`, `app/[slug]/page.tsx`, `app/not-found.tsx`;
- `app/produkty/[slug]/page.tsx`, `app/marki/page.tsx`, `app/marki/[slug]/page.tsx`;
- `app/blog/[slug]/page.tsx`, `app/recenzje/[slug]/page.tsx`;
- `app/certyfikowany-sprzet-uzywany/[slug]/page.tsx`;
- `app/polityka-prywatnosci/page.tsx`, `app/regulamin/page.tsx`;
- `app/porownaj/page.tsx`.

**Design**: none.

**Intent**:
- Use the official pattern.
- `notFoundUnlessDraft()` replaces `notFound()` where a never-published draft must render.
- Metadata goes through `sanityFetchMetadata` with shared cached data functions, reusing the page fetch the way the brand page does. This deletes the separate `*SeoBySlug` queries.
- `/porownaj` resolves the draft options inline, since it already reads cookies.

**Contract**:
- Each page exports the orchestrator only.
- The cached component takes `perspective` and `stega` props.
- `perspective` and `stega` are never accepted from server-action input.

#### 3. Listing routes (pass-through Suspense slot)

**File**:
- `app/produkty/(listing)/page.tsx`, `app/produkty/(listing)/kategoria/[category]/page.tsx`;
- `app/blog/(listing)/page.tsx`, `app/blog/(listing)/kategoria/[category]/page.tsx`;
- `app/certyfikowany-sprzet-uzywany/page.tsx`;
- `components/products/ProductsListing`, `components/blog/BlogListing`, `components/pageBuilder/CpoProductsListing/**`.

**Design**: none.

**Intent**:
- The cached shell (page content plus filter metadata) receives the `searchParams` listing as a Suspense slot built outside the cache scope.
- Prove this on `/produkty/` in `next dev` first. If dev hangs, fall back to sibling cached leaves.
- Move the `searchParams` awaits at `kategoria/[category]/page.tsx:157` and `certyfikowany-sprzet-uzywany/page.tsx:39` inside Suspense, so the shells prerender.
- Filter metadata and listing queries always run with `stega: false`; filter definitions are `stegaClean`'ed.

**Contract**: The listing shells are static in the build route table.

#### 4. Published-only routes, actions and handlers

**File**:
- `app/sitemap.ts`, `app/koszyk/**`, `app/produkty/archiwalne/page.tsx`, `app/recenzje/archiwalne/page.tsx`;
- PDF routes `app/produkty/[slug]/pliki/[pdfKey]/route.ts`, `app/recenzje/pdf/[slug]/route.ts`;
- `app/api/contact/route.ts`, `app/actions/{product-quick-add,comparison}.ts`, `global/mailchimp/subscribe.ts`;
- `global/b2c/{customer-transactional-email,legal-documents/*,admin/server/coupon-products}.ts`;
- `global/seo.ts`, `components/schema/*`, `components/pageBuilder/ContactMap`.

**Design**: none.

**Intent**:
- Each moves to the published cached helper with the existing tags.
- ContactMap folds settings into the block projection, removing its self-fetch.
- The JSON-LD components fetch published data only.
- The PDF routes add `s-maxage` / `CDN-Cache-Control`.
- `queryComparisonPageData` becomes cached and narrows to the compared products' categories via `denormCategorySlugs`.
- The exported comparison action validates its input.

**Contract**: No published-only path reads `draftMode()`.

#### 5. Dead code removal

**File**: `components/pageBuilder/ProductsListing/**`, `query.ts:765-796` (the `productsListing` block branch), dead queries (`queryProductsPageData`, `queryBlogPageData`, `queryCategoryMetadata`, the aliases, `productsFilterMetadataFragment` at `:1843-1965`)

**Design**: none.

**Intent**: Delete code that is unused or that traps future reuse.

**Contract**: Typegen succeeds; no imports remain.

#### 6. Prerender every slug

**File**: `apps/web/src/global/build.ts`, every `generateStaticParams`, `next.config.ts` (lsse build-hardening settings: static-generation concurrency/retry)

**Design**: none.

**Intent**:
- Limit static params only when `VERCEL_ENV !== 'production'`.
- Every route returns a placeholder slug when the list is empty.
- `StoreLocations` on the product page moves inside Suspense, so ~866 prerenders don't block on Nominatim.

**Contract**: A production build prerenders ~1,350–1,450 pages.

### Success Criteria:

#### Automated Verification:

- Type check passes: `bun run check-types`
- Lint passes: `bun run lint`
- Web unit tests pass: `cd apps/web && bun run test:run`
- Production-mode build passes with all slugs: `VERCEL_ENV=production bun run build --force` and the route table lists every product/blog/review/CPO slug
- Parity vs baseline clean: `bun run check:parity --compare parity/baseline` exits 0 (intentional diffs, if any, are listed in `parity/accepted-diffs.md` with reasons)
- e2e suite passes: `cd apps/web && bun run test:e2e`
- One-request variant still selected: `bun apps/web/scripts/verify-live-variant.ts`

#### Manual Verification:

- `/produkty/` filters, sort, pagination and search behave identically.
- Production deploy: product, brand and blog pages respond from cache (`x-vercel-cache: HIT` on a second request).

---

## Phase 5: Query efficiency

### Overview

Fix the ranked query hotspots that remain after the seam swap (P4, research/04 §5).

### Changes Required:

#### 1. Filter metadata

**File**: `apps/web/src/global/sanity/query.ts:1776-1830`

**Design**: none.

**Intent**:
- Use a lite logo fragment with no LQIP.
- Replace the per-product `brand->doNotShowBrand` deref with the denormalized brand check, or prefilter brands once.
- Compute global min/max in JS from `products`, dropping the two extra scans.

**Contract**: The response stays shape-compatible for the consumers. Payload size and query time drop, measured before and after in the phase notes.

#### 2. CPO listing and filter metadata

**File**: `components/pageBuilder/CpoProductsListing/CpoProductsListingInner.tsx:65-76`, `query.ts:1149-1233`

**Design**: none.

**Intent**:
- Merge list and count into one query.
- Compute the CPO filter brands and min/max in JS.

**Contract**: One request per CPO listing render.

#### 3. Page-builder heavy branches and derefs

**File**: `query.ts` (`brandsByCategoriesSectionBlock`, `featuredPublicationsBlock`, `blogArticlesFilterConditions`, `productsFilterConditions`)

**Design**: none.

**Intent**:
- Replace `...` spreads with explicit projections in the block fragments.
- Use `denorm*` fields instead of per-row derefs where they exist.
- Re-project `_key` on the 29 bare `[]->` derefs. Phase 9 needs this too.

**Contract**: No bare `[]->{` remains in `query.ts`.

#### 4. N+1 fixes

**File**: `global/b2c/cart/server/revalidation.ts:84-107,145-160`, `global/b2c/checkout/server/cpo-availability.ts` (`releaseExpiredCpoHoldBySlug`)

**Design**: none.

**Intent**: Batch with `slug.current in $slugs`.

**Contract**: One fresh request per cart revalidation, not one per line.

### Success Criteria:

#### Automated Verification:

- Type check + typegen clean: `bun run typegen && bun run check-types`
- Web unit tests pass (cart revalidation tests updated): `cd apps/web && bun run test:run`
- No bare deref-to-object projections: `grep -nE '\[\]->\{' apps/web/src/global/sanity/query.ts` is empty
- Parity vs baseline clean: `bun run check:parity --compare parity/baseline` exits 0
- e2e cart/checkout suite passes: `cd apps/web && bun run test:e2e`

---

## Phase 6: Sanity Functions — denormalization + sync-tag invalidation (parallel run)

### Overview

Stand up the Blueprint and two Functions (P1, P2, research/10 §3). Move the denorm writes out of the webhook, and add the explicit pricing and CPO invalidation. The old webhook keeps running for cache invalidation until Phase 12.

### Changes Required:

#### 1. Blueprint + functions workspace

**File**: new root `sanity.blueprint.ts`, new `apps/functions/{package.json,denormalize-products/index.ts,invalidate-sync-tags/index.ts}`, root `package.json` scripts (`blueprints:deploy`), `.gitignore`

**Design**: none.

**Intent**: Port the Najbar/lsse layout. Each function has its own `package.json`.

**Contract**: `sanity blueprints deploy` creates a stack for `fsw3likv`.

**Prerequisite**: confirm the Functions entitlement in Manage, or let `blueprints init` fail loudly.

**Fallback**: if the project is not entitled, stop and ask Oliwier. The plan then falls back to keeping a slim webhook for denorm only.

#### 2. `denormalize-products` Function

**File**: `apps/functions/denormalize-products/index.ts` (+ unit-tested pure diff module)

**Design**: none.

**Intent**:
- **Triggers:** brand, `productCategorySub`, and product create/update where brand or categories change. Filter: GROQ `delta::changedAny(...)`; if `before()/after()` is unsupported, fall back to a `_type` filter plus a handler-side diff.
- **Computes:** `denormBrandSlug`, `denormBrandName` and `denormCategorySlugs`, in the editor's `categories[]` order. Patch only on a diff.
- **Loop guard:** the Function skips events whose only changes are its own `denorm*` fields.
- **Transactions:** batch-patch in transactions of 50 for brand and category fan-out.
- **Cleanup:** drop the unread `denormParentCategorySlugs` and `denormFilterKeys` writers.

**Contract**:
- Idempotent.
- A no-op diff makes no request.
- The webhook's denorm block (`route.ts:547-548,658-669,732-738,847-1007`) is removed in the same phase, after the Function is verified on one real brand edit.
- A one-time backfill aligns the 13 reordered products to the editor's order. Their slugs are listed in the phase-end message.

#### 3. `/api/revalidate-tags/` route + `invalidate-sync-tags` Function

**File**: new `apps/web/src/app/api/revalidate-tags/route.ts` (+ `route.test.ts`), `apps/functions/invalidate-sync-tags/index.ts`, `turbo.json` (`SANITY_REVALIDATE_TAGS_SECRET`)

**Design**: none.

**Intent**:
- **Function:** posts sync tags to `https://audiofast.pl/api/revalidate-tags/` (trailing slash), then calls `done()`.
- **Route:**
  - authenticates the secret with a constant-time compare;
  - accepts `sanity:` sync tags plus an allowlisted custom-tag branch (`product-pricing`, `product-pricing:<slug>`);
  - runs `revalidateTag(tag, 'max')`;
  - warms `/` and the URLs resolved from the event (throttled).

**Contract**:
- `POST { tags: string[] } | { customTags: string[] }` → 200 `{ revalidated: n }`.
- 401 on a bad secret; 400 on a malformed body.

#### 4. Pricing and CPO invalidation

**File**: Supabase Edge Function `pricing-ingest` (source downloaded via `supabase functions download`), `apps/web/src/global/b2c/checkout/server/cpo-availability.ts:231-266`

**Design**: none.

**Intent**:
- **Pricing:** first download and grep `pricing-ingest`, `sync-prices-to-sanity` and `cpo-product-sync` for `/api/revalidate`. `pricing-ingest` then POSTs `customTags:['product-pricing']` once per run and is redeployed (option A, research/10 §3.4). If the source or the deploy isn't accessible, fall back to option B: a document Function on `lastPricingSync` changes.
- **CPO:** narrow to `revalidateTag('cpoProduct:'+slug, {expire:0})`, keep the custom tag on the detail fetches, and drop the broad `cpoProduct` and listing `revalidatePath`.

**Contract**: An Excel price run updates product-page prices without the old webhook. A CPO reserve or sale flips only that detail page.

**Oliwier steps**:
- Set `SANITY_REVALIDATE_TAGS_SECRET` in Vercel and via `sanity functions env add`.
- Provide Supabase CLI access if `functions download`/`deploy` needs a login.

### Success Criteria:

#### Automated Verification:

- Function unit tests pass: `cd apps/functions && bunx vitest run`
- Route tests pass: `cd apps/web && bunx vitest run src/app/api/revalidate-tags`
- Type check passes: `bun run check-types`
- Full build passes: `bun run build --force`
- Blueprint deployed: `bunx sanity blueprints stacks --project-id fsw3likv` lists the stack with both functions
- Function smoke test: `bunx sanity functions test denormalize-products` with a brand fixture produces the expected patch set
- Denorm parity on live data: GROQ drift check (brand name/slug drift = 0, products missing `denormCategorySlugs` = 0) after the backfill

#### Manual Verification:

- Edit a brand name in the Studio: `functions logs denormalize-products` shows the fan-out, and the products show the new `denormBrandName`.
- Publish a product change with no tabs open: the next visit shows fresh content within seconds.
- An Excel price run updates prices on a product page.

---

## Phase 7: Presentation — Studio

### Overview

Port lsse's Studio Presentation stack, adapted to audiofast (research/11 §2): complete coverage of every document type (D4).

### Changes Required:

#### 1. `presentationTool` config

**File**: `apps/studio/sanity.config.ts`, `apps/studio/.env.example`, `turbo.json`

**Design**: none — Studio config.

**Intent**:
- `presentationTool({ title: 'Podgląd', previewUrl: { initial: getPresentationUrl, previewMode: { enable: '/api/draft-mode/enable', shareAccess: true } }, allowOrigins: ['http://localhost:3000','https://audiofast.pl'], resolve: { locations, mainDocuments } })`.
- Lazy `getPresentationUrl()`.
- Replace the dead env vars with `SANITY_STUDIO_PRESENTATION_URL`.

**Contract**: The Studio boots even when the env var is missing; the tool throws only when opened.

#### 2. Routes, locations, mainDocuments

**File**: new `apps/studio/presentation/{routes,locations,main-documents,pagination}.ts` + tests

**Design**: none.

**Intent**:
- **`HREF_EXPRESSIONS`:** hand-written, mostly `slug.current`. `productCategorySub` maps to `/produkty` + slug; reviews follow `destinationType`.
- **`TITLE_EXPRESSIONS`.**
- **`PARENT_LOCATIONS`** with `?page=N` pagination helpers: blog by date, products by `orderRank`, CPO.
- **`STATIC_LOCATIONS`** (Polish messages): settings, navbar, footer, socialMedia, redirects, notFound, comparatorConfig.
- **`REFERENCED_ONLY_TYPES`** via `references($id)` + `listenQuery`: store, award, teamMember, faq, reviewAuthor, youtubeVideo, productCategoryParent, and the others in research/05 §4.2.
- **`defineDocuments`:** in specificity order (`/produkty/kategoria/:slug` before `/produkty/:slug`, `/blog/kategoria/:slug` before `/blog/:slug`, the `/:slug` catch-all last), using URLPattern syntax.

**Contract**: The completeness test asserts that every schema document type is routed, static or referenced. It also asserts the ordering invariants.

#### 3. Navigation helpers + Open action

**File**: new `apps/studio/presentation/{preview-target,contextual-tool-menu,slug-preview-navigation}.tsx`, new `apps/studio/plugins/presentation-url.ts`, `sanity.config.ts` actions (both the singleton and collection branches)

**Design**: undrawn — authored per lsse equivalents (Polish copy „Otwórz w podglądzie”, „Brak adresu strony”).

**Intent**:
- „Otwórz w podglądzie” uses `navigateIntent('edit', {id, type, mode:'presentation', preview})`. It is appended last, so Publish stays primary, and it is absent for unrouted types.
- The contextual tool menu is ported, with its `@beta` API risk noted in a comment.
- Preview follows a slug rename.

**Contract**: Unrouted types have no action. A document without a slug shows the Polish toast.

#### 4. Slug-field URL fix + direct-publish writers

**File**: `apps/studio/components/slug-field-component.tsx:177`, `apps/studio/utils/constant.ts:58-60`, `components/custom-filters-config/*`, `components/review-author-manager/*`

**Design**: none — text fix.

**Intent**:
- The slug field reuses the shared URL resolver from `routes.ts`, which fixes the double slash, the `productCategorySub` prefix and PDF reviews.
- `WEB_BASE_URL` becomes `https://audiofast.pl` in production and `http://localhost:3000` in dev, dropping the dev-branch URL (P5).
- `CustomFiltersConfigView` and `ReviewAuthorManager` write drafts instead of published documents, so Presentation sees the edits.

**Contract**: The resolver has one source of truth, used by both the slug field and `locations`.

#### 5. Studio vitest setup

**File**: new `apps/studio/vitest.config.ts`, `apps/studio/package.json` (`test` script, `groq-js`)

**Design**: none.

**Intent**: Run the ported Studio tests: completeness, URL action, preview-target, pagination, slug navigation.

**Contract**: `cd apps/studio && bun run test` runs in turbo `test`.

### Success Criteria:

#### Automated Verification:

- Studio tests pass: `cd apps/studio && bun run test`
- Type check passes: `bun run check-types`
- Studio builds: `cd apps/studio && bunx sanity build`
- Completeness test covers all schema types: included in studio tests

#### Manual Verification:

- After the Phase 8 web deploy: the „Podgląd” tab lists the "Używany na" locations for a product, a brand, a store and the settings document.

---

## Phase 8: Presentation — web draft mode, stega, overlays, B2C isolation

### Overview

Wire the web side (research/11 §3, research/09):
- draft mode and the UI that goes with it;
- the stega filter and cleaning;
- `data-sanity` overlays on blocks, referenced documents and chrome;
- B2C purchase disabled in draft mode.

### Changes Required:

#### 1. Draft mode plumbing

**File**: new `app/api/draft-mode/enable/route.ts`, new `app/actions/draft-mode.ts`, new `components/shared/PreviewBar/**`, new `components/shared/LiveVisualEditing/index.tsx`, `app/layout.tsx`

**Design**: undrawn — PreviewBar authored per lsse/Najbar PreviewBar (Polish: „Podgląd wersji roboczej” / „Wyjdź z podglądu”), styled to audiofast SCSS conventions.

**Intent**:
- The enable route is `defineEnableDraftMode`. Keep its CHIPS comment.
- Disabling is a server action.
- PreviewBar is a dynamic import that is hidden inside Presentation.
- `<VisualEditing basePath="" trailingSlash onSuspiciousStega={dev only}/>` and `<SanityLive includeDrafts/>` render only in draft mode.

**Contract**: Published HTML contains no `data-sanity`, no visual-editing chunk and no SanityLive.

#### 2. Stega filter + cleaning

**File**: `global/sanity/client.ts` (filter), new `global/utils/stega-text.ts` (+ test), render sites from research/09 §2–3

**Design**: none.

**Intent**:
- `STEGA_LOGIC_ONLY_FIELDS` uses the research/09 list: 31 leaf names, the `customFilters`/`customFilterValues`/`analytics` subtrees, and `gtm_id`/`ga4_id`/`googleAds_id`. The filter composes with `filterDefault` and checks the parent segment for primitive-array members.
- `stega-text.ts` (`stripStega`, `hasText`) uses the vendor alphabet.
- `stegaClean` at the ~14 `name`/`title` attribute and analytics sites.
- `hasText` at the ~20 emptiness sites.

**Contract**: Gate tests (Phase 10) enforce enum coverage and the emptiness predicates.

#### 3. Overlays

**File**: new `global/sanity/data-attribute.ts`; `components/pageBuilder/PageBuilder.tsx`; product, brand, blog, review and CPO page section components; Header and Footer; referenced-document renderers (FAQ, team, stores, awards, review author); client islands (HeroCarousel, HeroStatic, BrandsMarquee, NotFound)

**Design**: none — attributes only.

**Intent**:
- `getDataAttribute()` is draft-gated.
- Block-level wrappers go in PageBuilder.
- Referenced documents open their own document.
- Client islands receive pre-computed `String(dataAttribute)`.
- Add `_type` to `queryProductBySlug`, `queryBrandBySlug` and the category branch of `queryProductsPageContent`.

**Contract**: Every rendered block and referenced item is clickable in draft mode, or listed in the coverage gate's exclusion list with a reason.

#### 4. B2C isolation + draft edge cases

**File**: product hero add-to-cart, `ProductCardAddToCart`, quick-add, `components/ui/StoreLocations/index.tsx`, `app/koszyk/**`, `app/konto-klienta/**`, `app/podziekowania-za-zakup/**`

**Design**: undrawn — disabled button state plus a short Polish note („Zakup niedostępny w podglądzie”), per existing button disabled styles.

**Intent**:
- Buy and quick-add are disabled in draft mode (P10).
- B2C routes ignore draft mode and are not Presentation targets.
- In draft mode StoreLocations renders the list without geocoding.
- CPO `availabilityStatus` is in the stega filter.

**Contract**: No cart or checkout server action can receive a stega-encoded string.

**Oliwier steps** (from research/11 §8):
- `sanity cors add` for `http://localhost:3000` and `https://audiofast.pl`, both with `--credentials`.
- Create the Viewer `browserToken` and set it in Vercel and `.env.local`.
- Set `SANITY_STUDIO_PRESENTATION_URL` before the Studio deploy.
- After the deploy, enable share access once in Presentation.

### Success Criteria:

#### Automated Verification:

- Web unit tests pass (stega-text, data-attribute, draft options): `cd apps/web && bun run test:run`
- Type check + lint pass: `bun run check-types && bun run lint`
- Full build passes: `bun run build --force`
- Published HTML has no overlays: `curl -sL https://audiofast.pl/ | grep -c data-sanity` prints 0 after deploy
- Parity vs baseline still clean: `bun run check:parity --compare parity/baseline` exits 0
- Studio + web deployed: `sanity deploy` succeeds and the Vercel deployment is READY at the pushed SHA

#### Manual Verification:

- In the deployed Studio, „Podgląd” on a product shows a typed draft edit within a few seconds, and a click opens the right field.

---

## Phase 9: Drag-and-drop (lsse level)

### Overview

Make PageBuilder blocks reorderable with an optimistic update, and annotate every draggable nested array (P3, research/09 §1, research/11 §4).

### Changes Required:

#### 1. Optimistic PageBuilder

**File**: new `components/pageBuilder/{OptimisticBlocks,OptimisticReorder}.tsx`, `global/sanity/optimistic-order.ts` (+ test), `PageBuilder.tsx`

**Design**: none.

**Intent**:
- Port the Najbar/lsse trio:
  - `useOptimistic` from `next-sanity/hooks`;
  - the reducer stores `_key` order only;
  - children matched via `Children.forEach` on the raw key;
  - fall back to server order when fewer keys match.
- No `ssr:false` on the wrapper.
- Use bare `_key` as the React key, after a duplicate-key audit.

**Contract**: Draft-only. Published output stays a keyed Fragment.

#### 2. Nested arrays

**File**: the 12 draggable-as-is and 11 needs-`_key` arrays in research/09 §1 (`heroStatic.blocks`, `boxes`, `steps`, navbar buttons, footer links, 404 buttons, `downloadablePdfs`, PT lists, FAQs, contacts, team, stores, social media, PT products, gallery, `accountList`)

**Design**: none.

**Intent**:
- Annotate each item with `dataAttribute.scope([field, {_key}])`.
- Re-project `_key` where Phase 5 hasn't already.
- Header nav vs the mobile drawer: annotate only one DOM copy.

**Contract**: Each of the 23 arrays can be reordered in Presentation.

#### 3. Non-draggable record

**File**: new `context/changes/sanity-modernization/presentation-arrays.md`, plus a file-header note in each affected component

**Design**: none — docs.

**Intent**: List the 31 non-draggable arrays with their reasons: embla loop or clones, marquee, `select()` without a source map, query order, hidden custom panes, primitive arrays. This is audit row C8.

**Contract**: Every array in research/09 §1 is classified.

### Success Criteria:

#### Automated Verification:

- Optimistic-order tests pass: `cd apps/web && bunx vitest run src/global/sanity/optimistic-order`
- Type check + lint pass: `bun run check-types && bun run lint`
- Full build passes: `bun run build --force`
- Parity vs baseline clean: `bun run check:parity --compare parity/baseline` exits 0

---

## Phase 10: Tier 0 gates

### Overview

Port the deterministic Presentation gates (research/03 §3.2, research/11 §5–6) and make them green.

### Changes Required:

#### 1. Stega leak crawler

**File**: new `apps/web/scripts/check-stega-leaks.ts` (reuses `scripts/lib/crawl.ts`), root `package.json` script `check:stega-leaks`

**Design**: none.

**Intent**: Port lsse without the locale handling, and add `?page=` and B2C probes.
- **Published mode:** zero markers and zero `data-sanity`.
- **Draft mode:** markers only in visible text. A draft session comes from the share-access secret, falling back to `createPreviewSecret`.
- **Both modes:** a cross-mode bag-of-words diff and `ssr-error` detection.

**Contract**:
- `--base --out --mode published|draft|both --concurrency --probe --limit`.
- Exit codes: 0 clean, 1 findings, 2 setup error.

#### 2. Gate tests (vitest)

**File**: new `apps/web/scripts/presentation-gates/{enum-stega-coverage,emptiness-predicates,deref-key-lint,data-attribute-coverage,draft-not-found-status}.test.ts`

**Design**: none.

**Intent**:
- Every `options.list` field is in the filter or in the vendor denylist.
- No unsafe `.trim()` / `||`.
- No bare `[]->{`.
- Every block threads `dataAttribute` or is excluded with a reason.
- A never-published draft returns 200 in draft mode and 404 when published.

**Contract**: The tests run in `bun run test` via turbo.

#### 3. Dataset hygiene + stega type probe

**File**: new `apps/web/scripts/scan-dataset-stega.ts`

**Design**: none.

**Intent**:
- A read-only scan of all dataset strings for `{4,}` stega runs (gate 0.9).
- Record the `StegaBranded` type probe result (gate 0.8) in the phase notes.

**Contract**: The scan reports a count and exits 1 when anything is found.

### Success Criteria:

#### Automated Verification:

- Gate tests pass: `cd apps/web && bunx vitest run scripts/presentation-gates`
- Studio completeness test passes: `cd apps/studio && bun run test`
- Published crawl clean on production: `bun run check:stega-leaks --base https://audiofast.pl --mode published` exits 0
- Draft crawl clean on an isolated local prod build: `bun run check:stega-leaks --base http://localhost:3108 --mode both` exits 0
- Dataset clean: `bun apps/web/scripts/scan-dataset-stega.ts` reports 0

---

## Phase 11: Presentation audit walkthrough (Claude in Chrome)

### Overview

Re-run the lsse audit for audiofast (research/03 §3, §6.4), with lanes [L] then [D]. Lane [S] is deferred (D8). QA fixtures are seeded in production and hidden (P9).

### Changes Required:

#### 1. Audit artifacts

**File**: new `context/changes/sanity-modernization/audit/{walkthrough-brief.md,test-plan.md}`, `audit/walkthrough/{README.md,loop.md,results.template.md}`

**Design**: none — docs.

**Intent**:
- **Brief:**
  - the rig table with a Verified column;
  - lanes [L]/[D];
  - fixtures by id;
  - expected behaviours that look like bugs, including draft listings that show published denorm data and disabled purchase;
  - probes;
  - the gated order.
- **Test plan:** the trimmed lsse catalogue (~40 rows) plus the B2C isolation suite. Every row has preconditions, steps, a literal PASS observable, evidence, and a BLOCKED clause.

**Contract**: Every row has a literal DOM, GROQ, cookie or CLI observable.

#### 2. Tooling

**File**: new `scripts/walkthrough/summarize-results.ts` + 3 fixtures (copied from lsse), new `apps/studio/seeds/qa-presentation.json` + a small applier (dry-run default, `--execute`)

**Design**: none.

**Intent**:
- The QA `page` (`doNotIndex`, published, excluded from the sitemap and listings) has one block per archetype, ≥2 items in every array, every optional field filled, and stable `qa-<block>-<n>` keys.

**Contract**: The summariser exits 0 if and only if there are no FAIL rows.

#### 3. Runs

**File**: `audit/walkthrough/run-<n>/{results.md,fixes.md?,needs-human.md?,done.md?,evidence/}`

**Design**: none.

**Intent**:
- Freeze facts: `_id` + `_rev` baselines, and confirm there are no pre-existing drafts on fixtures.
- Run phases of 5–8 rows via Claude in Chrome.
- Fix FAILs by cause, with bounded fixes and gates.
- Commit `fix(sanity-modernization): <cause> (run n)` and re-run in a new folder.
- Stop after 5 iterations.
- After each run, the cleanup GROQ shows `drafts: []` and `_rev` equal to the baseline.

**Contract**: Run folders are immutable. A PASS needs a pasted artifact; INCONCLUSIVE counts as BLOCKED.

### Success Criteria:

#### Automated Verification:

- Summariser tests pass: `bunx vitest run scripts/walkthrough`
- Final run summary clean: `bun scripts/walkthrough/summarize-results.ts audit/walkthrough/run-<final>/results.md` exits 0
- Cleanup asserted: the cleanup GROQ in `run-<final>/done.md` shows no drafts on touched ids and baseline `_rev`s
- All Tier 0 gates still green: `bun run check:stega-leaks --base https://audiofast.pl --mode published`

#### Manual Verification:

- Oliwier reviews `run-<final>/results.md` and the BLOCKED reasons.
- An editor's-feel pass in the deployed Studio on a product, a brand and the homepage.

---

## Phase 12: Cut-over and closeout

### Overview

After the soak checks pass:
- retire the webhook;
- prune the hand tags;
- clean up env vars and docs;
- record the lessons.

### Changes Required:

#### 1. Retire the webhook

**File**: delete `apps/web/src/app/api/revalidate/{route.ts,route.test.ts}`; fix comment references in `global/products/brand-stores.ts:4` and `global/sanity/query.ts:2407`; remove the product branch of `apps/studio/actions/wrap-publish-with-denorm.ts:86-113`

**Design**: none.

**Intent**:
- The Functions and the explicit pricing/CPO invalidation are the only invalidation path.
- Soak checks before deletion:
  - publish → fresh, twice;
  - zero-tab publish;
  - an Excel price run;
  - a CPO reserve.

**Contract**: No code references `/api/revalidate`.

#### 2. Prune hand tags

**File**: every call site and outer `cacheTag()` listed in research/10 §5.1, `global/products/brand-stores.ts`

**Design**: none.

**Intent**: Keep only `product-pricing*`, `cpoProduct:<slug>` and `geocode`. Sync tags cover everything else.

**Contract**: `grep -rn "cacheTag(\|tags: \[" apps/web/src` shows only the allowlisted tags.

#### 3. Env + docs

**File**: `turbo.json` (drop `NEXT_REVALIDATE_TOKEN` and `SANITY_WEBHOOK_SECRET`), `.env.example` files, `CODEBASE_OVERVIEW.md` ("Caching & Revalidation", env table, "not e-commerce" note), `CLAUDE.md`, `.ai/b2c/production-readiness-runbook.md`, new `context/foundation/lessons.md` entries

**Design**: none — docs.

**Intent**: Document the new fetch, invalidation and Presentation architecture and the gate commands.

**Contract**: CLAUDE.md lists `check:parity`, `check:stega-leaks`, `blueprints:deploy` and the audit summariser.

**Oliwier steps**:
- Delete the Sanity webhooks "Revalidate Next.js" and "Revalidate CPO (TEMP)".
- Revoke the Sanity token held in `NEXT_REVALIDATE_TOKEN`.
- Delete `NEXT_REVALIDATE_TOKEN` and `SANITY_WEBHOOK_SECRET` from Vercel.

### Success Criteria:

#### Automated Verification:

- No references to the old route: `grep -rn "api/revalidate[^-]" apps` is empty
- Only allowlisted hand tags remain: tag grep matches the allowlist
- Type check, lint, all tests: `bun run check-types && bun run lint && bun run test`
- Full build passes: `bun run build --force`
- Parity vs baseline clean: `bun run check:parity --compare parity/baseline` exits 0
- Published stega crawl clean: `bun run check:stega-leaks --base https://audiofast.pl --mode published` exits 0
- Webhooks list shows 2 remaining: `bunx sanity hooks list` (Embeddings, Vercel deploy)

#### Manual Verification:

- A publish of a brand, a product and the homepage each shows fresh content on audiofast.pl within seconds.
- No editor-reported stale content for one week after cut-over.

---

## Testing Strategy

### Unit Tests:

- `live.ts`:
  - `getDynamicFetchOptions` returns published when draft mode is off;
  - it returns the cookie perspective, or drafts, with stega when draft mode is on.
- `/api/revalidate-tags`: secret (constant-time), body validation, the `sanity:` prefix, the custom-tag allowlist, `'max'` profile calls.
- `denormalize-products`: the diff module (brand rename fan-out, category reorder preserves editor order, own-patch loop guard, no-op diff).
- `stega-text`: vendor alphabet, `hasText` on stega-only strings.
- `optimistic-order`: key re-prefix regression, sparse document fallback.
- Studio presentation: completeness, ordering, pagination hrefs, URL action, slug navigation.
- Crawler helpers (`scripts/lib/crawl.ts`).

### Integration Tests:

- The existing Playwright e2e suite at Phases 1, 4, 5: cart, checkout, account, coupons, CPO purchase.
- The parity crawler at Phases 3, 4, 5, 8, 9, 12.
- The stega crawler at Phases 10, 11, 12.

### Manual Testing Steps:

1. Open the deployed Studio → product → „Otwórz w podglądzie”. Type in the description; the iframe updates within 3 s. Click the hero; the right field opens.
2. Drag two PageBuilder blocks on the QA page. The order persists in the draft with no snap-back.
3. Publish a brand rename. Product listings show the new name after the Function runs, and the published page refreshes without a deploy.
4. In draft mode, a product page shows a disabled „Dodaj do koszyka” with the Polish note.

## Performance Considerations

- Prerender-all lengthens builds to ~1.4k pages and adds ~2.7–3k Sanity CDN requests plus ~866 Supabase pricing queries per deploy. Use lsse build hardening (concurrency limit, retry).
- Draft mode bypasses the cache. Every edit re-runs every fetch for the route on the live API, so keep draft routes to few queries and skip geocoding in draft mode.
- With SWR invalidation, a page's first request after a publish can serve stale content for ~2 s. That is acceptable (P2).

## Migration Notes

- **Parallel run.** Phases 6–11 run the old webhook alongside the Functions. Both channels only expire entries, which is safe. The denorm writer switches over in Phase 6.
- **Rollback.** Redeploy the old route and recreate the webhook from the filter/projection text recorded in Phase 6 prerequisites. Restore the token. Remove the Function resources from `sanity.blueprint.ts` and run `blueprints deploy`.
- **Data.** A one-time denorm backfill (13 products reordered to the editor's order) and unsetting `metaConversionToken`. Both are mutations run by Claude, with a dry run first.

## References

- Research: `context/changes/sanity-modernization/research.md` + `research/01`–`11`
- Decisions: `context/changes/sanity-modernization/decisions.md`
- Najbar: `Najbar/apps/web/src/global/sanity/live.ts`, `Najbar/apps/studio/presentation/`, `Najbar/context/archive/2026-07-28-live-content-api-adoption/`
- lsse-www: `lsse/lsse-www/apps/web/src/global/sanity/{live,client,minify-groq}.ts`, `lsse/lsse-www/apps/studio/presentation/`, `lsse/lsse-www/apps/web/scripts/check-stega-leaks.ts`, `lsse/lsse-www/context/archive/2026-09-04-presentation-walkthrough/`
- Sanity docs: Cache Components guide, sync-tag function quickstart, Presentation resolver API (links in research/07)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Security hotfix (token leak, committed secret, Meta token)

- [x] 0.1 No `NEXT_PUBLIC_SANITY_API_READ_TOKEN` in code — 5049c58
- [x] 0.2 No token-shaped literals tracked — 5049c58
- [x] 0.3 Type check passes — 5049c58
- [x] 0.4 Web unit tests pass — 5049c58
- [x] 0.5 Full build passes — 5049c58
- [x] 0.6 Local build has no token in client chunks — 5049c58
- [x] 0.7 Production chunks clean after deploy — 5049c58

### Phase 1: Dependencies — Studio, runtime, Sanity UI port

- [x] 1.1 Studio deployed on ≥6.14.1 — 347555f
- [x] 1.2 Typegen has no unexpected drift — 347555f
- [x] 1.3 Type check passes — 347555f
- [x] 1.4 Lint passes with 0 errors — 347555f
- [x] 1.5 Web unit tests pass — 347555f
- [x] 1.6 b2c-admin tests pass — 347555f
- [x] 1.7 Full build (all Sanity apps) passes — 347555f
- [x] 1.8 No duplicate Sanity UI/icons majors — 347555f
- [x] 1.9 React identical across apps — 347555f
- [ ] 1.10 e2e suite passes

### Phase 2: Published HTML parity crawler + baseline

- [x] 2.1 Crawler unit tests pass — 0a2ed58
- [x] 2.2 Baseline captured — 0a2ed58
- [x] 2.3 Self-compare is clean — 0a2ed58

### Phase 3: defineLive fetch seam, client, cache config

- [x] 3.1 Type check passes — b898fb8
- [x] 3.2 Web unit tests pass — b898fb8
- [x] 3.3 Full build passes — b898fb8
- [x] 3.4 One-request variant selected — b898fb8
- [x] 3.5 No env-switched Sanity config remains — b898fb8
- [x] 3.6 Parity vs baseline clean — b898fb8

### Phase 4: Three-layer routes, layout, prerender-all

- [x] 4.1 Type check passes — 0a44859
- [x] 4.2 Lint passes — 0a44859
- [x] 4.3 Web unit tests pass — 0a44859
- [x] 4.4 Production-mode build passes with all slugs — 0a44859
- [x] 4.5 Parity vs baseline clean — 0a44859
- [ ] 4.6 e2e suite passes
- [x] 4.7 One-request variant still selected — 0a44859

### Phase 5: Query efficiency

- [x] 5.1 Type check + typegen clean — bded37d
- [x] 5.2 Web unit tests pass — bded37d
- [x] 5.3 No bare deref-to-object projections — bded37d
- [x] 5.4 Parity vs baseline clean — bded37d
- [ ] 5.5 e2e cart/checkout suite passes

### Phase 6: Sanity Functions — denormalization + sync-tag invalidation (parallel run)

- [x] 6.1 Function unit tests pass — 8f62bae
- [x] 6.2 Route tests pass — 8f62bae
- [x] 6.3 Type check passes — 8f62bae
- [x] 6.4 Full build passes — 8f62bae
- [x] 6.5 Blueprint deployed — 8f62bae
- [x] 6.6 Function smoke test — 8f62bae
- [x] 6.7 Denorm parity on live data — 8f62bae

### Phase 7: Presentation — Studio

- [x] 7.1 Studio tests pass
- [x] 7.2 Type check passes
- [x] 7.3 Studio builds
- [x] 7.4 Completeness test covers all schema types

### Phase 8: Presentation — web draft mode, stega, overlays, B2C isolation

- [ ] 8.1 Web unit tests pass
- [ ] 8.2 Type check + lint pass
- [ ] 8.3 Full build passes
- [ ] 8.4 Published HTML has no overlays
- [ ] 8.5 Parity vs baseline still clean
- [ ] 8.6 Studio + web deployed

### Phase 9: Drag-and-drop (lsse level)

- [ ] 9.1 Optimistic-order tests pass
- [ ] 9.2 Type check + lint pass
- [ ] 9.3 Full build passes
- [ ] 9.4 Parity vs baseline clean

### Phase 10: Tier 0 gates

- [ ] 10.1 Gate tests pass
- [ ] 10.2 Studio completeness test passes
- [ ] 10.3 Published crawl clean on production
- [ ] 10.4 Draft crawl clean on an isolated local prod build
- [ ] 10.5 Dataset clean

### Phase 11: Presentation audit walkthrough (Claude in Chrome)

- [ ] 11.1 Summariser tests pass
- [ ] 11.2 Final run summary clean
- [ ] 11.3 Cleanup asserted
- [ ] 11.4 All Tier 0 gates still green

### Phase 12: Cut-over and closeout

- [ ] 12.1 No references to the old route
- [ ] 12.2 Only allowlisted hand tags remain
- [ ] 12.3 Type check, lint, all tests
- [ ] 12.4 Full build passes
- [ ] 12.5 Parity vs baseline clean
- [ ] 12.6 Published stega crawl clean
- [ ] 12.7 Webhooks list shows 2 remaining
