# 08 — Route and component conversion map (defineLive strict + three-layer pages)

Audited 2026-10-26 on `main` @ `533d857` (Next 16.3.2, next-sanity 13.3.3). Read-only.

- Builds on [04 §4](04-audiofast-fetch-layer.md) (call-site table) and [05 §3–§4](05-audiofast-presentation.md) (stega surfaces, type→route map). Those are not repeated here.
- File paths are relative to `apps/web/src/` unless they start with `apps/` or `node_modules/`.

## 0. Vocabulary

**Target helpers** (in `global/sanity/live.ts`, Najbar/lsse shape, see 01 §2 and 02 §2.2):

| Helper | Contract |
|---|---|
| `sanityFetch({query, params, perspective, stega, tags?})` | Live, `strict: true`. Calls `cacheTag()`, so it **must run inside a `'use cache'` scope**. |
| `sanityFetchPublished` | Owns `'use cache'` + `cacheLife('sanity')`. Hard-pinned to `perspective:'published', stega:false`. Safe to call from metadata, routes, actions, sitemap and B2C helpers. |
| `sanityFetchMetadata`, `sanityFetchStaticParams` | The same function object as `sanityFetchPublished`. |
| `getDynamicFetchOptions()` | Reads `draftMode()`. When on: `resolvePerspectiveFromCookies` + `stega:true`. When off: `PUBLISHED`. |
| `PUBLISHED` | `{perspective:'published', stega:false} as const` |
| `sanityFetchFresh`, raw clients | Unchanged (04 §7.3). |

**Target shapes:**

- **A — detail page, pure three-layer.**
  - L1 `Page`: uncached. Awaits `params` and `draftMode()`.
  - Published: L1 renders `<CachedX slug perspective="published" stega={false}/>`.
  - Draft: L1 renders `<Suspense><DynamicX slug/></Suspense>`. L2 `DynamicX` awaits `getDynamicFetchOptions()` and renders the same `CachedX` with `isDraft`.
  - L3 `CachedX` is the only `'use cache'` scope (`cacheLife('sanity')`). It owns all fetches and the data-dependent `notFound()`.
- **B — listing page with a `searchParams` hole.**
  - L1 and L2 as in A. They also forward the `searchParams` promise, which never enters a cache scope.
  - An uncached composer builds `listing={<Suspense fallback={…}><Listing searchParams={sp} {...opts}/></Suspense>}`.
  - It passes that JSX as a **pass-through slot** into L3 `CachedShell`. Next supports this pattern: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md:154-170,462-521` (slots do not affect the entry).
  - The listing component owns a cached data function keyed on `(params, perspective, stega)`.
  - Najbar's "never `children` in `'use cache'`" rule targets layout `children`. A slot is opaque, so its lifetimes don't propagate. Still, **verify in `next dev` (no hang) in the first B route**. Fallback: split the shell into sibling cached leaves (hero / aside / PageBuilder) that share one data function.
- **D — already-dynamic route.** The route reads cookies anyway (`/porownaj`). It resolves `getDynamicFetchOptions()` inline and passes the options to a cached data function. No extra Suspense split is needed.
- **P — published-only (no draft branch).** Sanity is read through `sanityFetchPublished`. Not a Presentation target.
- **R — route handler / metadata route.** `sanityFetchPublished`.

## 1. Route conversion map

Legend:
- **gMD** = `generateMetadata`.
- **gSP** = `generateStaticParams`.
- "Shell" = what prerenders today.

### 1.1 Presentation targets (draft-capable)

| Route | Today | Target | gMD / gSP helper | Presentation doc |
|---|---|---|---|---|
| `app/page.tsx` | No cache scope at the page. `fetchHomePageData` (`:9-14`) is called twice: gMD `:16-23` and page `:25-37`. Fully static. | **A** `CachedHome`. | gMD: `sanityFetchMetadata(queryHomePage)`. Ideally a light SEO projection, because the full query drags the whole pageBuilder. | `homePage` |
| `app/[slug]/page.tsx` | `'use cache'` + `cacheLife('max')` on the **page** (`:76-77`), awaiting `params` inside the scope. gSP `:19-32` (limited to 1). gMD `:45-69` uses `queryPageSeoBySlug`. Catch-all for unknown top-level URLs. | **A**. L1 awaits `params` and passes `slug` (string) to `CachedPage`. `cacheLife('max')` → `'sanity'`. `notFound()` stays in L3. | gSP: `sanityFetchStaticParams(queryAllPageSlugs)` + `__placeholder__`. gMD: `sanityFetchMetadata(queryPageSeoBySlug)`. | `page` |
| `app/not-found.tsx` | `sanityFetch(queryNotFoundPage)` (`:12-17`) in gMD `:19-29` and the component. Calls `notFound()` from inside not-found when data is missing (`:34-36`), which looks recursive. | **A** `CachedNotFound` (draft dispatch on `draftMode()`). Replace the inner `notFound()` with a static fallback. | gMD: `sanityFetchMetadata(queryNotFoundPage)` (shared entry with `getSEOMetadata`'s 404 fallback). | `notFound` |
| `app/produkty/(listing)/page.tsx` | `getStaticPageData` `'use cache'` (`:49-67`): content + 190 KB filter metadata. Used by gMD (`:72-86`) and the page. Listing is in Suspense (`:156-163`). Static shell. | **B**. `CachedProductsShell(opts, listing)` fetches `queryProductsPageContent({category:''})` with opts, plus `getFilterMetadata({perspective})` (always `stega:false`, §5). Slot = `<ProductsListing searchParams {...opts}/>`. | gMD: `sanityFetchMetadata(queryProductsPageContent,{category:''})` only. It no longer pulls filter metadata, which today rides along via `getStaticPageData`. | `products` |
| `app/produkty/(listing)/kategoria/[category]/page.tsx` | Cached `getStaticFilterMetadata` (`:86-95`) and `getPageContent` (`:98-108`). gSP `:113-123` is derived from the **190 KB filter metadata**. gMD `:128-147`. **The page awaits `searchParams` at `:157` outside any Suspense**, so the whole body is request-time and the prerendered shell is only the root `app/loading.tsx`. Server-side filter computation at `:199-336`. | **B, with restructure.** The cached shell holds breadcrumbs, `CollectionPageSchema`, hero, `ProductsAside` and PageBuilder. The slot `<CategoryFiltersAndListing searchParams opts filterDefinitions/>` absorbs `:219-336` (`CustomFiltersBar` active state + `ProductsListing`). `filterDefinitions` go through `stegaClean()` before leaving L3 (§5). | gSP: `sanityFetchStaticParams(<new slim queryAllProductCategorySlugs>)`, not filter metadata. gMD: `sanityFetchMetadata(queryProductsPageContent,{category})`. | `productCategorySub` |
| `app/produkty/[slug]/page.tsx` | No page scope. `fetchProductData` (`:55-71`) = product + Supabase pricing + inquiry-form state. Archived CTA `:159-164`. Brand stores `:76-84,170-172`. gSP `:86-99` (limited). gMD `:101-129` uses `queryProductSeoBySlug`. **`StoreLocations` at `:288-290` is not in Suspense**, so Nominatim sits in the shell. `ProductViewTracker` at `:226-235`. | **A** `CachedProduct({slug,perspective,stega,isDraft})`. All five Sanity reads use opts. `fetchProductPricing` stays (own cache, §7). Wrap `StoreLocations` in Suspense as on the brand page. Render trackers only when `!isDraft`. | gSP: `sanityFetchStaticParams(queryAllProductSlugs)`, all slugs. gMD: `sanityFetchMetadata(queryProductSeoBySlug)`. | `product` (+ `settings`, `brand`, `store`, `award` "used on") |
| `app/marki/page.tsx` | Two identical `sanityFetch(queryBrandsPageData)` calls (gMD `:12-28`, page `:30-39`). Static. | **A** `CachedBrands`. | gMD: `sanityFetchMetadata(queryBrandsPageData)`, or a light SEO query. | `brands` |
| `app/marki/[slug]/page.tsx` | `getBrandContent` `'use cache'` (`:62-74`), shared by gMD (`:134-154`) and the page. `getStaticFilterMetadata` (`:86-95`). gSP prerenders all brands + placeholder (`:100-129`). Suspense listing `:285-293`. Suspense `StoreLocations` `:357-369`. | **B**. `CachedBrandShell(slug, opts, listing)`. Slot = `<ProductsListing brandSlug {...opts}/>`. Keep `StoreLocations` in its own Suspense. Clean its addresses (§2). | gSP: `sanityFetchStaticParams(queryAllBrandSlugs)`. gMD: `sanityFetchMetadata(queryBrandBySlug)`. To keep today's one-request dedupe, make `getBrandContent({slug,perspective,stega})` a cached function and call it from gMD with `PUBLISHED` (same key as the published L3 read). | `brand` |
| `app/blog/(listing)/page.tsx` | `getStaticPageData` `'use cache'` (`:28-38`), shared by gMD and the page. `<Suspense><BlogListing/></Suspense>` (`:106-108`). | **B**. Slot = `<BlogListing searchParams {...opts}/>`. | gMD: `sanityFetchMetadata(queryBlogPageContent,{category:''})`. | `blog` |
| `app/blog/(listing)/kategoria/[category]/page.tsx` | Cached `getStaticBlogData` (`:46-56`) and `getPageContent` (`:59-69`). gSP `:71-82` uses the heavy `queryBlogPageContent` and keeps categories with `count > 0`. gMD `:84-115`. Suspense listing `:203-209`. | **B**. | gSP: `sanityFetchStaticParams(queryBlogPageContent,{category:''})` (shares an entry with the listing gMD), or a slim slug+count query. gMD: `sanityFetchMetadata(queryBlogPageContent,{category})`. | `blog-category` |
| `app/blog/[slug]/page.tsx` | `fetchBlogPostData` (`:28-35`). gSP `:37-48`. gMD `:50-71`. `querySettings` read only for JSON-LD (`:84-87`). | **A**. The settings read becomes `sanityFetchPublished` (JSON-LD is published-only, so no perspective). | gSP: `sanityFetchStaticParams(queryAllBlogPostSlugs)`. gMD: `sanityFetchMetadata(queryBlogPostSeoBySlug)`. | `blog-article` |
| `app/recenzje/[slug]/page.tsx` | `:27-34` page, gSP `:36-47`, gMD `:49-70`. | **A**. | gSP: `sanityFetchStaticParams(queryAllReviewSlugs)`. gMD: `sanityFetchMetadata(queryReviewSeoBySlug)`. | `review` (page type) |
| `app/certyfikowany-sprzet-uzywany/page.tsx` | gMD `:10-24`. **The page awaits `searchParams` at `:39` outside Suspense** (whole body request-time). It passes the resolved object into `PageBuilder` (`:62-66`), then into `CpoProductsListing`. | **B, via a PageBuilder slot.** L3 `CachedCpoPage(opts, slots)` renders PageBuilder with `slots.cpoListing = <Suspense><CpoProductsListingInner searchParams={promise} {...opts}/></Suspense>`. `CpoProductsListing` keeps its cached aside and filter metadata, and renders `{slots.cpoListing}` inside `ProductsListingContainer`. | gMD: `sanityFetchMetadata(queryCpoPage)`. | `cpoPage` |
| `app/certyfikowany-sprzet-uzywany/[slug]/page.tsx` | gSP `:62-80` + placeholder. gMD `:82-110`. `fetchCpoProduct` (`:112-126`). Buyability `:138-143`. `ProductViewTracker` `:196-202`. | **A**. Keep explicit `cacheTag('cpoProduct', 'cpoProduct:'+slug)` in L3, because `global/b2c/checkout/server/cpo-availability.ts:234-242` expires those tags on reserve, sell and release. Render trackers only when `!isDraft`. | gSP: `sanityFetchStaticParams(queryAllCpoProductSlugs)` + placeholder. gMD: `sanityFetchMetadata(queryCpoProductSeoBySlug)`. | `cpoProduct` |
| `app/polityka-prywatnosci/page.tsx`, `app/regulamin/page.tsx` | One fetcher called twice (gMD `:19-32` and page `:34-60`). Static. | **A**. | gMD: `sanityFetchMetadata(queryPrivacyPolicy / queryTermsAndConditions)`. | `privacyPolicy`, `termsAndConditions` |
| `app/porownaj/page.tsx` | `cookies()` at `:53`. `fetchComparisonPageData` (`:73`) is an **exported `'use server'` action** using `sanityFetchDynamic` (uncached). Static `metadata`. | **D**. Move the read out of `actions/comparison.ts` into a plain server module. Make it a cached function `getComparisonPageData({categorySlugs, perspective})`, always `stega:false`, because the table string-matches parameter names (05 §3). In draft, pass `perspective` from `getDynamicFetchOptions()`. | n/a | `comparatorConfig` (optional) |

Layout segments `app/produkty/(listing)/layout.tsx` and `app/blog/(listing)/layout.tsx` (`<main>{children}</main>`) have no fetch and no cache. Keep them as they are.

### 1.2 Published-only routes, not Presentation targets

| Route | Today | Target |
|---|---|---|
| `app/produkty/archiwalne/page.tsx` | `sanityFetch(queryArchivedProducts)` `:17-20`, tag `product` (never invalidated today, 04 §3.5). | **P**: `sanityFetchPublished`. Sync tags fix the staleness. |
| `app/recenzje/archiwalne/page.tsx` | `sanityFetch(queryOrphanReviews)` `:17-20`. | **P**: `sanityFetchPublished`. |
| `app/koszyk/page.tsx` | 2 settings queries `:40-49`, static `metadata`. | **P**: `sanityFetchPublished` ×2. Consider one merged query. |
| `app/koszyk/twoje-dane/page.tsx` | Support card `:46-56`. Checkout (Supabase session) in Suspense `:65-67`. | **P**: `sanityFetchPublished`. |
| `app/konto-klienta/**` (`page.tsx`, `(panel)/layout.tsx`, `dane-konta`, `zamowienia`, `zamowienia/[orderNumber]`, `…/faktura/route.ts`, `…/formularz-odstapienia/route.ts`) | No direct Sanity. `formularz-odstapienia` reaches `withdrawal-form.ts:40` through `customer-auth/server/order-detail.ts`. | No route change. Helpers: §4. |
| `app/podziekowania-za-zakup/page.tsx`, `[orderNumber]/page.tsx` | No Sanity (Supabase via `load-thank-you-page`). | No change. |
| `app/podglad/email/**` | No Sanity. | No change. |
| `app/podglad/newsletter/route.ts` | Raw `client` (`:7`), 404 in production (`:11`). | Keep raw. The base client must never get stega (05 §3). |
| `app/sitemap.ts` | 8 × `sanityFetch` (`:22-66`) with broad tags, mostly never invalidated (04 §3.5). | **R**: 8 × `sanityFetchPublished`. |
| `app/robots.ts`, `app/manifest.ts`, `app/icon.svg` | No Sanity. | No change. No `opengraph-image*` / `twitter-image*` files exist. |
| `app/loading.tsx` (+ `konto-klienta` loadings) | Root `loading.tsx` is today the Suspense boundary that makes the category and CPO pages' top-level `searchParams` awaits legal. | No change. After the B conversion it is only the navigation fallback. |

**Counts:** 10 shape A, 6 shape B, 1 shape D, the rest P/R. Every gMD becomes `sanityFetchMetadata` and every gSP becomes `sanityFetchStaticParams`. No gMD may call `notFound()`; none does today. In draft, an unpublished doc's gMD falls back to the 404 SEO, which is acceptable.

## 2. Components that fetch on their own

Rule: every self-fetching component owns a small cached data function that takes `{perspective, stega}` as **arguments** (part of the key). It then works both inside an L3 scope and under a request-time Suspense hole.

| Component | Today | Rendered from | Target | Perspective/stega source |
|---|---|---|---|---|
| `components/ui/Header/index.tsx:7-15` | `'use cache'` (no `cacheLife`, so the default profile), `queryNavbar`. | Root layout `:67-69` (already in Suspense). | `Header({perspective, stega})`, `'use cache'` + `cacheLife('sanity')`. | Root layout dispatch (§3). Stega surface: `Button` `variant` compare (`components/ui/Button/Button.tsx:48`), covered by the leaf filter. |
| `components/ui/Footer/index.tsx:12-17` | Same pattern, `queryFooter`. | Root layout `:71` (no Suspense). | As Header. | Layout dispatch. The draft branch needs Suspense. Stega: `iconString` goes into `dangerouslySetInnerHTML` (`:30`); add it to the leaf filter. |
| `components/shared/CookieConsent/CookieConsent.tsx:17-24` | `sanityFetch(querySettings)` (relies on the wrapper's internal cache). | Layout `:74-79`, production only. | **Published-only.** `sanityFetchPublished(querySettings)`. Never rendered in draft (§3). | None (pinned). |
| `components/schema/OrganizationSchema.tsx:24` (+ GTM preconnect at `layout.tsx:58-63`) | Settings prop from the layout's own fetch (`layout.tsx:34-37`). | Root layout. | **Published-only** self-fetching leaf, or the layout calls `sanityFetchPublished(querySettings)` (it has its own scope, so it's legal in an uncached layout). Same entry as CookieConsent. | None (pinned). |
| `components/pageBuilder/ContactMap/index.tsx:21-26` | `sanityFetch(querySettings)` unless `useCustomAddress`. | `components/shared/PageBuilder.tsx:210-216` (home, `[slug]`, any pageBuilder). | **Preferred:** fold `address/tel/email` into the `contactMap` block projection (as `faqSection`/`contactForm` already embed settings, 04 §5.4). That removes the self-fetch. **Otherwise:** a cached `getContactSettings({perspective,stega})`. | PageBuilder `fetchOptions` prop (fallback only). Stega: `tel:` href built from `displayPhone.replace(...)` (`:72-75`); clean it for the href. |
| `components/pageBuilder/CpoProductsListing/index.tsx:44-60` | `getCpoFilterMetadata` `'use cache'`, `cacheLife('hours')` (= 30 d). | `PageBuilder.tsx:160-169` (cpoPage only). | `getCpoFilterMetadata({perspective})`, `stega:false` (logic data), `cacheLife('sanity')`, keep `cacheTag('cpoProduct')` (checkout invalidation). Renders the `slots.cpoListing` slot (§1.1). | PageBuilder `fetchOptions` + `slots`. |
| `components/pageBuilder/CpoProductsListing/CpoProductsListingInner.tsx:42,67,72` | Awaits `searchParams`. 2 × `sanityFetch` (list + count). | The slot above. | Cached `getCpoListing({...parsedParams, perspective, stega})` + `cacheTag('cpoProduct')`. Merge the two queries (04 §5.6). | Props from the slot. |
| `components/pageBuilder/ProductsListing/index.tsx` | `getStaticFilterMetadata` `'use cache'` (`:36-45`). | **Nowhere.** `PageBuilder.tsx` has no `productsListing` case. `apps/studio/schemaTypes/blocks/products-listing.ts` is not registered in `blocks/index.ts`. | **Delete, don't convert.** Also delete `productsListingBlock` (`global/sanity/query.ts:765-796`, used at `:956`). It is an expensive per-subcategory count branch inside `pageBuilderFragment` that can never match. | n/a |
| `components/products/ProductsListing/index.tsx:73,157,180` | Not a cache scope. Awaits `searchParams`. `sanityFetch` filter metadata (search only) + `getProductsListingQuery(sortBy)`. | Slots of `/produkty`, the category page and `marki/[slug]`. | Props `perspective, stega`. Cached `getProductsListing({sortBy, params, perspective, stega})` + `getFilterMetadata({perspective})` (`stega:false`). | Slot props. |
| `components/blog/BlogListing/index.tsx:34,44,53-64` | Awaits `searchParams`. `connection()` on search. `sanityFetch` (non-search). Raw live search via `blog-search.ts`. | Blog listing slots. | Cached `getBlogArticles({category, year, offset, limit, perspective, stega})`. The search path stays raw and published-only, so draft search results are published (acceptable, note in the audit). | Slot props. |
| `components/ui/StoreLocations/index.tsx:57-64,172` | Not Sanity: Nominatim in `geocodeAddress` (`'use cache'`, `'max'`) + fetch `force-cache`. | Brand page (Suspense) and product page (no Suspense). | Run `stegaClean(store.address)` before `geocodeAddress`, or stega characters poison the key and the Nominatim query. **In draft, Next bypasses `'use cache'`** (`use-cache.md:220-222`), so every draft render re-geocodes every store live (Nominatim allows about 1 req/s). Take an `isDraft` prop and skip geocoding (list only), or store coordinates on `store` docs. | `isDraft` prop from L3. |
| `global/seo.ts:81,107,113` (`getSEOMetadata`) | 3 × `sanityFetch` (404 fallback, default OG, home description). | Every gMD. | 3 × `sanityFetchMetadata`. | Pinned. |
| `components/schema/*` (Article, BlogPost, Brand, Breadcrumbs, CollectionPage, Faq, Organization; WebSite is constants-only) | Props only (draft data on the draft path). Rendered from pages, `components/ui/Breadcrumbs/index.tsx:34`, `components/pageBuilder/FaqSection/index.tsx:36`. | | **Published-only output:** call `stegaClean(props)` at entry of each schema component (idempotent, one line each). That also covers Breadcrumbs and FAQ JSON-LD. | n/a |
| `components/shared/analytics/ProductViewTracker` | Client tracker. | Product page `:226`, CPO page `:196`. | Render only when `!isDraft` (no Meta/GA events from editors). | `isDraft` from L3. |
| `components/shared/PageBuilder.tsx:50-69` | Props `pageBuilder, searchParams, basePath, indexOffset`. | Every CMS page. | Add `fetchOptions` (for ContactMap/CPO filter metadata), `slots` (CPO listing; drop the resolved-`searchParams` prop) and document id/type for `data-sanity` / optimistic reorder (D4). | Page L3. |

## 3. Root layout `app/layout.tsx`

**Today.** The whole layout is `'use cache'` (`:28`) and awaits `sanityFetch(querySettings)` (`:34-37`).
- It wraps `children` (`:70`), Header (`:67-69`), Footer (`:71`), Organization/WebSite JSON-LD (`:72-73`), CookieConsent + Analytics behind `IS_PRODUCTION_DEPLOYMENT` (`:74-79`), FloatingComparisonBox (`:80-82`) and Toaster.
- `draftMode()` can be read inside a cache scope (`use-cache.md:224`). `cookies()` cannot, so `getDynamicFetchOptions()` would throw there.

**Required changes:**
1. **Remove `'use cache'` at `:28`.** The layout becomes an uncached server component. That keeps it within the rule "never wrap `children` in `'use cache'`".
2. Add `const { isEnabled: isDraft } = await draftMode()` at the top.
   - During prerender `isEnabled` is `false`, so the static shell is the published branch. Najbar does exactly this and stays prerendered (01 §2.4).
   - A draft request carries `__prerender_bypass` and renders dynamically.
3. Remove the layout's own settings fetch. Two options:
   - make `OrganizationSchema` and a new `<GtmPreconnect/>` self-fetching published-only leaves (`sanityFetchPublished(querySettings)`, the same entry CookieConsent uses);
   - or call `sanityFetchPublished` directly in the layout. It has its own scope, so it does not make the layout dynamic.
   Render `<GtmPreconnect/>` only when `IS_PRODUCTION_DEPLOYMENT && !isDraft`.
4. Chrome dispatch:
   - Published: `<Header {...PUBLISHED}/>` (keep the existing Suspense) and `<Footer {...PUBLISHED}/>`.
   - Draft: `<Suspense fallback={null}><DynamicHeader/></Suspense>` and `<Suspense fallback={null}><DynamicFooter/></Suspense>`. Each awaits `getDynamicFetchOptions()` and renders the same cached leaf.
   - A small generic `DraftAware` helper avoids writing the pair twice.
5. Change `:74-79` to `IS_PRODUCTION_DEPLOYMENT && !isDraft && (<><CookieConsent/><Analytics/></>)`. That suppresses the banner, GTM and Meta inside the Presentation iframe.
6. Append `{isDraft && (<><PreviewBar/><VisualEditing basePath="" trailingSlash/><SanityLive includeDrafts/></>)}` inside `<body>`.
   - `trailingSlash` because `next.config.ts:72` sets it.
   - `PreviewBar` uses `next/dynamic` `ssr:false` (01 §2.7).
   - `SanityLive` never mounts for visitors.
7. `CartProvider`, `BotIdClient`, `FloatingComparisonBox` and `Toaster` stay as they are. The comparison box shows published data in draft via its action, which is acceptable.
8. **Verify:** `next build` route table shows no `ƒ` regressions (every CMS route still `○`/`◐`), and `next dev` cold load does not hang.

## 4. Server actions and route handlers (published-only)

| Call site | Today | Target helper | Note |
|---|---|---|---|
| `app/actions/product-quick-add.ts:82` | `sanityFetch` (tags `product`, `product:<slug>`) | `sanityFetchPublished` | Per tile click. Has its own scope, so it's safe in an action. |
| `app/actions/comparison.ts:39` `fetchComparisonProducts` | `sanityFetch` (tag `product`, never emitted) | `sanityFetchPublished` | Called from `FloatingComparisonBox` (layout). Sync tags fix the staleness. |
| `app/actions/comparison.ts:67` `fetchComparisonPageData` | `sanityFetchDynamic`, exported action | Not an action anymore. Cached `getComparisonPageData` (§1.1, shape D). Published in normal visits. | Closes the publicly invocable heavy query (04 §5.3). |
| `app/api/contact/route.ts:381` | `sanityFetch(queryContactSettings)` | `sanityFetchPublished` | |
| `global/mailchimp/subscribe.ts:46` (← `app/api/newsletter/route.ts`) | `sanityFetch`, tag `mailchimp-settings` (never emitted) | `sanityFetchPublished` | Sync tags fix the dead tag. |
| `app/produkty/[slug]/pliki/[pdfKey]/route.ts:21` | `sanityFetch` | `sanityFetchPublished` | |
| `app/recenzje/pdf/[slug]/route.ts:21` | `sanityFetch` | `sanityFetchPublished` | |
| `global/b2c/customer-transactional-email.ts:19` (← payment-confirmation, order-status, return emails) | `sanityFetch` | `sanityFetchPublished` | Runs at P24 webhook time. Must not throw outside a scope, which is why it uses the helper that owns its scope (04 §8). |
| `global/b2c/legal-documents/return-instructions.ts:19` | `sanityFetchDynamic` | `sanityFetchPublished` | Low volume. Sync tags keep it fresh. |
| `global/b2c/legal-documents/withdrawal-form.ts:40` (← `order-detail.ts`, `order-invoice.ts`, `formularz-odstapienia/route.ts`) | `sanityFetchDynamic` | `sanityFetchPublished` | |
| `global/b2c/admin/server/coupon-products.ts:222,225` (← `api/admin/coupons/products/route.ts`) | `sanityFetchDynamic` (whole catalogue) | Keep uncached published (rename `sanityFetchDynamic` → `sanityFetchUncachedPublished`) | Admin wants live data. Rare. |
| `global/b2c/cart/server/revalidation.ts:71,137` | `sanityFetchFresh` | **Unchanged** | Correctness (04 §8). |
| `global/b2c/checkout/server/cpo-availability.ts:210,226` | Raw write client | **Unchanged** | Keep `revalidateTag('cpoProduct'…)` (`:234-242`) and the matching explicit `cacheTag`s (§1.1). |
| `app/api/analytics/meta/route.ts:135` | Raw client per event | **No Sanity** (D9: env var) | |
| `app/api/newsletter/generate/route.ts:239,604`, `app/podglad/newsletter/route.ts`, `app/api/revalidate/route.ts`, `global/sanity/operator-auth.ts`, `global/b2c/admin/server/auth.ts`, `global/sanity/blog-search.ts`, `scripts/generate-redirects.ts` | Raw clients | **Unchanged** (base client stays `stega:false`) | 04 §7.3. |

## 5. Stega breakage on draft paths (maps 05 §3 to the files that receive draft data)

Background: stega's `filterDefault` already skips the following, so `"slug": slug.current` projections are safe:
- `slug.current`;
- keys starting with `_` or ending in `Id`;
- any path through `seo` / `openGraph` / `metadata`;
- type-like keys (`productType`, `filterType`, `destinationType`);
- denylist leaves (`href`, `link`, `email`, `variant`, `layout`, `status`, …).

The leaf-name filter (D4) must **compose with** `filterDefault`, not replace it. A full replacement would re-expose the type-like keys.

| File:line receiving draft data | Breakage | Fix |
|---|---|---|
| `app/produkty/(listing)/kategoria/[category]/page.tsx:201-217,260-273` | `customFilters[].name` → `slugifyFilterName` → URL param names, and `validateCustomFilters` matching against URL values. | `stegaClean(filterDefinitions)` in L3 before it leaves. |
| `components/products/ProductsListing/index.tsx:107-116,134-138,191-192` | Filter names go into GROQ params `customFilters`/`rangeFilters` and are compared to stored `filterName`, so the draft listing comes back **empty**. | Receives cleaned definitions (above). |
| Filter metadata consumers: `app/marki/[slug]/page.tsx:183-184` (`p.brandSlug === slug`), `components/products/ProductsListing/index.tsx:161-169` (search ranking over `name`, `brandSlug`, `allCategorySlugs`), `ProductsAside`, `CustomFiltersBar` | `denormBrandSlug`, `denormCategorySlugs`, `denormBrandName` and `customFilterValues[].filterName/value` are not in the default denylist (`global/sanity/query.ts:1786-1797`). | Fetch filter metadata (product and CPO) with `stega:false` always. It is logic data and is never overlaid. |
| `global/b2c/utils/buyability.ts:133` (`availabilityStatus !== 'available'`) ← `certyfikowany-sprzet-uzywany/[slug]/page.tsx:138-143` | In draft, every CPO item looks unbuyable. | Add `availabilityStatus` to the leaf filter. |
| `components/products/ProductHero/PricingSection.tsx:176`, `components/cpo/CpoProductHero/CpoProductInquirySection.tsx:118` | `addLine()` builds cart lines from draft page props, so stega'd names get persisted to the cart in localStorage. Tile quick-add is safe: it uses the published action result (`components/ui/ProductCard/ProductCardAddToCart.tsx:133`). | `stegaClean` the line before `addLine`, or disable add-to-cart when `isDraft`. Confirm that checkout order lines come from the `sanityFetchFresh` snapshots and not from client names (B2C isolation suite, D4). |
| `components/pageBuilder/FaqSection/index.tsx:25-29` (`displayMode`), `components/ui/PublicationCard/index.tsx:86` (`layout`), `components/ui/Button/Button.tsx:48` (`variant`) | Enum compares. `layout`/`variant` are default-skipped; `displayMode` is **not**. | Add `displayMode` to the leaf list. Keep `filterDefault` composed. |
| `components/ui/Footer/index.tsx:30` | `iconString` SVG markup in `dangerouslySetInnerHTML`. | Leaf filter. |
| `components/pageBuilder/ContactMap/index.tsx:72-75` | `tel:` href. | Clean for the href, or put `tel` on the leaf list. |
| `components/ui/StoreLocations/index.tsx:194-200` | Address strings go into the geocode cache key and the Nominatim query. | `stegaClean` (§2). |
| JSON-LD (`components/schema/*`) and metadata (`global/seo.ts`) | Head and crawlable output. | Schema `stegaClean` (§2). Metadata is pinned (`sanityFetchMetadata`). |
| `id` attributes from CMS (05 §3 list, e.g. `components/ui/TwoColumnContent/index.tsx`, `components/ui/ProductGallery/index.tsx`) | Anchor targets and `PillsStickyNav`. | Pages pass literal `customId`s for detail sections. Only CMS-sourced `customId`/`sectionId` need the leaf filter (05 §3). |

## 6. Static params: prerender all slugs in production

### 6.1 `global/build.ts` change

Today `shouldLimitBuildTimeStaticParams()` (`:1-11`) returns `true` for **every** `next build`, because `NODE_ENV === 'production'`. `limitBuildTimeStaticParams` then slices to 1 (`:38`). Only brands bypass this, via `allBuildTimeStaticParams` (`marki/[slug]/page.tsx:117`).

Target (D5 removes previews):
```ts
export function shouldLimitBuildTimeStaticParams() {
  if (process.env.LIMIT_BUILD_TIME_STATIC_PARAMS === '0') return false;
  if (process.env.LIMIT_BUILD_TIME_STATIC_PARAMS === '1') return true;
  return process.env.VERCEL_ENV !== 'production'; // local/CI builds keep 1 row per family
}
```

The changes that follow from it:
- **Placeholder fallback.** Pass `{slug:'__placeholder__'}` / `{category:'__placeholder__'}` to **every** gSP. cacheComponents errors on an empty gSP, and only `marki/[slug]` and the CPO route pass it today.
- **Category gSP.** Stop deriving it from the 190 KB filter metadata (`kategoria/[category]/page.tsx:113-123`).
- **Build hardening, as in lsse (02 §4):**
  - `experimental.staticGenerationRetryCount: 1`;
  - `experimental.staticGenerationMaxConcurrency: 4` (both keys exist in Next 16.3.2's config schema);
  - keep `staticPageGenerationTimeout: 180`.
- **Product-page Nominatim.** Wrap product-page `StoreLocations` in Suspense first. Otherwise, prerendering about 866 product pages puts Nominatim in each shell (`produkty/[slug]/page.tsx:288-290`), and the per-address `'use cache'` is per worker.
- **Category and CPO shells.** Prerendering all categories is only worthwhile after the shape-B restructure. Until then those routes prerender just `loading.tsx` (§1.1).

### 6.2 Estimated build-time prerender set (from the GROQ, not from Sanity)

| Route | gSP query (filter) | Estimate | Source of estimate |
|---|---|---|---|
| `produkty/[slug]` | `queryAllProductSlugs` (`query.ts:2524`): all products with a slug, **including archived** | ~866 | 04 §3.3 |
| `recenzje/[slug]` | `queryAllReviewSlugs` (`:1405`): `destinationType == "page"` | ~347–350 | `.ai/review-migration-implementation-plan.md:21,503`; `.ai/legacy-redirect-implementation-plan.md:35` |
| `produkty/kategoria/[category]` | every `productCategorySub` with a slug | ~42 | 04 §5.1 |
| `marki/[slug]` | `queryAllBrandSlugs` (`:2378`) | ~41 (already all) | 04 §3.3 |
| `blog/[slug]` | `queryAllBlogPostSlugs` (`:1360`) | ~20–60 (12 migrated in 2025 + new) | `.ai/legacy-redirect-implementation-plan.md:664`, `.ai/embeddings-search-implementation-plan.md:886` |
| `certyfikowany-sprzet-uzywany/[slug]` | `queryAllCpoProductSlugs` (`:1338`): internal, not archived | ~5–40 (unknown) | n/a |
| `blog/kategoria/[category]` | categories with `count > 0` | ~3–10 | n/a |
| `[slug]` | `queryAllPageSlugs` (`:1045`, no `defined(slug)` filter; the gSP filters in JS) | ~5–15 | n/a |
| Static singletons | `/`, `/produkty/`, `/marki/`, `/blog/`, `/certyfikowany-sprzet-uzywany/`, legal ×2, archives ×2, `/koszyk/`, `/porownaj/` (shell) | ~12 | n/a |
| **Total** | | **~1,350–1,450 pages** (today about 55) | |

**Build cost per production deploy (D10 one-request variant), published path:**
- Sanity requests are roughly 2 unique per detail page (page + SEO query). Shared entries (settings, OG, inquiry form, brand stores per brand) are cached once per worker. That totals about **2.7–3k Sanity API CDN requests**.
- About **866 Supabase pricing queries**.
- Nominatim calls bounded by distinct dealer addresses.
- ISR writes: about 1.4k entries per deploy. That is the cost `marki/[slug]/page.tsx:108-116` warned about. Weigh it against today's post-deploy first-hit cost (04 §6.11).
- Collapsing each detail SEO query into the page data function (the brand-page trick, §1.1) halves the Sanity requests.

## 7. `next.config.ts` cacheLife target

**Today** (`next.config.ts:20-46`): `default`, `hours`, `days`, `weeks` and `max` are all overridden to 30 days (`max`/`default` expire after 1 year). 17 `cacheLife(...)` call sites rely on that:
- `'weeks'`: listing helpers, pricing;
- `'max'`: `[slug]`, geocode;
- `'hours'`: CPO filter metadata;
- `'seconds'`/`'minutes'`: in `fetch.ts:81-86` and `global/supabase/queries.ts:44-46`.

**Target:**
```ts
import { sanity } from 'next-sanity/live/cache-life'; // = { revalidate: 31_536_000 } (node_modules/next-sanity/dist/live/cache-life.js)
cacheLife: {
  default: { stale: 2592000, revalidate: 2592000, expire: 31536000 }, // keep: un-profiled scopes (Header/Footer today) stay 30 d
  sanity,                                                              // stale + expire inherit from `default` at call time → {30 d, 1 y, 1 y} = lsse prod profile
  pricing: { stale: 2592000, revalidate: 2592000, expire: 2592000 },   // global/supabase/queries.ts:47 (was 'weeks'); drop the dev 'seconds' branch :44-46
  geocode: { stale: 2592000, revalidate: 31536000, expire: 31536000 }, // components/ui/StoreLocations/index.tsx:64 (was 'max'); dealer addresses rarely change
}
```

- **Inheritance.** Omitted fields inherit from `default` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md:213`).
  - Keep `default.expire ≥ sanity.revalidate` (1 y). Next only validates `revalidate ≤ expire` on user-written profiles (`node_modules/next/dist/server/use-cache/cache-life-profile.js`), so a later shrink of `default.expire` would silently cap it.
- **Remove the `hours` / `days` / `weeks` / `max` overrides** once the call sites are converted:
  - every Sanity scope becomes `'sanity'` (including `[slug]/page.tsx:77`, `CpoProductsListing/index.tsx:47`, and all `getStatic*`/`getPageContent` helpers, which disappear into L3 or cached data functions);
  - the non-Sanity scopes become `pricing` / `geocode`.
  - This removes the "`'hours'` means 30 days" trap.
- **Pricing tag.** Keep `cacheTag('product-pricing', 'product-pricing:'+slug)` on `fetchProductPricing`. It is also called by `app/actions/cart-pricing.ts:21`, `app/actions/product-quick-add.ts:81` and `global/b2c/cart/server/revalidation.ts:69`, so it cannot fold into the product L3.
  - Today **only `/api/revalidate` emits `product-pricing:<slug>`** (`app/api/revalidate/route.ts:141`). Sync tags will refresh the product L3, but the nested pricing entry stays stale.
  - So the slimmed post-cutover revalidate endpoint, or the price-sync job, must keep emitting `product-pricing:<slug>`. **Do not lose this when retiring the webhook (Phase 3).**
- **Dev.** Optional `sanity` dev override `{stale: 0, revalidate: 1, expire: 2592000}` (lsse dev profile) so published edits show locally without a Function.
  - The Najbar dev-hang needed a cached shell wrapping `children`, which this design removes.
  - Otherwise, use draft mode locally.
- **Nominatim fetch.** It carries `next.revalidate: 86400` under a `'max'` scope (`StoreLocations/index.tsx:72-82`). Align it with `geocode` or drop it, because the `'use cache'` entry governs.

## 8. Open points for the plan

1. **Shape-B slot vs `next dev`.** Prove the pass-through slot on `/produkty/` first. If dev hangs, fall back to sibling cached leaves.
2. **Leaf-name filter list.** It must compose with `filterDefault`. Minimum additions from §5: `availabilityStatus`, `displayMode`, `iconString`, `tel`, plus CMS `customId`/`sectionId`. Filter metadata stays `stega:false` by design.
3. **ContactMap.** Fold settings into the block projection (removes a self-fetch), or thread `fetchOptions`.
4. **Draft geocoding policy for `StoreLocations`.** Skip it, or persist coordinates on `store`.
5. **Metadata dedupe.** Brand-style shared cached data functions vs separate `*SeoBySlug` queries via `sanityFetchMetadata`. This trades about 1k build requests against simplicity.
6. **`/porownaj` draft support** for `comparatorConfig` (shape D) or published-only.
