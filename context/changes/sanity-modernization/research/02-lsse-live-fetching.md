# 02 — lsse-www: Live Content API, fetching and caching (reference for audiofast goal 1)

Researched 2026-10-26, read-only. Sources: the live code in `lsse/lsse-www` (next 16.4.0, next-sanity 13.3.4, @sanity/client 8.9.0, sanity 6.19.0), `lsse/lsse-www/docs/frontend-authoring.md` §1a, §3–§6 and §12, `context/foundation/{infrastructure,tech-stack,lessons}.md`, and the archived changes `perf-static-path`, `perf-psi-90`, `perf-bytes-tier2`, `sanity-reference-architecture`, `sanity-reference-integrity` and `m1-route-content-model-skeleton`. I also read the installed `next-sanity@13.3.4` dist to check what `defineLive` actually does.

All paths below are relative to `/Users/oliwiersellig/Kryptonum/`.

---

## 1. Summary

- **One fetch seam, one invalidation path.** Every content read in the app goes through `lsse/lsse-www/apps/web/src/global/sanity/live.ts`. That module holds two `defineLive({ strict: true })` instances: one on the default client, which uses the CDN for published reads, and one on an "uncapped" client pinned to `api.sanity.io`. Each result registers `sanity:<syncTag>` with `cacheTag()` inside a `'use cache'` scope.
- **Freshness comes from a Sanity Function, not from `<SanityLive>`.** The `defineSyncTagInvalidateFunction` named `invalidate-sync-tags` POSTs each publish's sync tags to `/api/revalidate-tags/`. That route calls `revalidateTag('sanity:'+tag, 'max')` (stale-while-revalidate) and then warms the locale homepages. There are no webhooks and no hand-written per-type tag maps.
- **`<SanityLive>` mounts only in draft mode** (`app/[locale]/layout.tsx:139-147`). Production visitors never open a Live Content API connection, so with a warm cache Sanity is not on the visitor path at all. The docs describe the Function as "the CORRECTNESS half" and `SanityLive` as buying "latency, not correctness".
- **Every page is a `'use cache'` partial prerender (`◐`)** under `cacheComponents: true`, using a custom `cacheLife('sanity')` profile: in production stale 30 d, revalidate 1 y, expire 1 y; in dev revalidate 1 s. Tags are the only real freshness mechanism; the time windows are a ceiling.
- **Request-size and bandwidth reduction is the most original part:**
  - `minifyGroq` strips whitespace: 582 → 444 kB.
  - `sanityFetchPage` probes the document's block `_type`s, then fetches with a block union narrowed to those types. On the homepage the query drops 444 → 93 kB, the result 627 → 208 kB, and Sanity-side time 609–836 → 252–300 ms.
  - The narrowed query fits under the API CDN's **300 KB request-body cap**, which makes the CDN usable. CDN wall time is 116–134 ms against 352–385 ms on the plain API host.
- **Measured outcomes:**
  - The first visitor per region after a publish used to wait 2.46–3.24 s for a regeneration. Now they get `STALE` in ≤ 412 ms, and the page is fresh again at +2.4 s.
  - A forced dynamic render costs half what it did (2044 → 850–961 ms).
  - Lighthouse moved from `BYPASS` at 1964 ms to `HIT` at 64 ms.
  - PSI mobile did not move (it stayed around 76, a document-weight problem).
  - **No Sanity request-count or bill measurement exists anywhere in lsse.** All of their "cost" numbers are latency and bytes. The only metered quantity they track is embeddings reads.

---

## 2. Fetch-layer architecture

### 2.1 Clients — `lsse/lsse-www/apps/web/src/global/sanity/client.ts`

- **`sanityClient`** (`client.ts:509-547`):
  - `useCdn: false`, `perspective: 'published'`, `token: SANITY_AUTH_TOKEN` (an editor-role robot token).
  - `stega: { studioUrl, enabled: false, filter }`. The filter drops stega on any source-path leaf in `STEGA_LOGIC_ONLY_FIELDS`, and also on primitive array members by checking the parent segment.
  - Comment: "No Sanity CDN on the BASE client: `defineLive` overrides it per fetch". Direct consumers of this client (API routes, scripts) get uncached truth.
- **`uncappedSanityClient`** (`client.ts:573-575`):

  ```ts
  export const uncappedSanityClient = sanityClient.withConfig({
    apiHost: 'https://api.sanity.io:443',
  });
  ```

  When `apiHost` differs from the default string, `@sanity/client` derives `cdnUrl` from that host too. A forced `useCdn: true` therefore lands on `api.sanity.io`. The `:443` port disappears in URL normalization, so the bytes on the wire are identical. This is a deliberate trick for the requests the CDN cannot serve.
- **Constants, not env vars** (`global/constants.ts:17-23`): projectId, dataset, `SANITY_API_VERSION = '2026-08-03'` and `STUDIO_URL`.

### 2.2 `defineLive` — `lsse/lsse-www/apps/web/src/global/sanity/live.ts`

```ts
const liveTokens = {
  serverToken: env.SANITY_AUTH_TOKEN,      // server reads, both perspectives
  browserToken: env.SANITY_API_READ_TOKEN, // viewer token, reaches browser only in draft sessions
  strict: true,
} as const;
const { sanityFetch: liveSanityFetch, SanityLive } = defineLive({ client: sanityClient, ...liveTokens });
const { sanityFetch: uncappedSanityFetch } = defineLive({ client: uncappedSanityClient, ...liveTokens });
```

(`live.ts:60-80`)

**What next-sanity 13.3.4 actually does, verified in the installed dist:**

- Next adds the `next-js` export condition only when `cacheComponents` is on (`next/dist/build/webpack-config.js:1126`). `next-sanity/live` then resolves to `dist/live/conditions/next-js/index.js`. That variant:
  - forces `useCdn: true` and `perspective: 'published'` on the client;
  - sets `useCdn = perspective === 'published'` and `cacheMode = 'noStale'`, except during `next build`, where `cacheMode` is unset;
  - attaches the token only for a non-published perspective or stega;
  - makes **one** `client.fetch` and calls `cacheTag(...syncTags.map(t => 'sanity:'+t))` and `cacheLife({ revalidate: 31536000 })` itself.
- **Cost trap:** without `cacheComponents`, the `react-server` variant makes **two** fetches per `sanityFetch`. The first gets the syncTags (`tag: 'fetch-sync-tags'`); the second fetches the data with `next.tags`. Audiofast already runs `cacheComponents: true`, so it gets the single-fetch variant. Keep it that way.
- When `SanityLive` mounts without `includeDrafts`, its default `action` is `revalidateSyncTagsAction`. In production that calls `revalidateTag(tag, 'max')` and in dev `updateTag`. With `includeDrafts` the action is `'refresh'`, which calls `router.refresh()`.

**`pickFetch`** (`live.ts:88-113`) routes each fetch by the measured serialized body size:

```ts
const CDN_REQUEST_BODY_CAP = 300 * 1024;  // 307,200 B pass, 307,201 → 413 (probed 2026-08-30)
const CDN_REQUEST_BODY_MARGIN = 8 * 1024;
function pickFetch(query, params) {
  const bodyBytes = Buffer.byteLength(JSON.stringify({ query, params }), 'utf8');
  return bodyBytes > CDN_REQUEST_BODY_CAP - CDN_REQUEST_BODY_MARGIN ? uncappedSanityFetch : liveSanityFetch;
}
```

**Exported surface** (`docs/frontend-authoring.md` §5):

| Export | Behaviour |
|---|---|
| `sanityFetch({query, params?, perspective, stega, locale})` (`live.ts:157-195`) | `minifyGroq(query)`, merges `localeGroqParams(locale)`, calls `pickFetch`, runs `sanitizeSvgFields(data)`. **Must run inside a `'use cache'` scope**, because `cacheTag()` throws outside one. |
| `sanityFetchPage(...)` (`live.ts:236-286`) | Published only, and only when the query contains the block union: a probe followed by a composed fetch (§2.4). Any other perspective falls through to `sanityFetch`. |
| `sanityFetchPublished({query, params?, locale})` (`live.ts:298-317`) | Carries its own `'use cache'` + `cacheLife('sanity')`; hard-pinned published + `stega: false`. Used for metadata, static params, `sitemap.ts` and `llms.txt`. |
| `sanityFetchMetadata` / `sanityFetchStaticParams` (`live.ts:357-358`) | **The same function object** as `sanityFetchPublished`, so `generateMetadata` and `generateStaticParams` share one cache entry and one round trip. |
| `sanityFetchPageMetadata` (`live.ts:335-352`) | A metadata read with the block union swapped for `_type` alone, so `generateMetadata` never uploads or downloads the builder. |
| `getDynamicFetchOptions()` (`live.ts:126-136`) | Draft off → `{published, stega:false}` without touching cookies. Draft on → `resolvePerspectiveFromCookies` (honours Presentation's drafts / published / release switcher), `stega: true`. |

### 2.3 Route shape: the "three-layer dispatcher" (`docs/frontend-authoring.md` §12)

Canonical example: `lsse/lsse-www/apps/web/src/app/[locale]/(site)/page.tsx:73-130`.

```tsx
export default async function HomePage() {
  const { isEnabled: isDraft } = await draftMode();
  if (isDraft) return <Suspense><DynamicHome /></Suspense>;
  return <CachedHome perspective="published" stega={false} />;
}
async function DynamicHome() {                       // reads cookies, outside cache
  const { perspective, stega } = await getDynamicFetchOptions();
  return <CachedHome perspective={perspective} stega={stega} isDraft />;
}
async function CachedHome({ perspective, stega, isDraft = false }) {
  'use cache';
  cacheLife('sanity');
  const locale = await getLocale();                   // next/root-params → keys cache per locale
  const { data } = await sanityFetchPage({ query: HOMEPAGE_QUERY, params: {...}, perspective, stega, locale });
  ...
}
```

- `strict: true` is mandatory under `cacheComponents` (`live.ts:54-59`). In non-strict mode, draft mode silently renders published content with no error.
- Next bypasses `'use cache'` while draft mode is on, so drafts are always dynamic. Both branches still run the same cached component.
- The data-dependent `notFound()` lives in layer 3. `generateMetadata` uses `notFoundUnlessDraft()` (`global/sanity/metadata.ts:125-128`).
- **Self-fetching cached chrome leaves.** `Header` (2 fetches), `Footer`, `AccentPalette` (perspective only), `OrganizationSchema` and `NotFound` each own a `'use cache'` scope. The layouts resolve `{perspective, stega}` once and pass them down as props (`app/[locale]/(site)/layout.tsx:37-53`).
  - **Never wrap the layout `children` slot in `'use cache'`.** It hangs `next dev`, because `stale: 0` falls under the 30 s runtime-prefetch threshold.
  - Per-leaf caching means chrome cache entries are shared across every page of a locale. The navigation query runs once per locale per invalidation, not once per page.
- There are 96 `'use cache'` sites in `apps/web/src`.

### 2.4 Block-union composition (the main bandwidth lever)

Code: `lsse/lsse-www/apps/web/src/global/sanity/fragments.ts:4399-4741`, `live.ts:236-286`.

- **Two copies of the union:**
  - `blockUnionProjection` is the hand-written union of 86 arms. It is the **type source** that typegen folds.
  - `BLOCK_PROJECTIONS: Record<_type, projection>` is the **runtime source**.
  - `fragments.test.ts` asserts that `composeBlockUnion(Object.keys(BLOCK_PROJECTIONS)) === blockUnionProjection`, and that each key equals the `_type` literal in its own guard.
- **Probe:** `swapBlockUnion(query, blockTypeProbeProjection)` replaces the union with `_type` in the **same** query text. Filters, params and shape therefore cannot drift from the real query. `blockTypesFromProbe` walks the result for `_type`s.
- **Composed fetch:** `composeBlockUnion(types)` keeps only the present arms, always in registry order. Two pages with the same block set therefore produce byte-identical query text, which means one Data Cache entry and one Sanity query-cache entry.
- **Fallback:** if the probe throws, the code logs `console.warn` and runs the full query, which `pickFetch` routes to the uncapped host. An empty builder composes to an empty union, which is valid.
- **Draft path keeps the full union.** `OptimisticBlocks` needs every arm, and narrowing would cost a second round trip on every Presentation keystroke.
- **Measured on the live dataset** (perf-static-path research §5 Phase 4). All ten cases returned byte-identical results:

  | Page | Query | Result |
  |---|---|---|
  | homepage | 444 → 93 kB | 642 → 213 kB |
  | `legalDocument` | 450 → 6.4 kB | 552 → 9 kB |
  | listings | — | 27–60 kB |

  The probe itself costs 84–229 ms for a ~2 kB query.
- **Trade-off (my inference):** a page-builder page now costs **2 CDN requests per cold render instead of 1**, in exchange for about 3× less bandwidth and about 2.5× less Sanity compute time.

### 2.5 `minifyGroq` — `lsse/lsse-www/apps/web/src/global/sanity/minify-groq.ts`

- A linear character walk that keeps string literals as-is, strips `//` comments, and drops spaces around punctuation and around a single operator. A space between two operators is kept, to avoid fusing tokens.
- The result is memoized in a 200-entry insertion-order LRU.
- It removes about a third of the bytes: 582 → 444 kB on a full page query, 120 → 93 kB on a composed one.
- An earlier `out += char; out[out.length-1]` version was quadratic in V8: ~1.5 s per query and a 10 GB heap. The comment at `minify-groq.ts:88-95` records this.
- Typegen never sees the minified text; minification happens at the fetch funnel only.

### 2.6 Invalidation: Sanity Function → route handler

- **Blueprint** (`lsse/lsse-www/sanity.blueprint.ts:55-59`):

  ```ts
  defineSyncTagInvalidateFunction({ name: 'invalidate-sync-tags', src: './apps/functions/invalidate-sync-tags', event: { resource: { type: 'dataset', id: 'kzwa1yid.production' } } })
  ```

- **Handler** (`lsse/lsse-www/apps/functions/invalidate-sync-tags/index.ts`):
  - `syncTagInvalidateEventHandler`, with `@sanity/functions` 1.7.1 as its only dependency and a bare `fetch` POST of `{tags: syncTags}` to `REVALIDATE_ENDPOINT_URL?secret=…`.
  - It throws when the event has no `syncTags` array. This matters because `sanity functions test` sends an empty payload.
  - It throws on a non-2xx response, so the failure shows in `sanity functions logs`.
  - A failure in `done(syncTags)` is logged, not thrown, because the work has already happened.
- **Route** (`lsse/lsse-www/apps/web/src/app/api/revalidate-tags/route.ts`):
  - `timingSafeEqual` secret check.
  - Validates that `tags` is `string[]`, with `MAX_TAGS = 1000` as a storm guard.
  - `revalidateTag(\`sanity:${tag}\`, 'max')` at line 163.
  - `after(warmLocaleHomepages(origin))` at line 173. The warm uses a **browser User-Agent**, `cache: 'no-store'`, a 5 s timeout, and drains the body.
  - It is idempotent: an unknown tag is a no-op, so no allowlist is needed.
- **The trailing slash is load-bearing.** The site runs `trailingSlash: true`, and a slashless POST gets a 308 that drops the body while the Function logs success.
- **This is the only invalidation code in the app.** There are no other `revalidateTag`, `revalidatePath`, `updateTag`, `unstable_cache` or `export const revalidate` calls in `apps/web/src`.
- **Verified end to end:**
  - a publish was live in about 4 s (2026-08-05);
  - after the org transfer, a title change was live in 3.8 s (2026-10-13);
  - `cacheReason: stale_tag` replaced `delete_tag` in `vercel logs`.

### 2.7 Draft mode / Presentation plumbing (only what touches fetching)

- **Enable:** `app/api/draft-mode/enable/route.ts`, one line: `export const { GET } = defineEnableDraftMode({ client: sanityClient })`. next-sanity adds the CHIPS `Partitioned` attribute, which Safari needs inside the cross-site iframe.
- **Disable:** a Server Action at `app/actions/draft-mode.ts`.
- **Root layout** (`app/[locale]/layout.tsx:91-147`): `preconnect` / `prefetchDNS` to `cdn.sanity.io`, then `{isDraft && <><PreviewBar/><LiveVisualEditing/><SanityLive includeDrafts/></>}`. `LiveVisualEditing` is `<VisualEditing basePath="" trailingSlash onSuspiciousStega={dev-only reporter}/>`.
- **Tokens** (`context/foundation/infrastructure.md` § API tokens):

  | Token | Role | Used for |
  |---|---|---|
  | `SANITY_API_READ_TOKEN` | viewer | Reaches the browser only through `SanityLive includeDrafts`. Never `NEXT_PUBLIC_`. |
  | `SANITY_AUTH_TOKEN` | editor | Server reads and seeding. |

  Function tokens are minted by the Blueprint deploy.
- CORS entries need `--credentials`.

### 2.8 Reads that intentionally bypass the seam

| Where | What | Why |
|---|---|---|
| `app/api/{contact,newsletter,kalkulator/pdf}/route.ts`, `global/email/source.ts` | raw `sanityClient.fetch`, `useCdn:false` | Route handlers cannot use the RSC `cacheTag` layer. These are POST-triggered and low-volume. |
| `global/analytics/server/config.ts:43-80` | raw fetch + a **module-level 5-minute memo** | Keeps a Sanity round trip off the per-event hot path. Fluid Compute reuses the instance. |
| `global/search/query.ts:79-93` | `'use cache'` helper called from a route handler, with `cacheLife('semantic')` (1 h / 1 h / 1 d) | Embeddings reads are **metered per query**. There is one cache entry per (normalized query, locale, scope). It deliberately avoids the `sanity` profile because it registers no sync tags. |
| `app/api/search-index/route.ts` | `'use cache'` + `cacheLife('sanity')` helper, then `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` + a content-hash ETag / 304 | The client-side keyword index is fetched on intent only. It is invalidated on publish via sync tags, the CDN absorbs repeats, and an unchanged corpus costs a 304. |
| `scripts/generate-tombstones.ts` | build-time `@sanity/client` read | The 410 list is baked into code; changing it needs a redeploy. |
| Redirects | `sync-bulk-redirects` Function → Vercel Bulk Redirects API | **Zero Sanity reads per request.** Redirects live at the CDN, and `auto-redirect` writes redirect documents on slug change. |

---

## 3. Query conventions (`lsse/lsse-www/apps/web/src/global/sanity/queries.ts`, `fragments.ts`, `types.ts`)

- **No `defineQuery`.** Queries are `groq\`…\`` constants annotated with a branded type:

  ```ts
  export type TypedQuery<TResult> = string & { readonly __queryResultType?: TResult };   // types.ts:90-92
  export const HOMEPAGE_QUERY: TypedQuery<HOMEPAGE_QUERY_RESULT> = groq`…`;
  ```

  `sanityFetch<TResult>` infers the result from the brand, so call sites never pass a generic. The reason given is that fragment interpolation erases the literal type, so the generated `SanityQueries` map cannot look up a composed query.
- **Naming:** `*_QUERY` → `*_QUERY_RESULT`, `*_SLUGS_QUERY` (static params), `*_TOTAL_COUNT_QUERY` (pagination), `*_FILTERS_QUERY` (chips). Typegen derives type names from constant names.
- **Fragment factories** take a whole selector expression, for example `imageFragment('"image": heroBlock.image')`.
  - ⚠️ A factory must have an **expression body only**. A `const` before `return` silently drops every dependent query from `sanity.types.ts`.
  - Shared card field lists are plain, untagged template literals.
  - Never build `_type in [...]` lists with `.map().join()`, because typegen cannot fold them. lsse writes each tuple twice, once in TypeScript and once as a string, and reconciles the two with `assertTypeFilter` at import time.
- **Types are derived, never hand-written:** `NonNullable` / `Extract` / indexed access over `*_QUERY_RESULT` in `types.ts`, with a short list of sanctioned exceptions.
- **Locale:** `locale` is required on every fetch and becomes `$locale` plus per-segment path-prefix params. Singletons are addressed by `singletonId(type, locale)` (`settings`, `settings.en`).
- **Invariants:**
  - Boolean SEO predicates use `!= true`, never `== false`.
  - A listing and its count share one identical predicate.
  - Reference arrays project `_key` **before** `...@->` (`items[]{ _key, ...@->{…} }`).
  - Hide-from-list predicates sit on the array (`items[@->seo.hideFromList != true]`).
- **Two-fetch split for heavy bodies.** For example, `NEWS_POST_QUERY` and `NEWS_POST_SECTIONS_QUERY` run in `Promise.all` (`app/[locale]/(site)/news/[slug]/page.tsx:196-213`), because the PT-body union and the page-builder union together would be about 487 kB. Metadata gets a separate small `*_SEO_QUERY`.
- **Measured size budgets live in code comments and a gate:**
  - `scripts/assert-query-cap.ts` runs in `check-types`. It asserts that every union-free query stays under the CDN cap, that a composed page holding up to `MIN_COMPOSABLE_BLOCK_TYPES` of the widest blocks fits, and that nothing exceeds a hard ceiling.
  - Each block adds about 4.75 kB to the full union (`minify-groq.ts:46-51`).
- **No user-defined GROQ functions on the Content Lake** (probed: `fn::` and `let` give a `queryParseError`). The 34-branch href ladder therefore cannot be deduplicated in GROQ.

---

## 4. Caching and invalidation model

| Layer | Mechanism | lsse setting |
|---|---|---|
| Vercel CDN / PPR shell | `cacheComponents: true`; every route is `◐` | Visitor `HIT` in ~90–150 ms; Sanity not on the path |
| Next `'use cache'` entries | `cacheLife('sanity')` (`next.config.ts:121-142`) | prod `{stale: 30d, revalidate: 1y, expire: 1y}`; dev `{stale: 0, revalidate: 1, expire: 30d}`. `default` profile is 30 d / 30 d / 1 y. |
| Tags | next-sanity's own `cacheTag('sanity:'+syncTag)` per fetch | Opaque Sanity sync tags. Document-level, including documents reached through `->`. |
| Invalidation | Function → `revalidateTag(tag, 'max')` + homepage warm | SWR. Measured first `STALE` at +1.3 s, fresh `HIT` at +2.4 s (`/`) / +3.3 s (`/en/`). No `REVALIDATED`/`BYPASS` in 90 requests. |
| Sanity API CDN | `useCdn` true for published, `cacheMode: 'noStale'` | Earlier "30–60 s stale CDN" folklore disproved: the new `_rev` was visible on `apicdn` 159 ms after the mutation, with and without `noStale`. |
| Static params | `perLocaleStaticParams` + `SENTINEL_SLUG = '404'` | Vercel builds prerender everything. Local builds keep 1 row per family per locale unless `PRERENDER_ALL=1`. **BIP prerenders a window** (`BIP_PRERENDER_MONTHS = 24`, `BIP_PRERENDER_LISTING_PAGES = 10`, `global/constants.ts:177-178`); the rest renders on demand via `dynamicParams` under the same tags. |
| Build hardening | `experimental.staticGenerationRetryCount: 1`, `staticGenerationMaxConcurrency: 4` (`next.config.ts:52-55`) | After a 1,966-page build froze. Fail fast, and half the concurrent Sanity load. |
| Bots | `htmlLimitedBots` = Next default minus `Chrome-Lighthouse` (`next.config.ts:97-98`) | Bing / FB / LinkedIn etc. still get a blocking **dynamic** render: no cache, live Sanity reads. Lighthouse now gets the cached page. |

**`'max'` alone is not enough.** In Next's own words, `'max'` marks data stale but only refetches when a page carrying the tag is next visited. That is why the route warms the homepages itself. Only the homepages are warmed; every other page rebuilds on its next visit, still served SWR.

---

## 5. Decisions and rationale (from the context docs)

| Decision | Rationale | Source |
|---|---|---|
| `defineLive` + `strict: true` + three-layer dispatcher | cacheComponents forbids reading cookies inside `'use cache'`; non-strict silently loses drafts | `live.ts:54-59`, frontend-authoring §5/§12, m1 research:121-156 |
| `SanityLive` only in draft | The Function gives correctness with zero browsers connected. A visitor-side live connection only buys latency. | `sanity.blueprint.ts:44-54`, `invalidate-sync-tags/index.ts:3-10` |
| `'max'` instead of `{ expire: 0 }` | `expire: 0` deleted the entry, and the next visitor per region paid 2.46–3.24 s. Editors preview in draft mode anyway. | perf-static-path research §2 Cause B, Phase 3 |
| Homepage warm after invalidation | `'max'` does not rebuild on its own | route header, Phase 3 |
| Per-page composed union | 444 kB query → 93 kB. Back under the CDN cap and ~250 ms faster per query. Owner rule: "every block available on every page", so only the fetch narrows. | perf-static-path Phase 4 |
| Restore CDN on the base fetch path, with an uncapped sibling | The CDN is worth ~250 ms per query on every regeneration and every bot render. Over-cap queries would 413 at runtime with no build warning. | Phase 4, `client.ts:549-575` |
| Metadata / static params share one function object | One cache entry and one round trip for both | `live.ts:354-358` |
| `sanityFetchPageMetadata` strips the union | `generateMetadata` never reads blocks | `live.ts:319-334` |
| Keep strong refs; don't prune inactive GROQ branches (yet) | Unused branches cost payload, query work, **extra sync-tag dependencies and invalidation fan-out**, but no measurement justified the refactor | sanity-reference-architecture F6; deferred in sanity-reference-integrity |
| Semantic search: one `'use cache'` entry per normalized query, 1 h profile, submit-only (no debounce) | Embeddings reads are metered per query (Growth: 1,000/month per org, then $1.50 / 1k). There is no usage API; the usage panel is watched manually. | `search/query.ts:17-63`, infrastructure.md § Sanity, search-modal-first change |
| Single-layer images via the Sanity CDN | The custom loader skips Vercel's optimizer (zero transform billing); a 1440 rung was added for bandwidth | `next.config.ts:150-166`, `utils/image-loader.ts` |

---

## 6. Pitfalls and lessons (each one was hit in lsse)

1. **`cacheTag()` throws outside a `'use cache'` scope.**
   - Calling `sanityFetch` in a route handler, a `sitemap.ts`, or a draft-only branch outside the cached component crashes.
   - On `/szukaj/` it threw on every draft render, and React silently fell back to client rendering. `check:stega-leaks` caught it.
   - The fix is to call the same cached function with draft options (`search/page.tsx:209-221`).
2. **Never `'use cache'` around the `children` slot.** It hangs `next dev`.
3. **The API CDN's 300 KB request-body cap** is exact (307,200 B passes) and only surfaces as a 413 at runtime. A gate is needed.
4. **Typegen silent drops:**
   - a statement in a fragment factory body;
   - a `.map().join()` type list;
   - a projection over a computed array (`select(...)[]{…}`);
   - an interpolated imported binding.

   Each one makes the `*_QUERY_RESULT` disappear with no error.
5. **One `_type` per projection const.** A const with two arms (gallery + mosaic) composed a union missing the mosaic projection: raw fields, no error. The equivalence test caught it.
6. **Stega:**
   - Markers break `===`, map keys, `data-*`, hrefs and `alt`, and only in draft mode.
   - The filter matches the **source path**, so every `coalesce` branch name must be listed.
   - Use `stegaClean()` on draggable array items.
   - `sanityFetchPublished` pins `stega: false` for metadata, sitemap and JSON-LD.
7. **The trailing slash on the revalidate endpoint**, or the invalidation silently never lands.
8. **`SANITY_REVALIDATE_TAGS_SECRET`** is Sensitive in Vercel and cannot be read back. The only proof the two copies match is a 200 from the round trip.
9. **`minifyGroq` must stay linear.** String rope flattening in V8 made it quadratic.
10. **Local `next build` saturates the uplink** (concurrent ~330 kB POST bodies). A POST GROQ query is never retried by `@sanity/client`, so one connect timeout kills the build. This is why local prerendering is trimmed and concurrency is capped.
11. **Stale comments rot.** `global/i18n/static-params.ts:25-38` still says the app routes "every read at the plain API host with no Sanity CDN"; that stopped being true in perf-static-path Phase 4. A "300 KB / 318 KB" cap figure circulated in docs for weeks without ever being measured (`minify-groq.ts:16-28`).
12. **`'max'` does not rebuild**, so the stale window lasts until the next visit unless something warms it.
13. **htmlLimitedBots replaces Next's default list; it does not extend it.** Copy the default list minus the entries you want gone.

---

## 7. Cost-related findings (Sanity requests, bandwidth, compute)

**What lsse does that lowers Sanity usage:**

- **No Live API connections from visitors.** `SanityLive` mounts only in draft mode.
- **Long-lived caches with tag invalidation.** Cache entries live up to a year. A page re-reads Sanity only after a publish touches one of its sync tags, and only when it is next visited or warmed.
- **Per-leaf chrome caching.** Header, footer, palette and organization data are fetched once per locale per invalidation and shared across all pages.
- **Shared function object for metadata and static params**, so one query serves both callers.
- **Composed page queries:**
  - about 4.8× smaller request and 3× smaller response on the homepage;
  - about 2.5× less Sanity compute;
  - CDN host instead of API host, so a repeated identical query is a CDN cache hit with frozen `ms`.
- **Byte-identical composed text for identical block sets**, so the Sanity query cache and the Next Data Cache dedupe across pages.
- **Embeddings:** query normalization plus `'use cache'` per query; the search-index route uses CDN `s-maxage` and ETag/304.
- **Analytics config** sits behind a 5-minute module memo.
- **Redirects** sit at the Vercel CDN (Bulk Redirects), so there are zero runtime Sanity reads for them.
- **Images:**
  - `cdn.sanity.io` directly (no Vercel optimizer cost);
  - a never-upscale clamp from the asset filename's dimensions, so oversized rungs collapse to one URL (`image-loader.ts:24-30`);
  - a fixed-box path that emits a 2-rung `x` srcset instead of 17 rungs (`SanityImage/index.tsx:68-80`);
  - `blur` (LQIP) opt-in for non-priority images.

  Fewer distinct URLs means fewer transforms and better CDN hit rates (my inference).

**What still costs Sanity requests:**

- **Every page-builder page regeneration makes 2 requests** (probe + composed).
- **Draft renders:**
  - full union, ~444 kB uploaded to `api.sanity.io`;
  - uncached;
  - a `router.refresh()` per mutation event from `SanityLive includeDrafts`.

  This is editor-only, but heavy per edit.
- **Bots on the html-limited list** (Bing, social previews) get a full dynamic render that hits Sanity live.
- **Every deploy re-prerenders the whole site** (~2,000 pages before the BIP window was introduced). Pages carry about 6 fetches each: page, probe, metadata, plus chrome leaves deduped per locale.
- **Sync-tag fan-out.** Inactive GROQ branches register tags for documents the page does not render, so unrelated publishes can invalidate pages (sanity-reference-architecture F6; not fixed).
- **A cold render of `/` makes about 7 Sanity requests:**
  - layout: AccentPalette (1), OrganizationSchema (1), Header (2), Footer (1);
  - page: probe + composed (2);
  - metadata (1).

  The chrome leaves are cached independently.

**Not measured in lsse:**

- No Sanity API / API CDN request counts and no bandwidth figures from the Manage usage panel.
- `requestTag` / `requestTagPrefix` are not customized. All fetches go out as next-sanity's default `next-loader.fetch.cache-components`, so usage cannot be attributed per surface.
- `search/query.ts:59-63` notes that whether an API CDN hit still decrements a meter is undocumented.

---

## 8. Differences from a "classic" webhook + `revalidateTag` setup

| Classic (audiofast-style, per the perf-static-path sibling table) | lsse |
|---|---|
| A GROQ-powered webhook posts document/type info, and a route maps it to hand-chosen tags (type, slug, reverse lookups) | Sanity computes the **sync tags** of each query result. The Function relays the invalidated tags verbatim and the route prefixes `sanity:`. **No tag mapping code at all.** References are covered automatically. |
| Tags passed manually per fetch (`next: { tags }` or `cacheTag(...)`) | `defineLive`'s `sanityFetch` calls `cacheTag` and `cacheLife` itself. A new route needs "zero cache-tag wiring" (m1 plan:60). |
| Often `expire: 0` / `updateTag` on the edited document, `'max'` for collateral (audiofast, per the perf-static-path research table) | `'max'` for everything, plus an explicit warm of hot URLs |
| `useCdn` decided per client and often off for freshness | CDN on for published reads, with `cacheMode: 'noStale'` forced by `defineLive`; host chosen by request size |
| Draft preview via a separate preview client and fetch path | Same cached component and same `sanityFetch`; only `perspective` and `stega` props differ. Next bypasses the cache in draft. |
| Webhook secret and signature checks via `parseBody` (`next-sanity/webhook`) | Function → route with a shared secret in the query string, compared with `timingSafeEqual`. Function env is provisioned via `sanity functions env add`. |
| Webhook fires per document mutation with a projection | `defineSyncTagInvalidateFunction` fires once per invalidation batch with exactly the tags that changed |
| Granularity bounded by the tag scheme | Granularity bounded by Sanity's sync tags. Accurate, but includes tags from inactive branches (fan-out risk). Tags are opaque, so they cannot be targeted by type. |

---

## 9. Directly reusable for audiofast

1. **`live.ts` almost verbatim:**
   - two `defineLive({ strict: true })` instances;
   - `pickFetch` (only needed if any query nears 300 KB — audiofast's homepage was 101 KB minified per the perf-static-path table);
   - `getDynamicFetchOptions`;
   - `sanityFetchPublished` with the metadata/static-params aliases;
   - the `minifyGroq` funnel.
2. **The three-layer dispatcher and self-fetching cached chrome leaves** (Header, Footer, …), with perspective and stega threaded as props.
3. **Invalidation stack:**
   - `apps/functions/invalidate-sync-tags/index.ts` + `defineSyncTagInvalidateFunction` in `sanity.blueprint.ts`;
   - `app/api/revalidate-tags/route.ts` with the `'max'` + warm loop.

   This could replace audiofast's `app/api/revalidate/` webhook and its reverse-lookup tag logic. Products' denormalized fields recomputed in the revalidation webhook need a separate home, for example a document Function.
4. **The `cacheLife('sanity')` profile** with the dev override (`next.config.ts:121-142`), and the warning never to `'use cache'` around `children`.
5. **`SanityLive includeDrafts` in draft only**, plus `defineEnableDraftMode` and a disable Server Action. Use a viewer-scoped `browserToken`.
6. **`TypedQuery` brand + `*_QUERY` naming + derived types**, or adopt `defineQuery` if typegen can fold audiofast's fragments.
7. **Gates:**
   - `assert-query-cap.ts` for the request-body budget;
   - a `check:stega-leaks`-style crawler;
   - the `fragments.test.ts` equivalence test, if composition is adopted.
8. **Search-index pattern** (`'use cache'` helper + `s-maxage` + ETag/304) for any public JSON route. Relevant to audiofast's blog search.
9. **Image pipeline:** custom loader to `cdn.sanity.io`, never-upscale clamp, a 1440 rung, the fixed-box two-rung srcset, LQIP opt-in.
10. **Build hardening:** `staticGenerationRetryCount: 1`, `staticGenerationMaxConcurrency`, a sentinel slug, and windowed prerender for long tails (`perLocaleStaticParams`). Audiofast has a large product catalogue.

**Use with care:**

- **Block-union composition costs a second request per page render.** With 21 block types and a ~101 kB homepage query (already under the CDN cap), audiofast should measure before adopting it. The lsse win came from crossing the 300 KB cap and from 86 arms.
- **Warming only the homepages** fits lsse. Audiofast may want to warm its highest-traffic product/brand URLs instead, or accept SWR on first visit.

---

## 10. Open questions

1. **How does Sanity bill this mix?** For audiofast's plan: API CDN vs API requests, bandwidth, and whether `cacheMode: 'noStale'` CDN reads count differently. lsse never measured it; a before/after from the Manage usage panel is needed.
2. **Do Live Content API connections (if `SanityLive` were mounted for visitors) count against quotas or concurrency?** lsse avoided the question by mounting it in draft only. Confirm against current Sanity docs before choosing visitor-side live.
3. **How big is sync-tag fan-out on audiofast's catalogue?** Products reference brands and categories, and listings dereference many documents. One brand publish may invalidate hundreds of product pages. That is acceptable with `'max'`, but each invalidated page pays a regeneration (Sanity requests) on its next visit. Measure tag counts per publish in the Function logs.
4. **Should `requestTagPrefix` / per-surface `requestTag` be set** so Sanity's request logs attribute usage by surface? lsse does not do this.
5. **Is there a `cacheLife` interaction?** next-sanity calls `cacheLife({ revalidate: 1y })` internally and lsse also calls `cacheLife('sanity')` in the same scope. lsse never tested which call wins in dev; its dev profile (`revalidate: 1`) appears to work in practice.
6. **Does a probe-plus-composed fetch pay off at audiofast's size,** or is it only worth it above the CDN cap?
7. **Should the inactive-branch fix (F6) land first?** It reduces both payload and invalidation fan-out, and lsse never did it.
