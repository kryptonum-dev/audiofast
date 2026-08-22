# Rendering & Revalidation — Research Dossier (August 2026)

> **Status:** research complete, nothing implemented. Written 2026-08-22 against branch `chore/deps-overhaul`.
>
> **Why this exists:** the client (Jarek) reported ~8 s load times on brand pages. The investigation
> covered four areas — current architecture, Next.js 16 best practice, how the sibling repos
> (`Najbar`, `kryptonum-starter`) do revalidation, and Sanity's own official guidance. This file is
> the durable record so future agents don't re-run the research.
>
> **Supersedes in part:** `.ai/caching-revalidation-plan.md` (documents what was built; several of its
> assumptions are now measured rather than assumed). Related: `.ai/isr-cost-reduction-strategy-v2.md`,
> `.ai/ppr-products-listing-implementation.md`, `.ai/ppr-blog-listing-implementation.md`.

---

## 0. TL;DR for the next agent

1. **The 8 s is one dead GROQ fragment.** `productsFilterMetadataFragment()` is injected into
   `queryBrandBySlug` at `apps/web/src/global/sanity/query.ts:2330`, costs 5–6 s, and **nothing reads
   its output**. Deleting it is behaviour-neutral. → §2.
2. **The brand route is already correct PPR.** `cacheComponents: true`, `PARTIALLY_STATIC` in the
   build manifest, zero route-segment config exports in `apps/web/src`, `searchParams` correctly
   deferred into a Suspense boundary. Do **not** "fix" the rendering shape — it isn't broken. → §3.
3. **Brand shells are kept permanently cold** by an over-broad tag map, so the 30-day `cacheLife`
   never applies. → §2.2.
4. **The house standard for new projects is `defineLive` (next-sanity 13, `strict: true`) + a Sanity
   Function** that relays sync tags to a revalidation endpoint. It is worth adopting here, but it is
   **not** the fix for the 8 s. → §5, §6.
5. **Do not copy the siblings' `expire: 0` blindly** — their own rule makes it conditional, and
   audiofast falls on the other side of it. → §6.4.

---

## 1. Versions in play (verified from disk / lockfiles, 2026-08-22)

| | audiofast `apps/web` | Najbar `apps/web` | kryptonum-starter `apps/web` |
|---|---|---|---|
| `next` | **16.3.2** | 16.2.12 | 16.2.12 |
| `react` / `react-dom` | 19.2.8 | 19.2.8 | 19.2.8 |
| `next-sanity` | **13.x** | 13.2.2 | 13.2.2 |
| `cacheComponents` | ✅ true | ✅ true | ✅ true |
| `partialPrefetching` | ❌ **not set** | n/a (16.3-only) | n/a (16.3-only) |
| `defineLive` | ❌ not used | ✅ `strict: true` | ✅ `strict: true` |
| Sanity Functions | ❌ none | ✅ | ✅ |

**audiofast is the only one of the three on 16.3**, so it is the only one that can use
`partialPrefetching` and the 16.3 "App Shell for unlisted params". Don't assume sibling-repo
configs transfer 1:1 — they're a minor version behind.

---

## 2. Current state — measured findings

### 2.1 Root cause of the 8 s (CRITICAL)

`apps/web/src/global/sanity/query.ts:2330` injects `${productsFilterMetadataFragment()}`
(defined at `query.ts:1800-1965`) into `queryBrandBySlug`.

That fragment executes roughly **129 full scans of the 866-product collection** —
(2 × 42 subcategories) + 41 brands + 4 aggregates — each carrying a live join
`brand->doNotShowBrand != true` (`query.ts:1817, 1851, 1866, 1895, 1918, 1932, 1952`).
Approximately 110,000 dereference evaluations per page load.

**Measured against production Sanity (project `fsw3likv`, 866 products, 41 brands), cold CDN:**

| brand | products | Sanity server ms |
|---|---|---|
| shunyata-research | 67 | 6236 |
| synergistic-research | 96 | 6159 |
| goldenear | 40 | 5465 |
| taiko-audio | 1 | 5202 |
| vibrapod | 2 | 4995 |
| dutchdutch | 1 | 4922 |
| **same query, fragment removed** | — | **1–7** |

The **flatness** (1 product costs the same as 96) is the diagnostic signature and matches Jarek's
report exactly: the fragment scans the whole catalogue regardless of which brand was requested.

**It is dead code.** `apps/web/src/app/marki/[slug]/page.tsx:70-79` passes deliberately neutral
filters with the inline comment *"Pass empty filters - we don't need filtered counts for PPR"*, and
nothing in the render tree reads `categories`, `categoriesAll`, `brands`, `totalCount`,
`totalCountAll`, `maxPrice` or `minPrice` off the brand object. The filter sidebar is built from a
separate query (`getStaticFilterMetadata` → `queryAllProductsFilterMetadata`).

### 2.2 Over-invalidation keeps brand shells cold (HIGH)

- `apps/web/src/app/api/revalidate/route.ts:288` — `TYPE_DEPENDENCY_MAP`:
  - `product: ['products', 'homePage']`
  - `brand: ['brands', 'products', 'brand']`
- `apps/web/src/app/marki/[slug]/page.tsx:88` — `getStaticFilterMetadata()` carries
  `cacheTag('products', 'brands')`, and it is awaited in the **same `Promise.all` as the brand
  query**, i.e. it gates the static shell.
- `apps/web/src/app/api/revalidate/route.ts:533` — `revalidateTag(tag, { expire: 0 })`.

Net effect: **any** product publish (including automated price-sync patches) expires the `products`
tag → all 41 brand shells go cold; **any** single brand edit expires `brand` + `products` → same
result. With `expire: 0` there is no stale-while-revalidate, so the next visitor blocks on a full
regeneration and pays §2.1 in full. The 30-day `cacheLife` in `next.config.ts:14-44` never applies.

> ⚠️ **Correction to an earlier reading:** `expire: 0` is *not itself* the defect — it is what Sanity's
> canonical example and both sibling repos use, deliberately. The defect is **tag breadth**.
> `expire: 0` on a narrow tag blocks one page; on `products` it blocks 41. See §6.4 for the rule.

### 2.3 Only one brand is prerendered at build (MEDIUM)

`apps/web/src/global/build.ts:29` → `return params.slice(0, 1);`, active whenever
`NODE_ENV === 'production'` (`build.ts:7`) unless `LIMIT_BUILD_TIME_STATIC_PARAMS=0` is set.
Confirmed in build output: `.next/server/app/marki/` contains exactly one prerendered brand
(`oladra.html`). The other 40 render on demand on first request.

**This helper is used by every `generateStaticParams` in the app** — products, blog, reviews,
categories, CPO. Raising it is only safe *after* §2.1 is fixed: 41 brands × 5.5 s would exceed the
`staticPageGenerationTimeout: 180` in `next.config.ts:47`.

### 2.4 `partialPrefetching` not enabled (MEDIUM)

Next 16.3 added an **App Shell for params not returned by `generateStaticParams`** — long-tail pages
get an instant shell instead of a blocking full server render. It is gated behind
`partialPrefetching: true` (which requires `cacheComponents`). Without it, `<Link prefetch="auto">`
on a **dynamic** route prefetches only down to the nearest `loading.js` boundary — and there is no
`loading.tsx` on the brands path, so a menu click prefetches essentially nothing.

Docs are explicit: *"The App Shell for unlisted params is served from Next.js 16.3. Earlier versions
wait for a full server render before sending the response."*

### 2.5 Smaller drags (LOW)

- `page.tsx:165-166` — `queryAllProductsFilterMetadata` fetches all 866 products (~190 KB,
  376 ms cold / ~90 ms warm) then filters to one brand in JS.
- `page.tsx:122-126` — `generateMetadata` refetches the same brand document **uncached**
  (no `use cache` wrapper). Latent bug at `query.ts:2676`: `openGraph.ogImage.asset->url` is used
  while already scoped inside `openGraph {}`, so `seoImage` is always null.
- `components/.../StoreLocations/index.tsx:55-67, 173` — geocodes via OpenStreetMap Nominatim with
  no `use cache` and no Suspense boundary; up to 27 stores for some brands, 115–240 ms each,
  parallel via `Promise.allSettled`.
- `denormFilterKeys` is populated by the Studio but **never read by any query** — custom-filter
  matching still uses correlated `customFilterValues[...]` subqueries. Unfinished optimisation.

---

## 3. What is already correct — do not "fix" this

The initial hypothesis was that brand pages needed converting to a static shell with a suspended
listing. **They already are.** Evidence:

- `apps/web/next.config.ts:6` — `cacheComponents: true`.
- `.next/prerender-manifest.json` — `/marki/[slug]` → `"experimentalPPR": true`,
  `"renderingMode": "PARTIALLY_STATIC"`, `"routeType": "fallback"`.
- **Zero** route-segment config exports anywhere in `apps/web/src` (no `dynamic`, `revalidate`,
  `fetchCache`, `runtime`, `dynamicParams`, `experimental_ppr`).
- No `cookies()` / `headers()` / `draftMode()` / `connection()` / `after()` in the root layout or
  anything it renders.
- `searchParams` is **not** awaited in the page body — passed as an unawaited promise into
  `<ProductsListing>` inside `<Suspense>` (`marki/[slug]/page.tsx:267-275`) and awaited there
  (`ProductsListing/index.tsx:64`).
- `proxy.ts:33-39` short-circuits for `/marki/*`.

**Consequence:** deferring `searchParams` further recovers nothing on this route. Everything above
the Suspense boundary is one `await Promise.all`, and that promise waits on the 5.5 s query.

### 3.1 Data-flow shape (for orientation)

```
BrandPage({ params, searchParams })
  await params                                    // page.tsx:145
  await Promise.all([                             // page.tsx:148 — parallel, both `use cache`
     getBrandContent(slug)       ~5-6 s  ← §2.1 BOTTLENECK
     getStaticFilterMetadata()   ~0.4 s  ← §2.5, tagged `products` → §2.2
  ])
  <main>
    <BrandSchema/> <Breadcrumbs/> <HeroStatic/> <PillsStickyNav/>      // sync
    <ProductsLoadingProvider><section id="produkty">
       <ProductsAside …/>  <SortDropdown/>                             // client, sync props
       <ProductsListingContainer>
         <Suspense fallback={<ProductsListingSkeleton/>}>              // ✅ correct
            <ProductsListing searchParams={searchParams} …/>           // awaits INSIDE
         </Suspense>
    </section></ProductsLoadingProvider>
    <Image/> <TwoColumnContent/> <FeaturedPublications/>
    <StoreLocations/>   // ← §2.5 N× OSM fetches, no Suspense, no `use cache`
  </main>
```

### 3.2 Config inventory (as audited)

- `next.config.ts`: `reactCompiler: true` (:5), `cacheComponents: true` (:6), **all `cacheLife`
  profiles overridden to ~30-day stale/revalidate** (:14-44), `enablePrerenderSourceMaps: false`
  (:46), `staticPageGenerationTimeout: 180` (:47), `experimental.inlineCss: true` (:49),
  `trailingSlash: true` (:74), wrapped in `withBotId`.
  > ⚠️ Because `default`/`hours`/`days`/`weeks`/`max` are all redefined to ~30 days,
  > `cacheLife('hours')` **does not mean hours** in this repo. Docs warn this surprises readers.
- **13 `use cache` sites:** `layout.tsx:28`; `marki/[slug]/page.tsx:64,87`;
  `produkty/(listing)/page.tsx:47`; `produkty/(listing)/kategoria/[category]/page.tsx:85,97`;
  `blog/(listing)/page.tsx:29`; `blog/(listing)/kategoria/[category]/page.tsx:47,60`;
  `[slug]/page.tsx:76`; `components/ui/Header/index.tsx:8`; `components/ui/Footer/index.tsx:13`;
  `components/pageBuilder/ProductsListing/index.tsx:35`;
  `components/pageBuilder/CpoProductsListing/index.tsx:45`; plus shared `sanity/fetch.ts:65` and
  `supabase/queries.ts:39`.
- **Sanity client** (`sanity/client.ts:48-55`): `useCdn: IS_PRODUCTION_DEPLOYMENT`,
  `perspective: 'published'` in prod, no token in prod. **This is correct** — prod uses `apicdn`
  with no stega and no draft perspective. All reads go through `sanityFetch` (`fetch.ts:56`) =
  `'use cache'` + `cacheTag(...)` + `cacheLife('weeks')`.
- **Supabase is not on the brand path at all.** `supabase/queries.ts:42` is per-product-slug pricing,
  PDP only. No N+1 on brand pages.
- `vercel.json`: only `{"build":{"env":{"VERCEL_PRERENDER_METADATA_BOUNDARY":"1"}}}`. No cron, no warming.

---

## 4. Next.js 16.3.2 — API facts that contradict common/stale knowledge

Verified against nextjs.org docs stamped `version: 16.3.2` (exact match for `apps/web`).

1. **`revalidateTag(tag)` single-arg is DEPRECATED.** It now takes a required second profile
   argument: `revalidateTag('products', 'max')` or `revalidateTag(tag, { expire: 0 })`.
2. **`cacheComponents` subsumes PPR.** `experimental.ppr`, `experimental_ppr`,
   `experimental.dynamicIO`, `experimental.useCache` are all **removed**. `unstable_cacheLife` /
   `unstable_cacheTag` are stabilised as `cacheLife` / `cacheTag` from `next/cache`.
3. **`dynamicParams` is a build error** under `cacheComponents`. So is
   `generateStaticParams` returning `[]` (`empty-generate-static-params`). Route-segment
   `dynamic` / `revalidate` / `fetchCache` all throw.
4. **`io()` (new in 16.3, `next/cache`) is now the preferred dynamic marker over `connection()`.**
   Docs: *"Prefer `io()` over `connection()`, and reach for `connection()` only when you need to wait
   for a real user request"* — `connection()` also blocks prefetches.
5. **`updateTag` is Server-Actions-only** and throws in Route Handlers. `expireTag` does not exist.
   So a webhook route handler has exactly one legal API: `revalidateTag(tag, profile)`.
6. **`use cache` is not a durable data cache on serverless.** Default handler is a per-instance
   in-memory LRU; entries typically do not persist across requests, and **nothing survives a deploy**
   (build ID is in the cache key). It primarily fills the prerender shell and prefetch.
   `'use cache: remote'` is the durable variant.
7. **Built-in `cacheLife` profiles** — `default` (5 min stale / 15 min revalidate / never expire),
   `seconds`, `minutes`, `hours`, `days`, `weeks`, `max` (5 min / 30 days / 1 year).
   Thresholds that silently make a route dynamic: `revalidate: 0` or `expire < 5 min` → excluded
   from prerenders; `stale < 30 s` → excluded from prerenders; `stale` 30 s–5 min → in prerender but
   **excluded from the App Shell**.
8. **Cache tag limits:** 128 tags per `cacheTag()` call, 256 chars per tag. Vercel: 128 tags per
   cache item; on-demand revalidation propagates to all regions within ~300 ms.
9. **The canonical static-shell pattern** — never `await` `params`/`searchParams`/`cookies()` at the
   top of a page or (worse) a layout. Pass the promise into a `<Suspense>`-wrapped child:

   ```tsx
   export default function SearchPage(props: PageProps<'/search'>) {
     return (
       <Suspense fallback={<p>Loading results...</p>}>
         <Results searchParams={props.searchParams} />
       </Suspense>
     )
   }
   async function Results({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
     const { q } = await searchParams
     // …
   }
   ```
   Docs stress this **even for params covered by `generateStaticParams`**: *"A statically known param
   still belongs to one URL, so awaiting it above the Suspense boundary would tie this layout's App
   Shell to that URL."*
10. **Bots/crawlers bypass the static shell entirely** — detected by UA, full dynamic render at
    request time.
11. **`experimental.clientSegmentCache` could not be verified** — no page in the 16.3.2 docs, absent
    from the 16.0/16.3 release notes and upgrade guide. Appears absorbed into the default routing
    rewrite. If it's in a config somewhere, remove and verify against `next build`.

---

## 5. The sibling-repo standard — `defineLive` + Sanity Functions

Both `Najbar` and `kryptonum-starter` run the same architecture. This is the reference
implementation for new Kryptonum projects.

### 5.1 The mechanism (read out of `next-sanity@13.2.2` dist)

`defineLive`'s `sanityFetch` makes **two Content Lake round trips per call**:

```js
const client = _client.withConfig({
  allowReconfigure: false, useCdn: true, perspective: 'published', stega: false,
})
// FETCH #1 — sync tags only
const {syncTags} = await client.fetch(query, params, { /* …, resultSourceMap:false */ })
const cacheTags = [...tags, ...(syncTags?.map(t => `sanity:${t}`) ?? [])]
// FETCH #2 — the real read, TAGGED
const {result, resultSourceMap} = await client.fetch(query, params, {
  next: { revalidate: false, tags: cacheTags }, /* … */
})
```

Three consequences:
1. **Two round trips is the price** of automatic tag registration.
2. Tags reach Next via `fetch(..., { next: { tags } })`, which under `cacheComponents` tags the
   **enclosing `use cache` entry**. Outside a cache scope in a dynamic render it **throws** — hence
   the house rule *"`sanityFetch` must be called inside a `'use cache'` scope"*.
3. `revalidate: false` — the fetch layer never time-revalidates. **All freshness is tag-driven.**

**There is no hand-maintained tag taxonomy, and that is the point.** Sanity emits the tags each
query actually read. This replaces `TYPE_DEPENDENCY_MAP` + reverse-lookup wholesale.

### 5.2 `strict: true` is what keeps pages static

- `strict: false` (the old default, and what most stale documentation describes): `<SanityLive>` is
  **async and awaits `draftMode()`**, and `sanityFetch` auto-resolves perspective/stega from
  `draftMode()` + `cookies()`. **This does force dynamic rendering.**
- `strict: true`: `<SanityLive>` is a **synchronous** server component calling no dynamic API, and
  `sanityFetch` never touches `draftMode()`/`cookies()`. Routes prerender fully into the static shell
  **and still receive live updates**, because the update path is client SSE → server action → tag
  invalidation, not server-side dynamism.

The cost: `perspective`/`stega` must be resolved **outside** any cache scope and threaded in as plain
serializable props. That forces the **three-layer dispatcher** on every `page.tsx`:

```tsx
// LAYER 1 — uncached, branches on draftMode only
export default async function Page({ params }: PageProps<'/[slug]'>) {
  const { isEnabled: isDraft } = await draftMode()
  if (isDraft) return <Suspense fallback={<Fallback/>}><DynamicPage params={params} /></Suspense>
  const { slug } = await params
  return <CachedPage slug={slug} perspective="published" stega={false} />
}
// LAYER 2 — reads cookies, OUTSIDE any cache scope
async function DynamicPage({ params }) {
  const [{ slug }, { perspective, stega }] = await Promise.all([params, getDynamicFetchOptions()])
  return <CachedPage slug={slug} perspective={perspective} stega={stega} />
}
// LAYER 3 — the cache boundary; plain serializable props only
async function CachedPage({ slug, perspective, stega }) {
  'use cache'; cacheLife('sanity')
  const { data } = await sanityFetch({ query: PAGE_QUERY, params: { slug }, perspective, stega })
  if (!data) notFound()   // data-dependent notFound lives HERE
  return <article>{/* … */}</article>
}
```

### 5.3 The Sanity Function (the piece to port)

`sanity.blueprint.ts` **must live at the repo root** next to the lockfile — the CLI resolves each
resource's `src` and the dependency lockfile relative to it. Functions live in their own workspace
with their **own `package.json`** (root deps are not visible to function bundles).

```ts
// sanity.blueprint.ts (repo root)
import { defineBlueprint, defineSyncTagInvalidateFunction } from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineSyncTagInvalidateFunction({
      name: 'invalidate-sync-tags',
      src: './apps/functions/invalidate-sync-tags',
      event: { resource: { type: 'dataset', id: '<projectId>.production' } },
    }),
  ],
})
```

```ts
// apps/functions/invalidate-sync-tags/index.ts
import { syncTagInvalidateEventHandler } from '@sanity/functions'

export const handler = syncTagInvalidateEventHandler(async ({ event, done }) => {
  const { syncTags } = event.data ?? {}
  if (!Array.isArray(syncTags)) throw new Error('Sync-tag event carried no syncTags array')

  const endpoint = process.env.REVALIDATE_ENDPOINT_URL
  const secret = process.env.SANITY_REVALIDATE_TAGS_SECRET
  if (!endpoint || !secret) throw new Error('Missing REVALIDATE_ENDPOINT_URL / SANITY_REVALIDATE_TAGS_SECRET')

  const res = await fetch(`${endpoint}?secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tags: syncTags }),
  })
  if (!res.ok) throw new Error(`Revalidate endpoint responded ${res.status}`)

  // done() releases waitFor='function' subscribers. Log, don't throw — the work already happened.
  try { await done(syncTags) } catch (e) { console.error('ack failed', e) }
})
```

```ts
// app/api/revalidate-tags/route.ts  — auth via timingSafeEqual on a ?secret= query param
for (const tag of tags) {
  revalidateTag(`sanity:${tag}`, { expire: 0 })   // see §6.4 before copying expire: 0
}
```

Sync-tag wire format is `s1:example` → becomes the Next cache tag `sanity:s1:example`.

**Deployment order is a gate, not a preference:**

```bash
bunx sanity blueprints init --project-id <id> --stack-name <slug> --blueprint-type ts
bun run blueprints:deploy      # BEFORE the env, never after
bunx sanity functions env add invalidate-sync-tags REVALIDATE_ENDPOINT_URL https://<host>/api/revalidate-tags/
bunx sanity functions env add invalidate-sync-tags SANITY_REVALIDATE_TAGS_SECRET <secret>
```

`functions env add` addresses a function **by name on the remote stack** — run before
`blueprints deploy` it answers `Error: Unknown error`, writes nothing, and looks like success.
Env changes apply on the next invocation, no redeploy. `.sanity/blueprint.config.json` must be
git-tracked — losing it and re-running `init` mints a duplicate stack, and a project is capped at 3.

### 5.4 Hard-won gotchas from the siblings (each one failed silently)

- **Trailing slash is load-bearing.** With `trailingSlash: true`, a slashless POST gets a 308 that
  **drops the request body** — the Function logs success for an invalidation that never arrived.
- **Never wrap the App Router `children` slot in `'use cache'`** — it hangs `next dev`. Measured in
  Najbar: all three test routes hung past 60 s on every hit; after the fix, cold 9.0 / 2.0 / 5.7 s,
  warm 0.16–0.67 s. Mechanism: a dev `stale: 0` profile sits below Next's
  `RUNTIME_PREFETCH_DYNAMIC_STALE` (30 s), so the enclosing shell is classed
  runtime-prefetch-dynamic and feeds the whole route tree into the blocking cache-miss restart path.
- **The `sanity:` prefix is unversioned coupling** — written in next-sanity internals *and* in the
  route handler, connected by no import. A mismatch **expires nothing and still answers 200**.
  Pin `next-sanity` and re-verify on every bump.
- **`'use client'` components cannot import `SanityLive`** — the client-condition `./live` entry
  throws `defineLive can't be imported by a client component`.
- **Never regenerate half of the shared secret.** Vercel won't hand a Sensitive value back, so a 200
  from the round-trip is the only proof the halves still match.
- Intra-function imports must be `./urls.js` from files that are `.ts` on disk (`"type": "module"`).
- Changing a blueprint resource's `name` **deletes the old resource and creates a new one**. Run
  `blueprints plan` first.
- Avoid **multiple sync-tag-invalidate functions per dataset** (race conditions).

---

## 6. Sanity's official guidance (fetched 2026-08-22)

### 6.1 What Sanity recommends

From `/docs/nextjs/introduction` and `/docs/nextjs/caching-and-revalidation-in-nextjs`, `defineLive`
is *"the recommended approach for most Next.js applications"*, with manual strategies positioned as
what you use *"for fine-grained control or static sites"*.

| | Approach | Position | Notes |
|---|---|---|---|
| **(c)+(b)** | `defineLive` + Sync Tag Invalidate Function → `/api/revalidate-tags` | **The recommendation** — paired, not either/or | No tag bookkeeping; correct with zero visitors |
| (c) | `defineLive` alone | Supported but **v13 explicitly degraded it** | Nothing revalidates when nobody is watching |
| (a) | GROQ webhook → `revalidateTag` | Still documented as the fine-grained alternative | **What audiofast has today** |
| (d) | Time-based ISR | **Actively discouraged** | *"caused many unnecessary ISR writes"* — the stated reason `fetchOptions` was deleted in v13 |

Hard rule from the manual-caching docs: *"Tags and time-based revalidation are mutually exclusive"* —
supplying `tags` disables the timer entirely.

### 6.2 A webhook/endpoint is still required

next-sanity 13 **removed `fetchOptions`** (the time-based fallback) and downgraded its default
liveness. Sanity's own words:

> *"In practice this means that, by default, content changes are no longer guaranteed to be seen by
> all visitors within a few seconds; they may need to refresh, or trigger a navigation event, before
> the new content is visible. This makes the default experience 'less live'. It's a trade-off we're
> making until Next.js addresses the regression reported in [vercel/next.js#93210]."*

Plus: `<SanityLive>` only invalidates **while someone has a tab open**, and Live events are retained
**15 minutes with no replay**. A 3 a.m. publish with zero visitors invalidates nothing. `<SanityLive>`
also does **not** cover `generateMetadata`, `sitemap.ts`, JSON-LD, robots, or first-hit anonymous CDN
traffic.

### 6.3 `<SanityLive>` should be draft-only

Sanity has an advisory (`nextjs-16-sanitylive-status`) documenting a **4–10× request-overage
incident with always-on `<SanityLive>` + Next 16 prefetching**. Mitigation: mount it only in draft
mode, drive published invalidation from the Function. Both sibling repos do exactly this.

Runtime cost: **one long-lived SSE connection per browser tab**, metered as *listeners* —
Free 1,000 / Growth 5,000 / Enterprise 10,000, erroring `"Max listener limit exceeded"`. Max
connection lifetime 4 h; on `goaway` it degrades to long-polling `router.refresh()` every 30 s.

> ⚠️ **Recorded conflict:** that same advisory says `SanityLive` + `cacheComponents` is unsupported,
> yet the official v13 starter runs exactly that combination and the v13 skill docs describe
> first-class Cache Components support. Reading: the advisory targets v12-era behaviour; v13 fixed
> the integration. Either way, **draft-gated `SanityLive` + Function for published is valid under
> both readings.**

> 📌 **Directly about this repo:** Najbar's research log cites the **audiofast case study — 620k CDN
> requests/month traced to rendering multipliers, not invalidation delivery.** Adopting this stack
> will **not** by itself reduce that number.

### 6.4 `expire: 0` vs `'max'` — the rule, resolved

Both siblings use `{ expire: 0 }`. Their recorded rationale (resolved 2026-07-28):

> *Starter rule: `expire: 0` when tags are fine-grained and the first visitor is likely the author;
> SWR (`'max'`) when invalidated entries face real concurrent traffic.*

Najbar is a low-traffic marketing site where the first post-publish visitor is usually the editor
verifying their change. **Audiofast is live and transacting** — public product and brand pages face
real concurrent traffic, so they should take **`'max'`**, not a straight copy of `expire: 0`.

### 6.5 The `searchParams` answer (the gap the siblings don't cover)

Both siblings **ban searchParams listings outright** — kryptonum-starter's house rule:
*"Listings are static segment routes (`/blog/kategoria/<slug>/strona/<n>`), never searchParam
filtering… the moment a listing reads `searchParams` the route goes dynamic and the entire static
tree collapses with it."* Audiofast's brand/product filtering genuinely needs searchParams, so that
rule **cannot be copied wholesale**.

Sanity's own skill covers it: when `searchParams` feeds the fetch, **always render the `<Suspense>`
tree and stop branching on `draftMode`** — keep the page component non-async, wrap `<DynamicPage>` in
Suspense with a real skeleton, and never await in layer 1. That keeps the static shell intact while
filtered content streams. **This is what audiofast already does today** (§3) — it just needs
preserving through any migration.

### 6.6 Other API facts

- `defineLive` options are **only** `{ client, serverToken, browserToken, strict }`. `fetchOptions`
  and `stega` were **removed in v13**. It returns **only** `{ sanityFetch, SanityLive }`.
- Import from the subpath `next-sanity/live`, not the root.
- **`useCdn` must not be false** — `defineLive` hard-overrides to `useCdn: true` with
  `allowReconfigure: false`, then per-fetch uses `useCdn = perspective === 'published'` and
  `cacheMode: 'noStale'`.
- `sanityFetch` accepts a `tags` option for **extra** tags alongside sync tags — this is what makes a
  parallel-run migration possible (§7).
- **No `revalidate` option exists** on the v13 `sanityFetch`.
- `browserToken` **ships to the browser** and should be Viewer-scoped or lower. Without it,
  `includeDrafts` silently degrades to `false` and standalone draft preview only works inside
  Presentation.
- `sanityFetchMetadata` / `sanityFetchStaticParams` are **app-authored helpers, not library exports**.
- Stega must be `false` in route handlers, metadata, sitemaps and `generateStaticParams`. v13 encodes
  this in the type system — unless you pass the **literal** `stega: false`, `data` is
  `StegaBranded<…>` and string literals won't compare.
- Sanity Functions are **GA**, Node 24. Limits: 200 invocations per document / 30 s, 4,000 per
  project / 30 s; default timeout 10 s (1–900 s); memory 1 GB (1–10 GB).
- Live Content API is GA since 2025-03-17, on **all plans including Free**; requires apiVersion
  ≥ `v2021-03-25` (a recent date is the practical recommendation); **dataset aliases unsupported**.

---

## 7. Proposed plan

Sequencing matters — Phase 0 answers Jarek and must not be bundled with the architecture work.

### Phase 0 — delete the dead fragment · ships alone
Remove `${productsFilterMetadataFragment()}` from `queryBrandBySlug` (`query.ts:2330`). No consumer
reads its output, so there is no behavioural change beyond confirming the sidebar still renders.
**Expected: ~8 s → ~1 s.**

### Phase 1 — keep pages warm · same week
- Retag the brand shell off the broad `products` tag (give filter metadata its own narrow tag).
- Switch public pages to `revalidateTag(tag, 'max')` (§6.4). The single-arg form is deprecated anyway.
- Prerender all 41 brands (`LIMIT_BUILD_TIME_STATIC_PARAMS=0`) — **only after Phase 0**, or
  41 × 5.5 s exceeds `staticPageGenerationTimeout: 180`.
- Enable `partialPrefetching: true` (§2.4).
- Optional: `use cache` on `generateMetadata`'s fetch; Suspense + `use cache` around `StoreLocations`.

### Phase 2 — adopt `defineLive`, in parallel · separate branch
Introduce `defineLive({ strict: true })` + the three-layer dispatcher; mount `<SanityLive>`
**draft-only**. **Keep the existing webhook, `TYPE_DEPENDENCY_MAP` and `/api/revalidate` running
throughout** — `sanityFetch` accepts custom `tags` alongside sync tags, and the two channels
interleave safely because both only ever *expire* entries.

> This deliberately **inverts Najbar's choice**. Najbar was unlaunched and accepted a knowingly-broken
> freshness window between phases (*"do not deploy Phase 1 and then pause the work for weeks"*).
> Audiofast is live and transacting and cannot. Najbar's own plan documents the alternative it
> declined: *"Parallel-run is cheap insurance… Retire the webhook only after the Function is verified
> in production."*

### Phase 3 — verify, then retire · gated
Do not delete anything until **all** hold:
- Publish on production → load the affected page immediately → fresh. **Repeat twice.** If stale
  content ever pins: **stop and escalate.**
- **Publish with zero browser tabs open → next visit is fresh** (the case `<SanityLive>` can't cover).
- `bunx sanity functions logs invalidate-sync-tags` shows successful invocations with sane tag counts.
- **Observe invalidation breadth** across early publishes rather than assuming it improved (§8).
- After deletions: webhook gone (`bunx sanity hooks list` empty), old route 404s, still fresh on publish.

Local handler test:
```bash
SANITY_REVALIDATE_TAGS_SECRET=x REVALIDATE_ENDPOINT_URL=<preview> \
  bunx sanity functions test invalidate-sync-tags --data '{"syncTags":["s1:example"]}'
```

**Rollback:** Phases 0–1 revert via git. Phase 2+ = redeploy old code + recreate the webhook +
restore the old secret. Blueprint resources are removed by deleting them from the file and
re-running `blueprints deploy`.

---

## 8. Open questions / explicitly unverified

- **Is the sync-tag blast radius actually narrower** than the hand-tuned taxonomy? Nobody has
  measured it. Najbar's plan says observe, don't assume — and notes the migration trades away the
  hand-tuned `DOC_LINKS_TAG` optimisation for a different, per-query surface.
- **Do we want a `browserToken` at all?** It grants browser-side read of the entire draft dataset.
  Presentation preview works without it. For a public storefront the default answer is probably no.
- **Do the other listing routes match the brand page's Suspense discipline?** Products, blog and CPO
  listings were inventoried (§3.2) but not individually verified.
- **Is the whole-catalogue `queryAllProductsFilterMetadata` worth narrowing** now, or after the
  migration changes how it's cached?
- **Two round trips per fetch** against a ~2,400-line `query.ts` with heavy listing fan-out — cost
  not modelled.
- **128-tag Vercel ceiling** — heavily dereferenced product queries could approach it. Unmeasured.
- Whether audiofast's existing tag scheme can coexist cleanly with the hardcoded `sanity:` prefix
  during the parallel run (expected yes, both only expire — but untested here).

---

## 9. Sources

**Next.js 16.3.2 docs** — `/docs/app/api-reference/config/next-config-js/cacheComponents`,
`/guides/migrating-to-cache-components`, `/api-reference/directives/use-cache`,
`/api-reference/functions/cacheLife`, `/cacheTag`, `/revalidateTag`, `/updateTag`, `/io`,
`/connection`, `/after`, `/api-reference/components/link#prefetch`,
`/config/next-config-js/partialPrefetching`, `/guides/instant-navigation`,
`/guides/optimizing-prefetching`, `/guides/incremental-static-regeneration-cache-components`,
`/guides/upgrading/version-16`, `nextjs.org/blog/next-16`, `nextjs.org/blog/next-16-3`.

**Sanity** — `/docs/content-lake/live-content-api`, `/docs/http-reference/live`,
`/docs/nextjs/cache-components`, `/docs/nextjs/caching-and-revalidation-in-nextjs`,
`/docs/nextjs/introduction`, `/docs/functions/functions-introduction`,
`/docs/functions/sync-tag-function-quickstart`, `/docs/blueprints/blueprint-config`,
`/docs/functions/function-env-vars`, `/docs/content-lake/technical-limits`,
`github.com/sanity-io/next-sanity` (`MIGRATE-v12-to-v13.md`, `skills/sanity-live-cache-components`),
`github.com/sanity-io/lcapi-examples`, `vercel/next.js#93210`.

**Sibling repos** — `/Users/oliwiersellig/Kryptonum/Najbar` (esp. `context/foundation/*`,
`context/archive/2026-07-23-m13-5-revalidation-visual-editing/`,
`context/archive/2026-07-31-next-dev-cached-shell-hang/`),
`/Users/oliwiersellig/Kryptonum/kryptonum-starter` (esp. `CLAUDE.md`, `docs/frontend-authoring.md`,
`context/foundation/launch-checklist.md`, `sanity.blueprint.ts`, `apps/functions/*`).
