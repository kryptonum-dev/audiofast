# 04 — Audiofast Sanity fetch layer audit (pre-`defineLive`)

Audited 2026-10-26 on `main` @ `533d857`. Read-only. Scope: `apps/web` (Next 16.3.2, next-sanity 13.3.3, @sanity/client 7.26). Paths are repo-relative.

> **Read first:** `.ai/rendering-revalidation-research-2026-08.md` is a prior, deeper dossier on
> `defineLive` + Sanity Functions for this exact repo (siblings Najbar / kryptonum-starter, next-sanity
> internals, Sanity advisories, a phased plan). Its Phase 0 (dead fragment out of `queryBrandBySlug`)
> and most of Phase 1 (narrow `filter-metadata` tag, `'max'` SWR for collateral tags,
> `partialPrefetching: true`, all brands prerendered) **have shipped** (commits `a84fe15`, `e79d9e4`).
> Phase 2 (defineLive) and Phase 3 (retire webhook) have not. This report does not repeat that
> dossier; it inventories the current fetch surface and ranks cost hotspots.

---

## 1. Summary

- **One client, three wrappers.** `apps/web/src/global/sanity/client.ts:48` builds the only shared
  client (`useCdn` only on `VERCEL_ENV=production`, `perspective: 'published'` on Vercel / `'drafts'`
  locally, token everywhere except production). `fetch.ts` wraps it as `sanityFetch` (`'use cache'` +
  `cacheTag` + `cacheLife('weeks')` = 30 days, `cacheMode: 'noStale'`, 3× retry), `sanityFetchDynamic`
  (same client, no Next cache) and `sanityFetchFresh` (separate non-CDN, token client).
- **~75 call sites.** About 60 go through `sanityFetch`, 5 through `sanityFetchDynamic`, 2 through
  `sanityFetchFresh`. **~15 bypass the wrappers**: they create their own `@sanity/client` (revalidate
  webhook, blog search, CPO availability, admin/operator auth, redirects script) or call the raw
  `client` directly (`/api/analytics/meta`, newsletter routes).
- **The Next `use cache` layer is not a durable data cache on Vercel.** Default `use cache` is a
  per-instance in-memory LRU. On serverless, entries "typically don't persist across requests" and
  never survive a deploy (`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md:200-216`).
  Only fetches that end up in a prerendered static shell or ISR entry are durable. So every
  **request-time** `sanityFetch` (searchParams listings inside Suspense, server actions, route
  handlers, bot renders, the 865 products not prerendered at build, shell revalidations) usually
  costs **one Sanity API CDN request**. The API CDN is the real cache, and that makes this the main
  request multiplier. The prior research names "620k CDN req/month traced to rendering multipliers"
  (`.ai/rendering-revalidation-research-2026-08.md:471`).
- **Top cost hotspots (§6):**
  1. Request-time listing renders keyed on arbitrary searchParams.
  2. `/api/analytics/meta` reads Sanity uncached on every consented tracking event.
  3. Webhook fan-out from bulk product mutations (price sync, denorm cascade): each webhook makes 2+
     uncached **API (non-CDN)** reverse-lookup queries.
  4. `queryAllProductsFilterMetadata` (~190 KB, whole catalogue) is re-fetched by every listing
     shell on every product publish.
  5. Uncached comparator page (`/porownaj`), which pulls every product in a category with full
     technical data.
  6. Preview deployments run on the live API (`useCdn: false`) with `cacheLife('minutes')`.
  7. Blog search, which hits the live API on every query.
- **Security finding that matters for `defineLive`:** `NEXT_PUBLIC_SANITY_API_READ_TOKEN` is inlined
  into a browser chunk. `client.ts` (with the token) is bundled because `components/shared/Image.tsx`
  imports `urlFor` from it and is used by `'use client'` components. Confirmed in the local build:
  `.next/static/chunks/3xod-t24joxxp.js` contains the token literal next to the
  `"Missing environment variable: SANITY_API_READ_TOKEN"` string (value not reproduced here).
  Anyone can use it to run uncached, draft-perspective API queries billed to the project.
- **Tag-taxonomy drift.** Several broad tags used at call sites (`product`, `blog-article`, `review`,
  `page`, `mailchimp-settings`) are **never** emitted by `/api/revalidate`. The entries that depend on
  them (sitemap, `/produkty/archiwalne`, `/recenzje/archiwalne`, PDF routes, comparison box,
  `BlogListing`'s inner fetch) can stay stale for up to 30 days. Sync tags from `defineLive` would fix
  this class of bug automatically.

---

## 2. Client and fetch wrappers

### 2.1 `apps/web/src/global/sanity/client.ts`
- `:17-40`: `dataset` (default `production`), `projectId`, `readToken` from
  **`NEXT_PUBLIC_SANITY_API_READ_TOKEN`** (asserted at import, so it throws if missing, even in
  production where the token is not used), `apiVersion = NEXT_PUBLIC_SANITY_API_VERSION || '2025-02-10'`.
- `:48-55`, the shared client:
  ```ts
  useCdn: IS_PRODUCTION_DEPLOYMENT,                       // VERCEL_ENV === 'production' (constants.ts:37)
  perspective: process.env.VERCEL_ENV ? 'published' : 'drafts',
  ...(!IS_PRODUCTION_DEPLOYMENT ? { token: readToken } : {}),
  ```
  - Production: API CDN, published, no token. Correct.
  - **Preview deployments: `useCdn: false` + token + published**, so every miss goes to the live API.
  - Local dev: live API, `drafts` perspective, token. This is the only "preview" in the app. There is
    no `draftMode`, Presentation, `stega`, `VisualEditing` or `SanityLive` anywhere (grep returns
    nothing).
  - No `requestTagPrefix`, and no per-query `tag`, so Sanity usage dashboards cannot attribute
    requests to queries.
- `:57-60`: `urlFor = imageBuilder.image(src).auto('format').fit('max').format('webp')`.
- **Client-bundle leak:** `components/shared/Image.tsx:4` imports `urlFor` from this module. Image is
  used by 16+ `'use client'` components (`ProductCardAddToCart`, `ProductGallery`,
  `FloatingComparisonBox`, `HeroCarousel`, …), so `createClient` **and the inlined token** ship to the
  browser.

### 2.2 `apps/web/src/global/sanity/fetch.ts` (`server-only`)
- `:9-16` `freshClient`: `useCdn: false`, `perspective: 'published'`, token. Used only by
  `sanityFetchFresh`.
- `:25`: `SANITY_FETCH_OPTIONS = { cacheMode: 'noStale' }` (commit `a5eab4b`). It stops the CDN from
  serving stale-while-revalidate entries into a 30-day Next entry. It is only sent when `useCdn` is
  true.
- `:34-58`: retry wrapper with 3 attempts and 500/1000 ms backoff. Retries count as extra requests
  on failures and timeouts.
- `:65-92` **`sanityFetch({query, params, tags})`**:
  ```ts
  'use cache';
  if (tags.length > 0) cacheTag(...tags);
  if (NODE_ENV==='development') cacheLife('seconds');
  else if (VERCEL_ENV==='preview') cacheLife('minutes');   // NOTE: 'minutes' is NOT overridden in next.config
  else cacheLife('weeks');                                  // overridden to 30d stale/revalidate/expire
  return fetchSanityWithRetry(() => client.fetch(query, params, SANITY_FETCH_OPTIONS));
  ```
  The cache key is `(query string, params, tags)`, plus the build ID.
- `:101-111` `sanityFetchDynamic`: the same client with no Next cache. In production that is still the
  API CDN (`noStale`).
- `:117-127` `sanityFetchFresh`: live API with a token and no CDN. Used for checkout and cart
  correctness.

### 2.3 Other client factories (bypass the wrappers)
| File:line | Config | Purpose |
|---|---|---|
| `apps/web/src/app/api/revalidate/route.ts:35-52` | `useCdn:false`, token = **`NEXT_REVALIDATE_TOKEN`** (the same secret as the webhook bearer, used as a Sanity write token), apiVersion `2024-01-01` | reverse lookup + denorm patches |
| `apps/web/src/global/sanity/blog-search.ts:65-88` + `blog-search-config.ts:21-37` | `useCdn:false`, `SANITY_API_READ_TOKEN` (server-only), apiVersion `2026-08-21`, `cache:'no-store'`, 3 s timeout, `maxRetries:0` | blog semantic / lexical search |
| `apps/web/src/global/b2c/checkout/server/cpo-availability.ts:85-112` | `useCdn:false`, `SANITY_API_WRITE_TOKEN`, published | CPO reserve / sell / release (read + write) |
| `apps/web/src/global/b2c/admin/server/auth.ts:133-150` | user-supplied bearer, `useCdn:false` | `users.getById('me')`, `projects.list` (b2c-admin operator auth) |
| `apps/web/src/global/sanity/operator-auth.ts:85-103` | user-supplied bearer, `useCdn:false` | newsletter operator auth |
| `apps/web/scripts/generate-redirects.ts:13-20` | `useCdn:false`, `NEXT_PUBLIC_SANITY_API_READ_TOKEN`, `2024-12-19` | build-time redirects map (runs on every `build`) |
| `apps/web/src/app/actions/embeddings.ts:35-56` | raw `fetch` to `{projectId}.api.sanity.io/vX/embeddings-index/query/...` | legacy blog embeddings (rollback path only; production uses `dataset` mode since 2026-09-20) |
| `apps/web/scripts/verify-blog-search.ts:36-83` | ad-hoc clients | manual verification script |

### 2.4 `operator-auth.ts`, `blog-search*.ts`
- `operator-auth.ts`: one `users/me` call per newsletter-generate request. Negligible.
- `blog-search.ts:111-179`, `searchBlogArticles`. In production `SANITY_BLOG_SEARCH_BACKEND=dataset`
  (`context/changes/sanity-dataset-embeddings-migration/operations.md`, "Current rollout state"):
  - **1 live-API request per search** (`queryBlogSemanticSearch`, top 50, paginated in JS).
  - When the result is empty or fails, it falls back to **+1** `queryBlogLexicalSearch`.
  - Legacy mode: embeddings call + 1 query (+ lexical fallback).
  - Nothing is cached, by design ("No semantic results enter the weeks-long browse cache").
  - Legacy retirement was due for review on 2026-09-27 (`fetchEmbeddings`, legacy env fallback at
    `blog-search.ts:70-82`, `NEXT_PUBLIC_` token use).

---

## 3. Caching and revalidation model

### 3.1 Next config (`apps/web/next.config.ts`)
- `:6` `cacheComponents: true`, `:13` `partialPrefetching: true`.
- `:20-46`: `cacheLife` profiles `default`, `hours`, `days`, `weeks` and `max` are **all overridden to
  30 days** stale/revalidate, so `'hours'` does not mean hours. `seconds` and `minutes` keep the
  built-in values.
- `:53-71` `images`: default Next loader (Vercel Image Optimization), `minimumCacheTTL: 1y`,
  `cdn.sanity.io` allowed.
- There are no route-segment configs (`dynamic`, `revalidate`, …). They are illegal under
  `cacheComponents`.
- `apps/web/vercel.json`: only `VERCEL_PRERENDER_METADATA_BOUNDARY=1`. No crons, no warming.

### 3.2 `use cache` scopes outside `sanityFetch`
`layout.tsx:28` (whole root layout), `produkty/(listing)/page.tsx:50`,
`produkty/(listing)/kategoria/[category]/page.tsx:87,99`, `marki/[slug]/page.tsx:63,87`,
`blog/(listing)/page.tsx:29`, `blog/(listing)/kategoria/[category]/page.tsx:47,60`,
`[slug]/page.tsx:76` (page component, `cacheLife('max')`), `components/ui/Header/index.tsx:8`,
`components/ui/Footer/index.tsx:13`, `components/pageBuilder/ProductsListing/index.tsx:37`,
`components/pageBuilder/CpoProductsListing/index.tsx:45`, `components/ui/StoreLocations/index.tsx:62`
(Nominatim, not Sanity), `global/supabase/queries.ts:39` (pricing). Outer scopes re-declare the same
tags as the inner `sanityFetch` (for example `marki/[slug]/page.tsx:63-74`).

### 3.3 Static params
`global/build.ts`: `limitBuildTimeStaticParams` → **`slice(0,1)`** in production and preview, unless
`LIMIT_BUILD_TIME_STATIC_PARAMS=0`. Effect at build time:
- Brands: all ~41 prerendered (`marki/[slug]/page.tsx:100-128` uses `allBuildTimeStaticParams`).
- Products (~866), blog, reviews, CMS pages, CPO, product and blog categories: **one each**.
- Every other URL renders on first request **after each deploy** (the cache key includes the build ID).

`generateStaticParams` sites: `produkty/[slug]:86`, `produkty/(listing)/kategoria/[category]:113`,
`marki/[slug]:100`, `blog/[slug]:37`, `blog/(listing)/kategoria/[category]:71`, `recenzje/[slug]:36`,
`[slug]:19`, `certyfikowany-sprzet-uzywany/[slug]:62`.

### 3.4 Webhook revalidation (`apps/web/src/app/api/revalidate/route.ts`, 1007 lines)
- Bearer `NEXT_REVALIDATE_TOKEN` (`:503-522`). Accepts one doc or an array, plus manual `tags`/`paths`.
- `TYPE_DEPENDENCY_MAP` (`:378-462`). Examples: `product → products, homePage, filter-metadata`;
  `brand → brands, filter-metadata`; `blog-article → blog, homePage`; `cpoProduct → cpoProduct, cpoPage`.
  Unmapped types fall back to their own type name (`:468-470`).
- Reverse lookups (`:123-360`). Each one is **an uncached, live-API (`useCdn:false`) query**:
  - `getReferencingDocumentTags` (`:161-170`): `*[references($id) && _type in [...]]`, for
    product, cpoProduct, review, blog-article, youtubeVideo, categories and store.
  - `getProductsInCategoryTags` (`:245`), for category edits.
  - `getProductBrandTag` (`:284`), **for every product webhook**.
  - `getBrandOwnTags` (`:336`), only when the payload has no slug.
- Invalidation profile per tag (`:498-499`, `:719-725`): `{expire: 0}` for the edited document's own
  tags and for manual tags; `'max'` (SWR) for collateral tags.
- `revalidatePath` safety net for CPO (`:590-600`).
- **Denorm writes inside the webhook** (`:663-669`, `:855-1007`):
  - Brand edit: fetch the brand, fetch the product ids, then patch in transactions of 50
    (`visibility:'async'`).
  - Category edit: **N+1**. Per product, one fetch of its categories plus one separate patch commit
    (`:970-996`).
  - Every patch fires a new product webhook unless the dashboard webhook filter excludes
    denorm-only changes. `.ai/isr-cost-reduction-strategy-v2.md` §Change 1 proposes that filter; it is
    **not verifiable from the repo**.
  - The denorm promise is not awaited (`:734-738`). On Vercel it can be cut off after the response
    unless `after()`/`waitUntil` is used.
- Other invalidation: `global/b2c/checkout/server/cpo-availability.ts` `invalidateCpoAvailabilityCache`
  calls `revalidateTag('cpoProduct', {expire: 0})` plus paths on every reserve, sell or release. That
  expires **all** CPO listing and detail entries (blocking) at every CPO checkout event.

### 3.5 Tags used at call sites but never emitted by `/api/revalidate`

| Tag | Used by | Effect |
|---|---|---|
| `product` (broad) | `sitemap.ts:50`, `produkty/archiwalne/page.tsx:17`, `produkty/[slug]/pliki/[pdfKey]/route.ts:21`, `actions/comparison.ts:39`, `produkty/[slug]/page.tsx:57,87,106` (alongside `product:<slug>`, fine) | sitemap, archive page, PDF links and comparison box are pinned for up to 30 days |
| `blog-article` (broad) | `components/blog/BlogListing/index.tsx:53-66`, `sitemap.ts:36`, `blog/[slug]/page.tsx:38` | the inner listing fetch is not invalidated when an article is published; it is masked only by in-memory misses |
| `review` (broad) | `recenzje/archiwalne/page.tsx:17`, `recenzje/pdf/[slug]/route.ts:21`, `sitemap.ts:54` | stale |
| `page` (broad) | `sitemap.ts:32`, `[slug]/page.tsx:20` | stale sitemap |
| `mailchimp-settings` | `global/mailchimp/subscribe.ts:46` | a settings change never reaches it (type is `settings`) |

---

## 4. Call-site inventory

Legend for **Cached?**:
- **UC** = `sanityFetch` (`use cache`). Durable only inside a prerendered shell or ISR entry;
  otherwise in-memory per instance.
- **Dyn** = `sanityFetchDynamic` (no Next cache; API CDN in production).
- **Fresh** = live API with a token.
- **Raw** = direct client.

Context:
- **Shell** = part of a prerendered or ISR static shell.
- **RT** = request time (Suspense with searchParams, cookies, action, route).
- **Build** = build-time script.

| File:line | Query | Cached? | Tags | Context |
|---|---|---|---|---|
| `app/layout.tsx:34` | `querySettings` | UC (+ layout `use cache`) | settings | Shell (every page) |
| `components/ui/Header/index.tsx:9` | `queryNavbar` | UC | navbar | Shell |
| `components/ui/Footer/index.tsx:14` | `queryFooter` | UC | footer | Shell |
| `components/shared/CookieConsent/CookieConsent.tsx:18` | `querySettings` (dup of layout; same key) | UC | settings | Shell (production only) |
| `app/page.tsx:10` (called twice: metadata + page) | `queryHomePage` | UC | homePage | Shell |
| `app/not-found.tsx:13` | `queryNotFoundPage` | UC | notFound | Shell / RT on 404 |
| `global/seo.ts:81` | `queryNotFoundPage` (when no SEO given) | UC | notFound | metadata of every page |
| `global/seo.ts:107` | `queryDefaultOGImage` | UC | settings | metadata of every page |
| `global/seo.ts:113` | `queryHomePageSeoDescription` (when no description) | UC | homePage | metadata |
| `app/[slug]/page.tsx:20` | `queryAllPageSlugs` | UC | page | Build (gSP) |
| `app/[slug]/page.tsx:37` | `queryPageBySlug` | UC (+ page `use cache`) | `page:<slug>` | Shell; **RT for any unknown top-level URL** (catch-all) |
| `app/[slug]/page.tsx:54` | `queryPageSeoBySlug` | UC | `page:<slug>` | metadata (2nd request per CMS page) |
| `app/produkty/(listing)/page.tsx:55` | `queryProductsPageContent` | UC (+ outer) | products | Shell |
| `app/produkty/(listing)/page.tsx:60` | `queryAllProductsFilterMetadata` | UC (+ outer) | filter-metadata | Shell |
| `app/produkty/(listing)/kategoria/[category]/page.tsx:91` | `queryAllProductsFilterMetadata` | UC | filter-metadata | Shell (per category) |
| `app/produkty/(listing)/kategoria/[category]/page.tsx:103` | `queryProductsPageContent($category)` | UC | products, productCategorySub | Shell |
| `components/products/ProductsListing/index.tsx:157` | `queryAllProductsFilterMetadata` (only when searching) | UC | filter-metadata | **RT** |
| `components/products/ProductsListing/index.tsx:180` | `getProductsListingQuery(sortBy)` (6 variants), params from searchParams | UC | products | **RT**, key per filter / sort / page / search combination |
| `components/pageBuilder/ProductsListing/index.tsx:41` | `queryAllProductsFilterMetadata` | UC | filter-metadata | Shell |
| `app/marki/page.tsx:13,31` | `queryBrandsPageData` | UC | brands | Shell |
| `app/marki/[slug]/page.tsx:67` | `queryBrandBySlug` (shared by metadata + page) | UC (+ outer) | brand, `brand:<slug>` | Shell (all 41 prerendered) |
| `app/marki/[slug]/page.tsx:91` | `queryAllProductsFilterMetadata` | UC (+ outer) | filter-metadata | Shell |
| `app/marki/[slug]/page.tsx:101` | `queryAllBrandSlugs` | UC | brand, brands | Build |
| `app/produkty/[slug]/page.tsx:57` | `queryProductBySlug` | UC | product, `product:<slug>` | Shell for 1 product; **RT on first hit for ~865** |
| `app/produkty/[slug]/page.tsx:64` | `queryProductInquiryFormState` | UC | settings | same |
| `app/produkty/[slug]/page.tsx:79` | `queryBrandStoresById` (when product has no stores) | UC | brand-stores, `brand-stores:<id>` | same |
| `app/produkty/[slug]/page.tsx:87` | `queryAllProductSlugs` | UC | product | Build |
| `app/produkty/[slug]/page.tsx:106` | `queryProductSeoBySlug` | UC | product, `product:<slug>` | metadata (2nd request per product) |
| `app/produkty/[slug]/page.tsx:160` | `queryArchivedProductCta` (archived products only) | UC | settings | same |
| `app/produkty/[slug]/pliki/[pdfKey]/route.ts:21` | `queryProductPdfBySlugAndKey`, then `fetch(fileUrl)` proxies the PDF bytes | UC | product | **RT route handler** |
| `app/produkty/archiwalne/page.tsx:17` | `queryArchivedProducts` | UC | product | Shell (never invalidated) |
| `app/blog/(listing)/page.tsx:33` | `queryBlogPageContent` | UC (+ outer) | blog | Shell |
| `app/blog/(listing)/kategoria/[category]/page.tsx:51,64` | `queryBlogPageContent` ×2 (default + category) | UC (+ outer) | blog, blog-category | Shell |
| `components/blog/BlogListing/index.tsx:53` | `getBlogArticlesQuery('newest')` | UC | blog-article | **RT** (page / year / category) |
| `components/blog/BlogListing/index.tsx:47` → `global/sanity/blog-search.ts:83` | `queryBlogSemanticSearch` / `queryBlogLexicalSearch` | **Raw live API, no-store** | — | **RT per search** |
| `app/blog/[slug]/page.tsx:29,53,84` | `queryBlogPostBySlug`, `queryBlogPostSeoBySlug`, `querySettings` | UC | blog-article, `blog-article:<slug>`, settings | Shell for 1; RT first hit |
| `app/blog/[slug]/page.tsx:38` | `queryAllBlogPostSlugs` | UC | blog-article | Build |
| `app/recenzje/[slug]/page.tsx:28,37,52` | `queryReviewBySlug`, `queryAllReviewSlugs`, `queryReviewSeoBySlug` | UC | review, `review:<slug>` | as above |
| `app/recenzje/archiwalne/page.tsx:17` | `queryOrphanReviews` | UC | review | Shell (never invalidated) |
| `app/recenzje/pdf/[slug]/route.ts:21` | `queryPdfReviewBySlug`, then a proxied PDF fetch | UC | review | **RT route** |
| `app/certyfikowany-sprzet-uzywany/page.tsx:11,40` | `queryCpoPage` | UC | cpoPage | Shell |
| `components/pageBuilder/CpoProductsListing/index.tsx:49` | `queryCpoProductsFilterMetadata` | UC (+ outer) | cpoProduct | Shell |
| `components/pageBuilder/CpoProductsListing/CpoProductsListingInner.tsx:67,72` | `getCpoProductsListingQuery` + `queryCpoProductsListingCount` (**2 requests; mergeable**) | UC | cpoProduct | **RT** |
| `app/certyfikowany-sprzet-uzywany/[slug]/page.tsx:63,87,114,119` | `queryAllCpoProductSlugs`, `queryCpoProductSeoBySlug`, `queryCpoProductBySlug`, `queryProductInquiryFormState` | UC | cpoProduct, `cpoProduct:<slug>`, settings | Shell for 1; RT |
| `app/polityka-prywatnosci/page.tsx:13`, `app/regulamin/page.tsx:13` | legal singletons | UC | privacyPolicy / termsAndConditions | Shell |
| `components/pageBuilder/ContactMap/index.tsx:23` | `querySettings` | UC | settings | Shell |
| `app/sitemap.ts:32-62` | 8 `*ForSitemap` slug queries | UC | page, blog-article, brand/brands, cpoProduct, product, review, blog-category, productCategorySub | Shell (mostly never invalidated) |
| `app/koszyk/page.tsx:41,45` | `queryCartSupportCard`, `queryCartEmptyState` | UC | settings | Shell / RT |
| `app/koszyk/twoje-dane/page.tsx:48` | `queryCartSupportCard` | UC | settings | RT (auth path) |
| `app/actions/product-quick-add.ts:82` | `queryProductQuickAddBySlug` | UC | product, `product:<slug>` | **RT server action** (per tile click) |
| `app/actions/comparison.ts:39` | `queryComparisonProductsMinimal($productIds)` | UC | product | **RT server action**, called by `FloatingComparisonBox` (root layout) on mount and on change |
| `app/actions/comparison.ts:67` | `queryComparisonPageData($categorySlugs)` | **Dyn** | — | **RT** `/porownaj` (cookies) |
| `app/api/contact/route.ts:381` | `queryContactSettings` | UC | settings | RT route |
| `global/mailchimp/subscribe.ts:46` | `queryMailchimpSettings` | UC | mailchimp-settings | RT action |
| `global/b2c/customer-transactional-email.ts:19` | `queryB2cTransactionalEmailCopyRecipients` | UC | settings | RT (order emails) |
| `global/b2c/legal-documents/return-instructions.ts:19` | `queryB2cReturnInstructionsEmail` | Dyn | — | RT (returns) |
| `global/b2c/legal-documents/withdrawal-form.ts:40` | `queryB2cWithdrawalForm` | Dyn | — | RT |
| `global/b2c/admin/server/coupon-products.ts:222,225` | `queryCouponStandardProducts`, `queryCouponCpoProducts` (whole catalogue) | Dyn | — | RT admin API |
| `global/b2c/cart/server/revalidation.ts:71` | `queryStandardProductRevalidationBySlug`, **one per unique cart product** (N+1) | Fresh | — | RT action (`CartPageClient` → `loadCartPageRuntime`, checkout submit) |
| `global/b2c/cart/server/revalidation.ts:137` | `queryCpoProductRevalidationBySlug`, one per CPO line, plus `releaseExpiredCpoHoldBySlug` | Fresh | — | RT |
| `global/b2c/checkout/server/cpo-availability.ts:210,226` | `queryCpoAvailabilityBySlugs` / `BySlug` (+ writes) | Raw, live API with write token | — | RT checkout / payment |
| `app/api/analytics/meta/route.ts:135` | inline `META_ANALYTICS_QUERY` (settings: pixel id + **conversion token**) | **Raw shared client (API CDN in production), no Next cache** | — | **RT on every Meta CAPI event** (PageView, ViewContent, …) |
| `app/api/newsletter/generate/route.ts:239,604` | `*[_id in $ids]`, `queryMailchimpSettings` | Raw | — | RT operator only |
| `app/podglad/newsletter/route.ts:14,30` | inline youtubeVideo / homePage queries | Raw `useCdn:false`, no-store | — | RT, returns 404 in production |
| `app/api/revalidate/route.ts:161,245,284,336,861,876,930,947,973` | reverse lookup + denorm | Raw live API with write token | — | RT webhook |
| `global/sanity/operator-auth.ts:102`, `global/b2c/admin/server/auth.ts:139` | `users/me`, `projects.list` | Raw | — | RT admin |
| `scripts/generate-redirects.ts:31` | `redirects` singleton | Raw live API | — | Build (every deploy) |

No browser-side Sanity **query** traffic exists today. Client components reach Sanity only through
server actions and routes (`comparison`, `product-quick-add`, `cart-revalidation`,
`/api/analytics/meta`, `/api/contact`). The bundled client in the browser is unused except for `urlFor`.

---

## 5. Query efficiency findings (`apps/web/src/global/sanity/query.ts`, 2861 lines)

Ranked by likely cost impact: requests, then bandwidth, then latency.

1. **`queryAllProductsFilterMetadata` (`:1776-1830`): whole-catalogue payload, re-fetched often.**
   - ~866 products with `customFilterValues[]`, all categories, all brands with a full
     `imageFragment('logo')` (LQIP base64 per logo), plus 2 more full scans for global min and max.
   - The prior dossier measured ~190 KB. It is filtered by `brand->doNotShowBrand` (a deref per
     product).
   - Fetched by 4+ shells: `/produkty`, ~42 category pages, 41 brand pages, and the pageBuilder
     ProductsListing. It is also fetched at RT when searching (`ProductsListing:157`).
   - Invalidated (SWR) on **every product, brand or category publish**, including price-sync patches.
   - Because nested `use cache` entries don't persist on serverless, each shell regeneration
     re-requests it. Worst case is ~85 × 190 KB per product publish wave.
   - Fixes:
     - Use the `logo` lite fragment, or drop LQIP.
     - Replace `brand->doNotShowBrand` with a denormalised flag.
     - Fold min and max into one pass, or compute them in JS from `products`.
     - Brand pages could fetch a brand-scoped subset.
2. **Request-time listings (`productsListingFragment` `:2229-2254`, `productsFilterConditions`
   `:2138-2194`).**
   - Each request is cheap. The cost is that the query and params are derived from free-form
     searchParams (`brands`, `minPrice`, `maxPrice`, custom and range filters, `sortBy`, `page`,
     `search` → `$searchTiers` id arrays). That gives unbounded cache-key cardinality, and keys are
     only in-memory anyway.
   - Each listing request is 1 CDN request (products + count in one query, good).
   - Per-row `brand->doNotShowBrand` deref (`:2144`). `customFilterValues` matching uses correlated
     sub-filters; `denormFilterKeys` exists but is unused (dossier §2.5).
3. **`queryComparisonPageData` (`:2566-2607`): uncached and heavy.**
   - Every product in the shared categories (not only the 2-3 being compared), with full
     `technicalData.groups[].rows[].values[].content` portable text, brand logo and image fragments.
   - Uses `categories[]->slug.current` derefs instead of `denormCategorySlugs`.
   - Called by `/porownaj` via `sanityFetchDynamic` on every visit. `fetchComparisonPageData` is also
     an **exported `'use server'` action**, publicly invocable with arbitrary slugs.
4. **`pageBuilderFragment` (`:940-970`) is embedded in 6+ queries.** These are `queryHomePage`,
   `queryPageBySlug`, both branches of `queryProductsPageContent`, `queryBlogPageContent`,
   `queryProductBySlug` and the CPO page.
   - Blocks use `...` spreads (`:516, 552, 560, …`), so all raw fields are shipped, a mild
     over-fetch.
   - Heavy branches are evaluated only when the block is present:
     - `productsListingBlock` (`:765-796`): per-subcategory `count(*[... brand->doNotShowBrand ... references(^._id)])`.
       This is the **same pattern as the removed 5-6 s brand fragment** (~42 full scans with deref).
     - `brandsByCategoriesSectionBlock` (`:810-830`): per parent category, a full product scan with
       `categories[]->parentCategory` + `brand->` deref.
     - `featuredPublicationsBlock` (`:606-660`): a 4-type union scan, `[0...20]`, with
       `publicationBlock` that has 6+ `select()` branches and image derefs.
     - `faqSectionBlock` and `contactFormBlock` embed `*[_type=="newsletterSettings"][0]` with
       extended portable text, and `*[_type=="settings"][0].companyRegistration`.
   - Request count is not affected; payload, latency and timeout risk are.
5. **Duplicate SEO round trips.** `queryProductSeoBySlug`, `queryPageSeoBySlug`,
   `queryBlogPostSeoBySlug`, `queryReviewSeoBySlug` and `queryCpoProductSeoBySlug` are separate cache
   entries next to the page query, so each cold page costs +1 request.
   - The brand page already collapsed this by reusing `getBrandContent` (`marki/[slug]/page.tsx:138-147`).
   - `getSEOMetadata` (`global/seo.ts:76-118`) adds `queryDefaultOGImage` and conditionally
     `queryHomePageSeoDescription` / `queryNotFoundPage`. These are shared keys, cheap when warm.
6. **CPO listing: 2 requests where 1 would do** (`CpoProductsListingInner.tsx:65-76`,
   `query.ts:1149-1192`). Merge into `{ "products": …, "totalCount": count(…) }` like the product
   listing.
7. **`queryCpoProductsFilterMetadata` (`:1194-1233`)** runs 4 full scans of the same filter. Compute
   `brands`, `min` and `max` in JS from `products`.
8. **`queryBlogPageContent` (`:1486-1541`)** runs per-category `count(*[...])`, a total count, and
   `array::unique` over all articles for years. These are cached in the shell, so the cost is fine.
   `blogArticlesFilterConditions` (`:1609-1618`) uses `category->slug.current` (a deref per article).
9. **`queryProductBySlug` (`:2408-2500`)** is large but scoped to one document. It does a reverse
   `*[_type=="award" && references(^._id)]` scan, pulls `pageBuilderFragment`, extended portable text
   and related products with full `productFragment` (LQIP and brand logos).
10. **Dead queries**:
    - `queryProductsPageData` (`:2042`) still injects `productsFilterMetadataFragment()` (`:2109`), the
      5-6 s fragment.
    - `queryBlogPageData` (`:1544`), `queryCategoryMetadata` (`:2314`), and the aliases
      `queryProductsListing`, `queryBlogArticles` and `queryCpoProductsListing` are also unused.
    - They are harmless at runtime but are traps for reuse. Delete them with the fragment
      (`:1843-1965`).
11. **N+1 patterns**:
    - `cart/server/revalidation.ts:84-107,145-160`: one Fresh request per unique cart product. Batch
      with `slug.current in $slugs`.
    - `api/revalidate/route.ts:970-996`: per-product category fetch + patch on a category edit.
    - `cpo-availability.ts` `releaseExpiredCpoHoldBySlug` per CPO line.
12. **`queryAllProductsFilterMetadata`-style whole-catalogue reads on admin paths:**
    `coupon-products.ts` `queryCouponStandardProducts` / `CpoProducts` are uncached. They are admin
    only, so volume is low.

---

## 6. Cost hotspots (ranked)

Sanity bills API requests (live API, with a smaller quota) separately from API **CDN** requests and
bandwidth. Ranking combines frequency, multiplier and request class.

1. **Request-time `sanityFetch` without a durable cache (all RT rows in §4).**
   - Product, blog and CPO listing grids (every filter, sort, page or search permutation).
   - First hits for ~865 products and every blog, review and CPO detail page after **each deploy**.
   - Every bot or crawler render (Next renders bots dynamically).
   - Server actions (`comparison`, `product-quick-add`) and route handlers (contact, PDFs).
   - Each of these is ≥1 API CDN request, because the in-memory `use cache` rarely hits on Vercel
     serverless and Fluid instances. This matches the recorded "620k CDN req/month from rendering
     multipliers".
   - Levers: `use cache: remote` (Vercel Runtime Cache) for listing and action fetches; normalise
     and canonicalise searchParams before they become params (sort brand arrays, clamp
     prices/pages, drop unknown keys); prerender more slugs; reduce deploy frequency or keep
     entries across deploys via `fetch`-cache semantics (which defineLive's second fetch uses; see §7).
2. **`/api/analytics/meta` (`app/api/analytics/meta/route.ts:131-145`).** Every Meta CAPI event
   triggers `sanityClient.fetch(META_ANALYTICS_QUERY)` with no cache. That includes one PageView per
   session load (`components/shared/Analytics.tsx:34`), ViewContent on every product and category
   view (`ProductViewTracker`, `CategoryViewTracker`), and form or contact events, whenever conversion
   consent is granted. It scales linearly with traffic and is a one-line fix: use
   `sanityFetch({tags:['settings']})`, or better `use cache: remote`, or an env var.
   (Note: `metaConversionToken` is stored in a dataset readable by the tokenless production client,
   so the dataset is public. See §8.)
3. **Webhook fan-out on bulk mutations (live API, the costlier class).**
   - The Excel price sync (`.ai/sanity-price-sync-implementation.md`; Supabase edge function, not in
     repo) and the CPO Excel sync patch many documents. Each product webhook runs
     `getProductBrandTag` and `getReferencingDocumentTags`, which is **2 uncached live-API queries
     per product**, and SWR-invalidates `products`, `homePage` and `filter-metadata` (plus the brand
     page).
   - Brand and category edits add the denorm cascade: N patches, then N webhooks, then 2N lookups,
     unless the dashboard filter from `.ai/isr-cost-reduction-strategy-v2.md` is live.
   - Each invalidation wave then drives #4.
4. **`filter-metadata` regeneration storm.** ~85 shells re-fetch the ~190 KB query after any product
   publish (§5.1). It is bandwidth-heavy and multiplied by #3.
5. **CPO checkout invalidation.** `cpo-availability.ts` expires the broad `cpoProduct` tag with
   `{expire: 0}` on every reserve, sell or release. Every CPO listing and detail entry then blocks on
   a re-render: 2 listing requests, a filter-metadata request, and detail + SEO + form-state requests
   per page visited afterwards.
6. **`/porownaj`.** Uncached heavy category dump per visit (§5.3). It can also be triggered directly
   via the exported server action.
7. **Preview deployments.** `useCdn: false` + token + `cacheLife('minutes')` (`fetch.ts:82-84`). Every
   preview URL visit, Vercel preview bot and e2e run reads the **live API** and refetches each entry
   after ~1-5 min. Builds prerender 41 brands plus listings per preview deploy on the live API too.
8. **Blog search.** One live-API request per search, plus a lexical fallback when empty. It is
   bounded by user search volume. The `connection()` gate keeps prerender probes out.
9. **Catch-all and unknown-slug probes.**
   - `app/[slug]/page.tsx` renders any unknown top-level path: `queryPageBySlug` + `queryPageSeoBySlug`
     + `getSEOMetadata` (`queryNotFoundPage`, OG) + `not-found.tsx`.
   - `/produkty/<junk>/` does the same with the product queries.
   - Scanners produce one cache key per unique junk slug, so ~3-5 CDN requests each.
10. **PDF proxy routes.** `produkty/[slug]/pliki/[pdfKey]/route.ts:33` and
    `recenzje/pdf/[slug]/route.ts:32` download the full PDF from `cdn.sanity.io` per request and
    re-serve it. `Cache-Control: public, max-age=31536000, immutable` lacks `s-maxage` /
    `CDN-Cache-Control`, so the Vercel CDN may not cache it (verify). Each download then costs Sanity
    asset bandwidth plus Vercel function bandwidth.
11. **Every deploy.**
    - `generate-redirects` runs on the live API.
    - All `generateStaticParams` and shell prerenders re-run.
    - `use cache` keys reset (build ID), so the post-deploy warm-up repeats #1 for the whole site.
12. **Images.** `Image.tsx:154-161` builds `fit('crop').auto('format')` URLs at
    **natural width/height** when no explicit size is given (fill mode has no width, so the original
    resolution is used), then hands them to the default Next/Vercel optimizer.
    - Sanity serves each source once per Vercel optimizer cache miss (1-year TTL), so Sanity
      bandwidth is bounded but uses full-resolution sources.
    - `urlFor` base also forces `.format('webp')` plus `auto('format')`.
    - Hero and marquee components (`HeroCarousel.tsx:183-197`, `HeroStatic/index.tsx:38-51`,
      `BrandsMarquee/index.tsx:34-46`) request 2120 px crops through `getImageProps` (also optimized).
    - Trade-off for later: a Sanity loader with `unoptimized` would remove the Vercel optimizer cost
      but **increase** Sanity CDN asset bandwidth (every visitor hits `cdn.sanity.io`). For Sanity
      cost alone, keep Vercel in front and cap source width (for example `.width(Math.min(natural, 2400))`).
    - LQIP (`asset->metadata.lqip`) is projected in every `imageFragment`, including listings,
      logos and filter metadata.

---

## 7. `defineLive` migration surface

### 7.1 What next-sanity 13.3.3's `defineLive` actually does
From `node_modules/next-sanity/dist/live/conditions/react-server/index.js:10-63`:
- `client.withConfig({allowReconfigure:false, useCdn:true, perspective:'published', stega:false})`.
- **Two fetches per call:**
  1. A `syncTags`-only fetch (`tag: fetch-sync-tags`, **no `next` cache options**, so it always goes
     to the network).
  2. The real fetch with `next: { revalidate: false, tags: [...tags, ...'sanity:'+syncTag] }`.
- `cacheMode: 'noStale'` except in the build phase. `requestTag` defaults to `next-loader.fetch`
  (usage attribution for free).
- `strict: true` requires `perspective` and `stega` to be passed explicitly, so it never touches
  `draftMode()` or `cookies()`.

**Cost implication:** in RT contexts where the current `sanityFetch` makes 1 CDN request, defineLive
makes **1-2** (the syncTags fetch is always network; the second may be served by Next's fetch Data
Cache, which persists across instances and deploys on Vercel, unlike `use cache` memory). Net effect
on CDN request count is **not obviously lower** and could double on RT paths. Measure before
switching RT call sites. Cost savings from defineLive come from:
- Precise invalidation (sync tags replace broad `products` / `filter-metadata` waves and remove the
  webhook's 2 live-API lookups per document).
- Fixing the never-invalidated tags (§3.5).
- Possibly the durable fetch cache for the second request.

### 7.2 What `sanityFetch` (live) would replace
- `apps/web/src/global/sanity/fetch.ts` `sanityFetch`: keep the exported name and signature, keep the
  outer `'use cache'` + `cacheLife`, and swap the inner `client.fetch` for live `sanityFetch` with
  `perspective:'published', stega:false`. That migrates ~60 call sites with **zero call-site edits**.
  - The existing `tags` arrays can be passed through as extra tags during a parallel run. They need
    an `expire` / `'max'` policy (see the dossier §6.4).
  - The retry wrapper must wrap the live call, or be dropped.
  - Remove the hand-set `cacheMode` (defineLive sets it).
- `/api/revalidate` reverse lookups, `TYPE_DEPENDENCY_MAP`, `getProductBrandTag` and
  `getReferencingDocumentTags` all become redundant once the Sync Tag Invalidate Function plus a
  `/api/revalidate-tags/` endpoint are live and verified (dossier §5.3, §7 Phase 3). **The denorm
  writes (`updateProductsForBrand` / `Category`) are not cache logic.** They must move to a Sanity
  Function, the Studio publish action, or stay in a slimmed webhook. Don't delete them with the
  revalidation code.
- `generateMetadata`, sitemap and `generateStaticParams` call sites: still `sanityFetch` with
  `stega:false`. `<SanityLive>` does not cover them; Function-driven invalidation does.

### 7.3 What stays outside defineLive
- `sanityFetchFresh` and the `cpo-availability.ts` write client (checkout correctness needs the live
  API with a token, not the CDN).
- `sanityFetchDynamic` B2C and admin reads (`coupon-products`, `legal-documents/*`, comparison page).
  They can move to defineLive inside a `use cache` scope, but they are low volume. Keep them raw, or
  convert `queryComparisonPageData` to cached.
- `blog-search.ts` (semantic, no-store by design), `embeddings.ts` (retire), `operator-auth.ts` and
  `admin/server/auth.ts` (user-token auth), `scripts/generate-redirects.ts` (build), the `podglad/*`
  previews, and `api/newsletter/generate`.
- `/api/analytics/meta`: fix independently (cache or env var). Don't route it through defineLive at
  request time (2 fetches per event).
- Image URL builder (`urlFor`): unaffected, but it must be split out of `client.ts` so the client
  module stops shipping to the browser (see §8).

### 7.4 Pre-migration cleanups that pay off regardless
1. Split `client.ts` into `image.ts` (client-safe `urlFor`) and a `server-only` client. Move the
   token to `SANITY_API_READ_TOKEN` (server-only, as blog search already does) and **rotate the leaked
   `NEXT_PUBLIC_` token**. Then use it as defineLive's `serverToken`; no `browserToken`.
2. Cache `/api/analytics/meta`'s settings read.
3. Merge the CPO list and count queries. Drop the duplicate SEO queries (reuse page fetchers like the
   brand page). Delete the dead queries and fragment.
4. Fix the §3.5 tag drift now. Even if defineLive comes later, sitemap, archives and BlogListing are
   stale today.
5. Add `requestTagPrefix: 'audiofast-web'` and per-call `tag`s so Sanity's usage dashboard can show
   which queries drive CDN and API counts. That gives a baseline before and after defineLive.
6. Decide `use cache: remote` for RT listing and action fetches (Vercel Runtime Cache cost against
   Sanity CDN cost).

---

## 8. Risks

- **B2C correctness.**
  - Cart and checkout must keep reading through `sanityFetchFresh` and the write client. Never move
    `isSellableOnline`, CPO `availabilityStatus` or `priceCents` reads onto CDN or defineLive (with
    `noStale` the CDN is fresh-ish but not read-your-writes after a reserve).
  - `cpo-availability.ts`'s `revalidateTag('cpoProduct', {expire:0})` will need a sync-tag
    equivalent, or keep the custom tag passed alongside sync tags.
  - Order emails (`customer-transactional-email.ts`) and legal docs read settings at payment-webhook
    time. A throw from defineLive outside a cache scope would break payment processing. Keep them on
    a cached wrapper or raw client.
  - `product-quick-add` and `comparison` server actions call `sanityFetch` from action context. Keep
    the outer `'use cache'` wrapper, or live `sanityFetch` may throw outside a cache scope (dossier §5.1).
- **Denormalised fields.** `denormBrandSlug`, `denormBrandName`, `denormCategorySlugs`,
  `denormParentCategorySlugs` and `denormLastSync` are maintained by the webhook (`route.ts:855-1007`)
  and the Studio publish wrapper.
  - Retiring `/api/revalidate` without relocating the denorm logic silently freezes listings and
    filters after brand or category edits.
  - Sync-tag invalidation happens per document, so a brand rename invalidates queries that read the
    brand, but listings read `denormBrandName` on products and depend on the patches landing (and
    those patches emit their own sync tags, a second wave).
  - Patches are `visibility:'async'`, and the patch promise is not awaited before the response.
- **Search.**
  - The product search ranks in JS over cached filter metadata and passes `$searchTiers` id arrays
    into GROQ (`ProductsListing/index.tsx:144-170`). The query plus params must stay under the
    ~11k-char GET limit (`query.ts:2121-2123`), or the client falls back to POST. POST requests
    **are not served by the API CDN** (they go to the live API), which matters more under defineLive's
    double fetch.
  - Blog search is uncached and live-API by design. Leave it out of defineLive.
- **Shell breadth.** Sync tags may be broader or narrower than the hand-tuned map. For example,
  `queryAllProductsFilterMetadata` reads every product, so its sync tags likely invalidate on any
  product change anyway. Measure before retiring (dossier §8).
- **Two channels during the parallel run.** Both channels only expire entries, which is safe, but
  the `sanity:` prefix is unversioned coupling in next-sanity internals. Pin next-sanity.
- **Public dataset plus secrets.** `settings.analytics.metaConversionToken` is readable by the
  tokenless production client, so anyone can read it via the public API. Unrelated to cost but worth
  flagging. Move it to an env var.

---

## 9. Open questions

1. What is the **current Sanity webhook config** (filter, projection, which types fire, is the
   denorm-cascade `delta::` filter from `.ai/isr-cost-reduction-strategy-v2.md` applied)? It is not
   in the repo; check with `bunx sanity hooks list` or manage.sanity.io.
2. Actual Sanity usage split (API vs API CDN vs bandwidth vs assets) for the last 30 days. Without
   request tags we can't attribute it. Can we get the project usage export for `fsw3likv`?
3. Is the leaked `NEXT_PUBLIC_SANITY_API_READ_TOKEN` the same credential that production Vercel
   uses, and has it been seen in production chunks? (Confirmed only in a local `.next` build from
   2026-10-16.) Rotation plan?
4. How often does the Excel price sync run, and how many products does it patch per run? Does it
   use one transaction (one webhook per document either way)?
5. Does Next's fetch Data Cache actually serve defineLive's second fetch on Vercel under
   `cacheComponents` (making it durable across deploys)? If yes, defineLive may *reduce* post-deploy
   warm-up cost. Verify with a preview deploy plus Sanity request logs.
6. Do the PDF proxy routes get cached by the Vercel CDN with `max-age` only, or does every download
   re-fetch from `cdn.sanity.io`?
7. Which pages actually contain `productsListing` / `brandsByCategoriesSection` blocks (the
   expensive pageBuilder branches)?
8. Is `use cache: remote` (Vercel Runtime Cache) acceptable cost-wise for RT listing fetches, or
   should listings move toward static segment routes for the common facets?
9. Preview deployments: switch to `useCdn: true` and published, and drop `cacheLife('minutes')` (or
   gate previews behind auth) to stop live-API spend?
10. The legacy blog embeddings retirement (due for review on 2026-09-27): has it happened? It
    removes `embeddings.ts`, the `NEXT_PUBLIC_` token fallback and the legacy indexes.
11. Studio, `b2c-admin` and `cms-activity` traffic (listeners, History API, bulk-actions table) also
    counts against API quotas. That is out of scope here; does it need its own audit?
