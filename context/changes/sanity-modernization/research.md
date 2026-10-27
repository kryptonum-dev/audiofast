---
date: 2026-10-26T10:22:54+01:00
researcher: Claude (Opus 5.5) + 7 research sub-agents
git_commit: 533d8575a337a7fd0a00328587b96bff4bdd7a2e
branch: main
repository: audiofast
topic: "Full repo update + Sanity modernization: defineLive, cheaper querying/fetching, simple Presentation tool + Presentation audit"
tags: [research, sanity, next-sanity, defineLive, live-content-api, caching, cost, presentation-tool, visual-editing, stega, dependencies]
status: complete
last_updated: 2026-10-26
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Open questions resolved by Oliwier, see decisions.md"
---

# Research: Sanity modernization (defineLive, cheaper fetching, simple Presentation tool) + full repo update

**Date**: 2026-10-26T10:22:54+01:00
**Researcher**: Claude (Opus 5.5), synthesizing 7 parallel research agents
**Git Commit**: 533d8575a337a7fd0a00328587b96bff4bdd7a2e
**Branch**: main
**Repository**: audiofast

## Research Question

Review the sibling repos `Najbar` and `lsse/lsse-www` for how they adopted (1) `defineLive` / Live Content API with better querying and fetching to cut Sanity costs and (2) a much simpler Presentation tool. Audit the whole audiofast repo against both topics. lsse-www had a Presentation-tool audit plan; the same audit has to be repeated here. Frame it all as one change: full repo update plus general CMS improvement.

## Source reports (full detail lives here)

This document is the synthesis. Every claim below is backed by one of the seven raw reports in [`research/`](research/):

| # | Report | Scope |
|---|---|---|
| 01 | [research/01-najbar-live-fetching.md](research/01-najbar-live-fetching.md) | Najbar: defineLive, three-layer pages, Sync-Tag Function, pitfalls |
| 02 | [research/02-lsse-live-fetching.md](research/02-lsse-live-fetching.md) | lsse-www: the most recent fetch layer, query minification/narrowing, measured perf |
| 03 | [research/03-presentation-reference.md](research/03-presentation-reference.md) | Presentation in lsse + Najbar, **the lsse audit/walkthrough plan in re-runnable detail**, stega leak findings |
| 04 | [research/04-audiofast-fetch-layer.md](research/04-audiofast-fetch-layer.md) | audiofast: client/wrappers, ~75 call sites table, cache model, query efficiency, ranked cost hotspots, defineLive migration surface |
| 05 | [research/05-audiofast-presentation.md](research/05-audiofast-presentation.md) | audiofast: current preview state (none), document → route map, stega risk surfaces |
| 06 | [research/06-audiofast-dependency-upgrade.md](research/06-audiofast-dependency-upgrade.md) | audiofast: version table, breaking changes with file:line, upgrade batches |
| 07 | [research/07-sanity-docs-live-presentation.md](research/07-sanity-docs-live-presentation.md) | Current Sanity/next-sanity docs: defineLive API, Cache Components pattern, billing, minimal Presentation setup, breaking changes |

## Summary

1. **Two things need action before any modernization.**
   - **Leaked token, confirmed in production.** `NEXT_PUBLIC_SANITY_API_READ_TOKEN` ships in public JavaScript. On 2026-10-26 one of the 17 chunks on the `audiofast.pl` homepage (`_next/static/immutable/chunks/2wtfq4e0d1p0a.js`) contained the `SANITY_API_READ_TOKEN` marker and one `sk…` token literal; the value was not recorded.
     - Cause: `apps/web/src/global/sanity/client.ts:30-33` reads the token at module scope. `components/shared/Image.tsx:4` imports `urlFor` from that module, and Image is used by 16+ `'use client'` components.
     - Effect: anyone can run uncached live-API queries, including against drafts, billed to the project.
     - Fix: rotate the token, then split `urlFor` into a client-safe module and make the read token server-only (04 §2.1, §7.4; 05 §3).
   - **Data-loss bug in the Studio.** The Studio runs `sanity@6.10.1`. Sanity deprecated 6.9.2–6.14.0 for a Portable Text data-loss bug, fixed in 6.14.1. Upgrade to 6.20.0 as its own release, first (06 §1, 07 header).
2. **audiofast has no Presentation tool today.** The starter template's Presentation/draft/live/stega stack was deleted wholesale in `a73f098` (2025-09-21). The "simpler Presentation tool" is therefore a **greenfield build**, not a simplification. The only "preview" is local `next dev`, whose client reads `perspective: 'drafts'` (05 §1–2).
3. **The real work is in the fetch layer, not the Studio config.**
   - `apps/web` is fully on Cache Components: `cacheComponents: true`, 14 `'use cache'` scopes, ~60 `sanityFetch` call sites, including Header, Footer and listing blocks.
   - Draft preview and defineLive both need `perspective`/`stega` threaded from outside each cache boundary, using the three-layer pattern both siblings use (orchestrator → dynamic → cached).
   - Do both goals in one design pass, not two (05 §8, 01 §2.3, 07 §1.4).
4. **The current cost story** (04 §1, §6):
   - **`use cache` is not a durable cache on Vercel serverless.** It is in-memory per instance and reset on every deploy. Every request-time render therefore costs at least one API CDN request. That covers listings keyed on searchParams, first hits on ~865 non-prerendered products after each deploy, bot renders, and server actions. This matches the earlier "620k CDN req/month" note (`.ai/rendering-revalidation-research-2026-08.md:471`).
   - **Concrete hotspots:**
     - `/api/analytics/meta` reads settings uncached on every Meta CAPI event; a one-line fix.
     - Webhook fan-out costs two uncached **live-API** reverse lookups per product mutation, multiplied by price sync and the denormalized-field (denorm) cascade.
     - The ~190 KB `queryAllProductsFilterMetadata` is refetched by ~85 shells per product-publish wave.
     - Every CPO checkout event runs a blocking `revalidateTag('cpoProduct', {expire:0})`.
     - `/porownaj` makes an uncached heavy fetch on every visit.
     - Preview deployments read the live API with `cacheLife('minutes')`.
   - **Stale tags.** Several broad tags are never revalidated by the webhook: `product`, `blog-article`, `review`, `page`, `mailchimp-settings`. The sitemap, archive pages, PDFs, comparison box and BlogListing can stay stale for 30 days (04 §3.5).
5. **defineLive mechanics, verified in installed source** (`node_modules/next-sanity@13.3.3`):
   - `next-sanity/live` has three export conditions. The `react-server` build makes **two** requests per `sanityFetch`: a sync-tag lookup, then the data fetch. The `next-js` build makes **one** request and calls `cacheTag`/`cacheLife` itself.
   - Next's webpack config adds the `next-js` condition only when `cacheComponents` is on (`node_modules/next/dist/build/webpack-config.js:1126`). Turbopack's equivalent is in native code and not verifiable from JS.
   - So with `cacheComponents: true`, expect one request per fetch. **Confirm this in Sanity request logs** (default tags `next-loader.fetch*`) on the first preview deploy.
   - Report 04 §7.1 read only the `react-server` file. Its "1–2 requests" caution applies only if the `next-js` condition is not selected.
6. **Where the cost savings come from:**
   - Precise sync-tag invalidation via a Sanity **Sync Tag Invalidate Function** posting to `/api/revalidate-tags`. It replaces the hand-maintained `TYPE_DEPENDENCY_MAP`, the per-document live-API lookups in the 1007-line webhook, and the stale-tag drift.
   - Long `cacheLife` (`sanity` profile, 365 d).
   - Narrower queries; deduplicated SEO round trips; a merged CPO list and count.
   - `requestTagPrefix` + per-call `requestTag`, so usage can be attributed.
   - Removing the env-dependent client switch.

   `<SanityLive>` mounts **only in draft mode** in both siblings; public-visitor Live is rejected permanently (Sanity's Next 16 advisory: 4× average, 7–10× worst-case request growth) (01, 02, 07 §2).
7. **Denorm writes are not cache logic.** `updateProductsForBrand`/`Category` live inside `/api/revalidate` (`route.ts:855-1007`). They must move before the webhook is retired, to a Sanity Function, the Studio publish wrapper, or a slimmed webhook. Otherwise listings freeze after brand or category edits. Because audiofast is **live**, the old and new invalidation must run **in parallel** during cut-over; Najbar was pre-launch and could cut straight over (01 §5.15, 04 §7.2, §8).
8. **Simple Presentation target** (03 §6): Najbar's skeleton, not lsse's.
   - About 470 lines of Studio code: hand-written `HREF_EXPRESSIONS`, `locations`, `mainDocuments`, plus one completeness test.
   - The one-line `defineEnableDraftMode` route; draft-only `<VisualEditing>` + `<SanityLive includeDrafts>` + PreviewBar.
   - Analytics and consent suppressed in draft mode.
   - Stega off on the base client and on only per draft request, with a **short** leaf-name filter.
   - **Block-level** `data-sanity` in PageBuilder only.
   - One stega-leak crawler gate.
   - Skip nested-array drag-and-drop, optimistic reorder, and lsse's navigation, pagination and tool-menu machinery.
9. **The lsse audit is reusable almost verbatim** (03 §3): Tier 0 deterministic gates, led by the published + draft stega crawler; an immutable run-folder contract; a 65-row scenario catalogue in suites P/A–J, trimmed to about 40 rows for audiofast; a results summariser; and a GROQ-asserted cleanup. Add one audiofast-only **B2C isolation** suite: cart, checkout and account in draft mode (03 §3.6).
10. **Full repo update** (06): real majors are `@sanity/client` 7→8, `@sanity/ui` 3→4, `@sanity/icons` 3→5, `@sanity/sdk-react` 2→3 and `@portabletext/react` 7→8. Next 16.4.3, React 19.3.1 and next-sanity 13.4.0 are minor bumps. TypeScript 7, ESLint 10, `@sanity/eslint-config-studio` 7 and `@types/node` 26 are on **hold**, blocked upstream (same verdict as lsse and Najbar). Order:
    1. Studio fix.
    2. React + web runtime, the base for defineLive.
    3. UI 4 / icons 5 / SDK 3 port.
    4. Tooling minors.
    5. Optional majors.
    6. Cleanup.

## Detailed Findings

### A. Security prerequisites (block a safe preview design)

- **Token in browser bundle.** `apps/web/src/global/sanity/client.ts:30-33` reads `NEXT_PUBLIC_SANITY_API_READ_TOKEN` at module scope, and `assertValue` throws if it is unset, so it is set everywhere. `components/shared/Image.tsx:4` and `components/pageBuilder/HeroCarousel/HeroCarousel.tsx:10` (`'use client'`) import `urlFor` from that module. The leak was confirmed in a local build chunk (04 §1, 05 Summary) and **in production** (this session, see Summary 1).
  - Fix: move `imageBuilder`/`urlFor` into a token-free `image.ts`; make `client.ts` `server-only`, reading `SANITY_API_READ_TOKEN`, which already exists server-only for blog search (`turbo.json:5`, `global/sanity/blog-search-config.ts`).
  - Also fix `scripts/generate-redirects.ts:13-20` and the legacy blog-embeddings fallback (`blog-search.ts:70-82`), which still read the `NEXT_PUBLIC_` var.
  - Rotate the token in Sanity and Vercel.
- **A secret in a publicly readable dataset.** `settings.analytics.metaConversionToken` is readable by the tokenless production client (04 §8). Move it to an env var.
- **The webhook bearer doubles as a Sanity write token.** `NEXT_REVALIDATE_TOKEN` is both the webhook bearer and the write token for denorm patches (`app/api/revalidate/route.ts:35-52`), so one secret has two jobs. Revisit when the webhook is slimmed.

### B. Current audiofast fetch layer (04)

- **One shared client**, `apps/web/src/global/sanity/client.ts:48-55`:
  - `useCdn: IS_PRODUCTION_DEPLOYMENT`;
  - `perspective: VERCEL_ENV ? 'published' : 'drafts'`;
  - a token only off production;
  - no `requestTagPrefix`.
- **Three wrappers** in `apps/web/src/global/sanity/fetch.ts`:
  - `sanityFetch` (`:65-92`): `'use cache'` + `cacheTag` + `cacheLife('weeks')` (= 30 d via `next.config.ts:20-46`), `cacheMode: 'noStale'`, 3× retry.
  - `sanityFetchDynamic` (`:101-111`).
  - `sanityFetchFresh` (`:117-127`): live API with a token, for cart and checkout.
- **~75 call sites.** ~60 use `sanityFetch`. ~15 bypass the wrappers: the revalidate webhook, blog search, CPO availability, admin/operator auth, the redirects script, `/api/analytics/meta` and newsletter routes. The full table is in 04 §4.
- **There is no browser-side Sanity query traffic.** Client components reach Sanity only via server actions and routes. The client bundle uses the Sanity client only for `urlFor`, which is also how the token leaks.
- **Static params.** `global/build.ts` `limitBuildTimeStaticParams` slices to one item per type in production and preview. Only the ~41 brands are fully prerendered. Every other URL renders on first request **after each deploy**, because the cache key includes the build ID (04 §3.3).
- **Webhook**, `apps/web/src/app/api/revalidate/route.ts` (1007 lines):
  - `TYPE_DEPENDENCY_MAP` (`:378-462`);
  - reverse lookups on the live API (`:123-360`);
  - `{expire:0}` for the edited document's own tags and `'max'` for collateral tags;
  - denorm writes (`:663-669`, `:855-1007`), including a category-edit N+1. The denorm promise is **not awaited** (`:734-738`), so it can be cut off on Vercel.

### C. Cost hotspots, ranked (04 §6)

1. Request-time `sanityFetch` without a durable cache: listings, post-deploy first hits, bots, actions and routes. Levers:
   - `'use cache: remote'` for request-time listings and actions;
   - canonicalizing searchParams;
   - prerendering more slugs;
   - durable fetch-cache semantics.
2. `/api/analytics/meta` (`route.ts:131-145`) reads Sanity uncached per tracking event.
3. Webhook fan-out on bulk mutations (Excel price sync, CPO sync, denorm cascade): two live-API lookups per product.
4. The `filter-metadata` regeneration storm: ~85 shells × ~190 KB per publish wave.
5. The CPO checkout `revalidateTag('cpoProduct', {expire:0})` (`global/b2c/checkout/server/cpo-availability.ts`).
6. `/porownaj` (`app/actions/comparison.ts:67`) is uncached and heavy, and is exported as a public server action.
7. Preview deployments use `useCdn: false` + token + `cacheLife('minutes')` (`fetch.ts:82-84`).
8. Blog search makes one or two live-API requests per search; this is by design.
9. Catch-all and junk-slug probes cost 3–5 CDN requests per unique slug.
10. PDF proxy routes have no `s-maxage`/`CDN-Cache-Control` (verify).
11. Every deploy re-runs redirects on the live API and resets all `use cache` keys.
12. Images use natural-resolution sources behind the Vercel optimizer, and LQIP is projected everywhere.

### D. Query efficiency (04 §5)

- **`queryAllProductsFilterMetadata`** (`query.ts:1776-1830`): the whole catalogue, full brand-logo image fragments with LQIP, a `brand->doNotShowBrand` deref per product, and two extra min/max scans. Fixes: a lite logo fragment, a denormalized hide flag, computing min/max in JS, brand-scoped subsets.
- **`pageBuilderFragment`** (`:940-970`) is embedded in 6+ queries. It spreads `...` and has heavy branches (`productsListingBlock` per-subcategory `count(*[...])` with deref, `brandsByCategoriesSectionBlock`, `featuredPublicationsBlock`).
- **Duplicate SEO queries** add one request per cold page: `query{Product,Page,BlogPost,Review,CpoProduct}SeoBySlug`. The brand page already reuses its content fetch.
- **CPO listing** makes two requests that could be one (`CpoProductsListingInner.tsx:65-76`). `queryCpoProductsFilterMetadata` does four scans.
- **Dead queries** (`queryProductsPageData` with the old 5–6 s fragment, `queryBlogPageData`, `queryCategoryMetadata`, aliases): delete them.
- **N+1 patterns:** cart revalidation (`global/b2c/cart/server/revalidation.ts:84-107,145-160`), the webhook category cascade, `releaseExpiredCpoHoldBySlug`.
- **Lessons from lsse** (02 §2.4–2.5):
  - GROQ minification (582 → 444 kB).
  - Narrowing the block union per page (homepage query 444 → 93 kB; response 627 → 208 kB). This crossed under the CDN's ~300 KB body cap, and reads dropped from about 370 ms to about 125 ms.
  - Caveat: narrowing adds a second request per render. audiofast's homepage query is ~101 kB, already under the cap, so measure before adopting.
  - Also watch the ~11k-char GET limit: POST falls back to the **live API**, not the CDN (04 §8 Search).

### E. Target fetch architecture (01, 02, 07 §1.4)

Both siblings converge on the official Sanity "Cache Components" pattern:

- **`next.config.ts`:** `cacheComponents: true` (already on) and `cacheLife: { sanity }` from `next-sanity/live/cache-life` (365 d). audiofast currently overrides `default`, `hours`, `days`, `weeks` and `max` all to 30 d, so `'hours'` does not mean hours. Fold those profiles into the `sanity` profile.
- **`live.ts`:**
  - `defineLive({ client, serverToken, browserToken /* Viewer */, strict: true })`. Without `strict`, draft mode silently renders published under `cacheComponents`. Without a Viewer `browserToken`, `includeDrafts` silently turns off (01 §5.1–5.2).
  - `getDynamicFetchOptions()`: draft cookie → `{perspective, stega}`.
  - `sanityFetchMetadata` / `sanityFetchStaticParams`, each with its own `'use cache'`, pinned to `perspective: 'published', stega: false`.
- **Pages:** the three-layer dispatcher. The uncached page reads `draftMode()`. The published path renders `<Cached… perspective="published" stega={false}/>`. The draft path renders `<Suspense><Dynamic…/></Suspense>`, which awaits options and then the same cached component.
  - Never wrap `children` in `'use cache'` (Najbar's dev cold-load hang, 01 §5.9).
  - Root layout has no `'use cache'`; `app/layout.tsx:28` currently has one and must change.
- **Migration seam:**
  - Swapping the inside of the existing `sanityFetch` in `fetch.ts` covers ~60 call sites with no other edits. That handles the published path only.
  - Draft support needs per-route dispatchers, including for independently fetching chrome and listing components (Header, Footer, ProductsListing, CpoProductsListing). Otherwise draft pages mix draft bodies with a published layout (05 §8).
- **Stays outside defineLive** (04 §7.3):
  - `sanityFetchFresh` and the CPO write client (checkout correctness);
  - blog search (no-store by design);
  - operator/admin auth clients;
  - build scripts;
  - newsletter generation;
  - `/podglad/*` email previews.
  - Order-email and legal-document reads at payment-webhook time must not throw outside a cache scope.
- **One client source.** next-sanity keeps `@sanity/client` v7 as its own dependency, but audiofast imports `@sanity/client` directly in 9+ files. Pick one source before wiring `defineLive({client})` to avoid a v7/v8 `SanityClient` type mismatch (06 §5).

### F. Invalidation target (01 §2.5, 02 §2.6, 07 §2.2)

- **Sanity Function:** `defineSyncTagInvalidateFunction` in a root `sanity.blueprint.ts`, scoped to `<projectId>.<dataset>`. It POSTs sync tags to `/api/revalidate-tags/`; the trailing slash is required, because the site 308s slashless paths. The route then runs `revalidateTag('sanity:'+tag, 'max')`.
- **One function per dataset.** `done(syncTags)` must succeed for `waitFor="function"`.
- **Function quirks** (01 §5.14):
  - The blueprint goes at the repo root.
  - Each function needs its own `package.json`.
  - Env is set with `sanity functions env add`.
  - `sanity functions test` sends no payload.
- **Parallel run.** `defineLive` accepts custom `tags` alongside sync tags, and both channels only expire entries. Keep the webhook's tags during cut-over, then retire the type map and reverse lookups.
- **Denorm logic** keeps living somewhere explicit (see Summary 7). The Studio already has `apps/studio/actions/wrap-publish-with-denorm.ts` (155 lines) for single-document publishes. Bulk sync paths, such as Excel price sync, CPO sync and brand/category cascades, still need a server-side home.
- **CPO availability** needs a sync-tag-compatible custom tag, or keeps its own `revalidateTag` alongside.

### G. Presentation: current state and document → route map (05)

- **Studio** `apps/studio/sanity.config.ts:28-36` loads only `assist`, `structureTool`, `visionTool` and `media`. `structure.ts:102` forces singletons to the form view only.
- **Leftovers:**
  - dead `SANITY_STUDIO_PRESENTATION_URL` and `SANITY_STUDIO_NEWSLETTER_API_URL` in `apps/studio/.env.example`;
  - the unused `studioUrl` export in `client.ts:42-46`;
  - a buggy copy-URL line under slug fields (`components/slug-field-component.tsx:177`, `utils/constant.ts:58-60`). It produces a double slash, a missing `/produkty` prefix for `productCategorySub`, and nothing usable for PDF or external reviews.
- **18 routable types, 11 referenced-only, 22 page-builder blocks.** Full table in 05 §4.
- **Slugs are stored as full pathnames** (`/produkty/x/`) with `trailingSlash: true`. Exception: `productCategorySub` is stored as `/kategoria/x/` but served at `/produkty/kategoria/x/`.
- **The revalidate webhook's `TYPE_DEPENDENCY_MAP` is a ready source for secondary `locations`** ("used on").
- **Preview-specific risks:**
  - Listings rely on `denorm*` fields that only recompute on publish, so draft listings will be wrong. Accept this and document it as expected behaviour.
  - Cookie banner, GTM and Meta fire inside the iframe unless suppressed in draft mode.
  - B2C pages (`/koszyk`, `/konto-klienta`, `/podziekowania-za-zakup`) must not be preview targets.
  - Vercel Deployment Protection may block iframing previews.
  - Origins need wiring: the Studio at `audiofast.sanity.studio` and `localhost:3333`; the web at `audiofast.pl` (prod 308s `www` → apex), the dev deployment and `localhost:3000`.
- **Stega risk surfaces once it is enabled** (05 §3):
  - metadata (`global/seo.ts`);
  - 8 JSON-LD components;
  - CMS-driven `id` attributes (11 files);
  - ~35 `=== '…'` comparisons on CMS option values;
  - filter URL params (`CustomFiltersBar`, `ProductsListing`, `CpoProductsListingInner`);
  - comparator and search string matching;
  - anything flowing into cart/checkout/Supabase.

### H. Simple Presentation target (03 §6)

**Keep (copy from Najbar, with lsse's fixes):**

- Studio:
  - `presentationTool({ title: 'Podgląd', previewUrl: { initial: getPresentationUrl, previewMode: { enable: '/api/draft-mode/enable' } }, allowOrigins, resolve: { locations, mainDocuments } })`;
  - lazy `getPresentationUrl()`;
  - add `SANITY_STUDIO_PRESENTATION_URL` to `turbo.json` `globalEnv`.
- `apps/studio/presentation/{routes,locations}.ts` at Najbar size, with a hand-ordered `defineDocuments` list.
  - Put specific segments first, e.g. `/produkty/kategoria/:slug` before `/produkty/:slug`, and the `/:slug` catch-all last.
  - Since Studio 6.10 routes use URLPattern: optional groups need `?` (07 §3).
  - Add one completeness test: every type ∈ routed ∪ static ∪ referenced.
- Optional "Otwórz w podglądzie" action, using `navigateIntent('edit', {..., mode: 'presentation', preview})` (the lsse fix). Replace the buggy slug-field URL line with the same shared URL resolver.
- Web:
  - the one-line `defineEnableDraftMode` route;
  - a `disableDraftMode` server action + a `PreviewBar` (dynamic import, hidden inside Presentation);
  - root layout `{isDraft && <PreviewBar/><VisualEditing basePath="" trailingSlash/><SanityLive includeDrafts/>}`;
  - `CookieConsent`/`Analytics` only when `!isDraft`.
- Stega:
  - base client `stega: { enabled: false, studioUrl, filter }` with ~10 leaf names;
  - a `stega-text.ts` with the **vendor alphabet** (U+200B/C/D, U+FEFF, U+2060–2063, U+1D173–1D17A). lsse's regex stripped the wrong block for weeks;
  - `stegaClean` where a CMS string reaches an attribute, a comparison, a URL param or a server action.
- Overlays: `getDataAttribute()` + block-level wrappers in `components/pageBuilder` only.
- Gate: port `check-stega-leaks.ts`, or start with a published `curl | grep -c data-sanity` + zero-width regex over the sitemap, plus a draft pass via the share-access secret.

**Skip:**
- nested-array drag-and-drop;
- `useOptimistic` reorder;
- lsse's contextual tool menu, preview-target resolver, slug-follow, paginated parent locations, generated `mainDocuments`;
- the orderable-list drag in Presentation (`@sanity/orderable-document-list` writes **published** `orderRank`; audiofast uses it in 9 collections).

### I. Presentation audit, adapted from lsse (03 §3)

- **Artifacts:** research → `decisions.md` → `plan.md` → `walkthrough-brief.md` → `test-plan.md` → `walkthrough/{README,loop,results.template}.md` → immutable `run-<n>/`. The plan has 7 phases:
  1. Known-defect fixes.
  2. Tier 0 gates.
  3. Fixture seed.
  4. Walkthrough handoff.
  5. Localhost run.
  6. Deploy + Safari run.
  7. Closeout.
- **Tier 0 gates:**
  - **0.1:** the stega crawler.
    - Published mode: zero markers and zero `data-sanity`.
    - Draft mode: markers only in visible text.
    - Cross-mode: a bag-of-words diff.
    - It also catches `ssr-error`.
  - **0.7:** the resolver completeness test.
  - **0.8:** a stega-branded types probe.
  - **0.9:** a dataset contamination scan.
  - Optional: enum coverage, emptiness predicates, deref-key lint, per-block data-attribute coverage.
- **Lanes:** [L] localhost (fast fixes) → [D] deployed Studio + production web → [S] Safari (CHIPS cookie) → [H] human-owned steps.
- **Fixtures:**
  - One seeded QA `page` (`doNotIndex`, published), with ≥2 items in every array and every optional field filled. 7 of lsse's 9 BLOCKED rows were missing fixtures.
  - One real document per family, frozen by `_id` + `_rev`; a pre-existing draft is a hard stop.
  - Draft-only writes; `ifRevisionID` reverts; cleanup asserted by GROQ.
- **Catalogue for audiofast, about 40 rows:**
  - P1–2;
  - A1–A7;
  - B1/B3/B4/B6/B7;
  - C1 + C9, plus C8 as a doc-only list of deliberately undraggable arrays;
  - D5–D10, adapted;
  - E1/E3/E4/E6–E9 (record E9 rather than fixing it);
  - F, one row per custom input that emits patches;
  - G1–G3;
  - H1/H2/H4 (+H5);
  - I1–I4;
  - a new **B2C isolation** suite: prices still from Supabase, no stega in cart/checkout attributes or `<input value>`, server-action payloads `stegaClean`ed.
- **Run contract:**
  - One browser owner.
  - PASS only with a pasted DOM/GROQ/cookie artifact; INCONCLUSIVE counts as BLOCKED.
  - Phases of 5–8 rows.
  - Port `summarize-results.ts` with its fixtures.
  - Stop after 5 iterations.

### J. Full repo update (06)

| Batch | Contents | Why / gate |
|---|---|---|
| 1 | **Studio fix:**<br>- `sanity` + `@sanity/vision` 6.20.0, root `@sanity/cli` ^8.23.0<br>- assist 6.2.5, media 6.5.0<br>- orderable-document-list 2.0.28 (lift the 2.0.20 pin)<br>- styled-components 6.6.0<br>- declare `@sanity/client` in studio | Portable Text data loss. Ship alone. Can stay on our UI 3 copy. `sanity deploy` + PT smoke test |
| 2 | **Web runtime:**<br>- React 19.3.1 + types **identical in all 4 apps** (one commit)<br>- next 16.4.3, next-sanity 13.4.0 (needs client ^7.28)<br>- `@sanity/client` 8.11.0 (pick a single source)<br>- `@portabletext/react` 8.0.1 (list nesting changes; check migrated WordPress articles)<br>- Supabase / zod / sass / lucide / RHF minors | The base for defineLive. Next 16.4 shortens CSS-module class names in production, so check e2e selectors |
| 3 | **UI 4 / icons 5 / SDK 3 port** across studio, b2c-admin and cms-activity:<br>- 228 `space=`→`gap=`<br>- 28 Grid prop changes<br>- 13 subpath moves<br>- 61 icon imports<br>- `@sanity/ui/styles.css` in both App SDK apps + the bulk-actions-table plugin<br>- `usePeople.ts:26` `.data` | Needs a visual pass of the b2c-admin operator UI. Gate: no `@sanity/ui@3` in `bun.lock` |
| 4 | Tooling minors: turbo, prettier (isolated, it reformats), typescript-eslint, vite, vitest 4.x, Playwright, `@types/node` 24.19.2 | — |
| 5 | Optional majors: TypeScript 6.0.3; vitest 5 / jsdom 30 / msw 3 | Separate changes |
| 6 | Cleanup:<br>- drop `next-themes` and `@vercel/edge-config` (0 imports)<br>- write held upgrades into CLAUDE.md<br>- fix stale CLAUDE.md lines ("Sanity v5 Studio", "8 GB heap") | — |

**Process rules (Najbar/lsse):**
- Set explicit versions and run `bun install`; never `bun update`.
- One commit per batch.
- Gate every batch on typegen (no drift), `check-types`, `lint` (0 errors, watch the warning direction), tests, and a full `bun run build --force`, which is the only check that builds all three Sanity apps.
- Stop dev servers during installs.

**Hold** (upstream blockers, recorded in CLAUDE.md): TypeScript 7, ESLint 10, `@sanity/eslint-config-studio` 7, `@types/node` 26.

## Code References

- `apps/web/src/global/sanity/client.ts:30-33` — `NEXT_PUBLIC_SANITY_API_READ_TOKEN` read at module scope (leak source)
- `apps/web/src/global/sanity/client.ts:42-46` — unused `studioUrl` export
- `apps/web/src/global/sanity/client.ts:48-55` — env-dependent `useCdn`/`perspective`/token switch (to be removed)
- `apps/web/src/components/shared/Image.tsx:4` — imports `urlFor` from `client.ts` and is used by `'use client'` components
- `apps/web/src/global/sanity/fetch.ts:65-92` — `sanityFetch` (`'use cache'` + tags + 30 d) — migration seam
- `apps/web/src/global/sanity/fetch.ts:101-127` — `sanityFetchDynamic`, `sanityFetchFresh`
- `apps/web/next.config.ts:6,13,20-46` — `cacheComponents`, `partialPrefetching`, cacheLife overrides (all 30 d)
- `apps/web/src/app/layout.tsx:28` — root layout `'use cache'` (must go for draft mode)
- `apps/web/src/app/api/revalidate/route.ts:378-462` — `TYPE_DEPENDENCY_MAP`; `:123-360` live-API reverse lookups; `:855-1007` denorm writes; `:734-738` un-awaited denorm promise
- `apps/web/src/app/api/analytics/meta/route.ts:131-145` — uncached Sanity read per Meta CAPI event
- `apps/web/src/global/b2c/checkout/server/cpo-availability.ts` — `revalidateTag('cpoProduct', {expire:0})` per CPO event
- `apps/web/src/app/actions/comparison.ts:39,67` — comparison actions (`/porownaj` uncached)
- `apps/web/src/global/sanity/query.ts:1776-1830` — `queryAllProductsFilterMetadata` (~190 KB)
- `apps/web/src/global/sanity/query.ts:940-970` — `pageBuilderFragment`
- `apps/web/src/global/build.ts` — `limitBuildTimeStaticParams` (1 per type)
- `apps/studio/sanity.config.ts:28-36` — plugins (no `presentationTool`)
- `apps/studio/structure.ts:102,720-767` — singleton form-only views; `defaultDocumentNode`
- `apps/studio/components/slug-field-component.tsx:177` + `apps/studio/utils/constant.ts:58-60` — buggy site-URL line
- `apps/studio/actions/wrap-publish-with-denorm.ts` — Studio-side denorm on publish
- `node_modules/next-sanity/dist/live/conditions/react-server/index.js:22-65` — two-fetch `sanityFetch` (non-cacheComponents path)
- `node_modules/next-sanity/dist/live/conditions/next-js/index.js:31-52` — one-fetch `sanityFetch` with `cacheTag`/`cacheLife(sanity)`
- `node_modules/next/dist/build/webpack-config.js:1126` — `next-js` export condition added only when `cacheComponents` is on
- `turbo.json:5,52-53` — `SANITY_API_READ_TOKEN`, `NEXT_PUBLIC_SANITY_API_READ_TOKEN`, `NEXT_PUBLIC_SANITY_STUDIO_URL`

Reference implementations:
- `Najbar/apps/web/src/global/sanity/live.ts`, `client.ts`, `data-attribute.ts`; `Najbar/apps/web/src/app/(site)/page.tsx:16-70` (three layers); `Najbar/apps/studio/presentation/{routes,locations}.ts`; `Najbar/apps/studio/plugins/presentation-url.ts`
- `lsse/lsse-www/apps/web/src/global/sanity/live.ts`, `minify-groq.ts`; `lsse/lsse-www/apps/web/scripts/check-stega-leaks.ts`; `lsse/lsse-www/scripts/walkthrough/summarize-results.ts`; `lsse/lsse-www/scripts/presentation-gates/`

## Architecture Insights

- **Prerequisites first.** Two hard prerequisites and one ordering rule:
  - The token and Studio data-loss fixes are urgent and independent of each other.
  - Dependency batch 2 is the base, so defineLive is written against next-sanity 13.4 and a single client source.
  - The fetch-layer rewrite and Presentation share the same plumbing (`strict` defineLive, `getDynamicFetchOptions`, three-layer pages). Building Presentation first would mean threading perspective twice.
- **Draft rendering bypasses `'use cache'`.** Next never persists draft-mode entries, so the cache-poisoning risk is low *if* every Sanity read goes through `defineLive` with an explicit perspective. The real draft risk is *partial threading*: one component still on the old wrapper renders published content inside a draft page. The cross-mode crawler diff catches this.
- **Cost is driven by cache durability, not request count per fetch.** On Vercel, a request-time `use cache` entry is effectively per instance. The lever is fewer request-time renders and durable entries (prerender, `use cache: remote`, long cacheLife plus precise invalidation), not micro-optimizing individual queries.
- **Measure first.** Neither sibling measured Sanity request counts; their "cost" numbers are latency and bytes. audiofast should take a usage baseline: the Usage tab plus a 7-day request-log export, and `requestTagPrefix` shipped first so later logs are attributable.
- **Denormalization and invalidation are separate concerns.** In audiofast they are fused in one route; they need separating before Live invalidation can take over.

## Historical Context (from prior changes and docs)

- `.ai/rendering-revalidation-research-2026-08.md`: an earlier deep dossier on exactly this topic.
  - Its Phase 0–1 shipped (`a84fe15`, `e79d9e4`): a narrow `filter-metadata` tag, `'max'` SWR for collateral tags, `partialPrefetching`, all brands prerendered.
  - Phase 2 (defineLive) and Phase 3 (retire the webhook) were never done. This change picks them up.
  - Source of the "620k CDN req/month" figure (`:471`).
- `.ai/isr-cost-reduction-strategy-v2.md`: proposes a webhook `delta::` filter so denorm-only patches don't re-fire webhooks. Its status in the Sanity dashboard is unknown (04 Open Q1).
- `.ai/dependency-upgrade-plan.md`: dropped the `@sanity/visual-editing` dependency, since next-sanity 13 re-exports it "for when milestone 2 needs it".
- `.ai/caching-revalidation-plan.md`: the current webhook design.
- Commit `a73f098` (2025-09-21) removed the template's Presentation, draft and live stack. `981bc2c` moved to Sanity v6 (6.10.1) and pinned orderable-document-list 2.0.20.
- `context/changes/sanity-dataset-embeddings-migration/`: blog search on dataset embeddings (live API, no-store by design). Legacy embeddings retirement was due 2026-09-27; its status is unknown.
- Najbar `context/archive/2026-07-23-m13-5-revalidation-visual-editing`, `2026-07-27-presentation-dnd-sorting`, `2026-07-28-live-content-api-adoption`, `2026-07-31-next-dev-cached-shell-hang`, `2026-07-27-dependency-updates`.
- lsse-www `context/archive/2026-08-30-sanity-reference-architecture`, `2026-08-30-perf-static-path`, `2026-08-30-perf-bytes-tier2`, `2026-09-04-presentation-walkthrough` (the audit), `2026-09-04-orderable-lists` (UI 4 port worked example), `2026-10-14-studio-workshop-fixes-2026-10`.

## Related Research

- `context/changes/sanity-dataset-embeddings-migration/research.md`: blog search backend (stays outside defineLive)
- `context/changes/comparison-multi-category-bug/research.md`: comparison flow (touches `queryComparisonPageData`)
- `context/changes/youtube-publications/research.md`: publication blocks / newsletter preview
- `Najbar/context/archive/2026-07-28-live-content-api-adoption/research.md`
- `lsse/lsse-www/context/archive/2026-09-04-presentation-walkthrough/research.md`

## Open Questions

> **Resolved 2026-10-26.** Oliwier answered all 14 questions. See [decisions.md](decisions.md) (D1–D10), which overrides the recommendations below where they differ. Most notably: Presentation is complete at lsse-www level, not the "simple target" in §H; every dependency is updated in this change; preview deployments are dropped; there is no `use cache: remote`.

1. **Token rotation.** The leaked read token is confirmed in a production chunk. Ship the code fix (split `urlFor`, server-only token) as an immediate hotfix ahead of this change, and rotate the token in Sanity and Vercel. Who rotates, and does the token have Viewer or broader rights?
2. **Studio 6.20 hotfix.** Ship batch 1 now, outside this change? Have editors reported lost Portable Text edits since 2026-08-22?
3. **Change shape.** Keep one change with phases (deps batch 2 → fetch layer + invalidation → Presentation → audit), or split the UI 4 port, the test-stack majors and TypeScript 6 into separate changes?
4. **What "simple Presentation" means:**
   - (a) an "Otwórz na stronie" link only;
   - (b) locations panel on published content;
   - (c) real draft preview without overlays;
   - (d) draft preview + stega + block-level overlays (the Najbar skeleton).
5. **Document types in Presentation v1.** Which ones? Listings and categories show published `denorm*` data in draft mode.
6. **Preview origin.** Production `audiofast.pl` (single domain, cookie-scoped draft, as in Najbar) or the dev branch deployment? Is Vercel Deployment Protection on?
7. **Denorm writes after the webhook.** Where do they go: a Sanity Function, the Studio publish wrapper plus a slim webhook for bulk syncs, or keep the webhook for denorm only?
8. **Usage baseline.** Can we get the Sanity Usage numbers and a 7-day request-log export for project `fsw3likv`? What is the current webhook config and filter in manage.sanity.io?
9. **`use cache: remote`.** Adopt Vercel Runtime Cache for request-time listing and action fetches, or decide after the baseline?
10. **Preview deployments.** Accept that preview deploys and localhost stop showing drafts by default (published + CDN; drafts only via draft mode)?
11. **Audit executor and rig.** Claude in Chrome / the built-in browser on [L], with Safari done by hand? Also: enable `shareAccess: true`; draft-only SanityLive in v1 (yes); optimistic reorder (no).
12. **Secrets in the dataset.** Move `metaConversionToken` out of the publicly readable dataset into an env var, in scope here?
13. **Optional majors.** TypeScript 6.0.3 and vitest 5 / jsdom 30 / msw 3: in this change or later?
14. **Turbopack export condition.** Verify on the first preview deploy, via request logs, that `sanityFetch` makes one request per fetch.
