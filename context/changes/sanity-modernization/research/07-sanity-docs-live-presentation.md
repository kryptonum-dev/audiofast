# 07: Sanity docs research. defineLive, cost model, Presentation tool, breaking changes

Researched 2026-10-26 from current docs (sanity.io/docs `.md` endpoints), the next-sanity and @sanity/client repos (README, MIGRATE guides, CHANGELOG, `src/live/*`), and npm metadata. Raw copies are in `scratchpad/research/raw/`.

**Versions as of today (npm):** next-sanity **13.4.0** (2026-10-23), @sanity/client **8.11.0** / 7.28.0 (both 2026-10-23), sanity **6.20.0**, @sanity/visual-editing **6.2.0**.
**Repo today:** `apps/web` has next-sanity `^13.3.3`, @sanity/client `^7.26.2`, next `16.3.2`, and `cacheComponents: true` already set. `apps/studio` has sanity `^6.10.1`.

> ⚠️ **Sanity 6.10.1 and 6.12.0 are marked deprecated:** "potential data-loss bug when working with Portable Text fields … resolved in 6.14.1" ([changelog v6.10.1](https://www.sanity.io/docs/changelog/studio-Ni4xMC4w.md)). Bump the Studio to ≥ 6.14.1 regardless of the rest of this work.

---

## Summary

- **`defineLive` (next-sanity 13) is now lean.** Its options are `client`, `serverToken`, `browserToken` and `strict`. `fetchOptions` and `stega` were **removed** in v13. `sanityFetch` returns `{data, sourceMap, tags}`. `<SanityLive>` takes `includeDrafts`, `requestTag`, `waitFor`, `action`, `onError`, `onWelcome`, `onReconnect`, `onRestart` and `onGoAway`. `refreshOnFocus`, `refreshOnReconnect`, `refreshOnMount`, `intervalOnGoAway` and `revalidateSyncTags` are all **removed**.
- **Cache Components has an official pattern:** [Sanity Live with Next.js Cache Components](https://www.sanity.io/docs/nextjs/cache-components).
  - Set `cacheLife: {default: sanity}` (365-day revalidate) from `next-sanity/live/cache-life` and use `defineLive({strict: true})`.
  - Use a **three-layer pattern**: page → dynamic wrapper (`draftMode()`/cookies) → `'use cache'` component that calls `sanityFetch`.
  - Add helper functions `sanityFetchStaticParams` and `sanityFetchMetadata`.
  - There is no separate "experimental" entry point any more. The old `EXPERIMENTAL-CACHE-COMPONENTS.md` now just redirects to that doc.
- **Cost model.**
  - API requests (`api.sanity.io`) and API CDN requests (`apicdn.sanity.io`) are metered separately. Growth includes 250k API requests (+$1/25k) and 1M CDN requests (+$1/250k), plus bandwidth at 100 GB (+$0.30/GB).
  - Live Content API connections are a separate limit, 1k per dataset on Free/Growth. Opening a connection fetches no data; **the refetches it triggers are what count**.
  - Studio traffic, 4xx/5xx responses and OPTIONS requests are free.
  - With cacheComponents, `sanityFetch` makes **one** request per fetch, and the published perspective goes through the API CDN with `cacheMode: 'noStale'`. Without cacheComponents it makes two, but the sync-tag lookup isn't billed.
- **Biggest cost lever already shipped:** v13 changed `<SanityLive>` to `revalidateTag(tag,'max')` (stale-while-revalidate) instead of `{expire:0}`. Sanity measured a **4× average (7–10× worst)** request increase on Next 16 with next-sanity v12. v13 fixes it, but updates become "eventually consistent".
- **For guaranteed freshness at low cost:** deploy a **Sync Tag Invalidate Function** that calls `/api/revalidate-tags`, and set `<SanityLive waitFor="function">`. This replaces time-based ISR (`fetchOptions.revalidate` was removed because it caused "many unnecessary ISR writes").
- **Minimal Presentation setup:**
  - In the Studio: `presentationTool({resolve: {mainDocuments, locations}, previewUrl: {initial, previewMode: {enable: '/api/draft-mode/enable'}}})`.
  - In Next: `defineEnableDraftMode({client: client.withConfig({token})})`, `<VisualEditing />` (draft mode only) and `<SanityLive includeDrafts={isDraftMode} />`.
  - Set `stega.studioUrl` on the client, and pass `stega: false` for metadata, JSON-LD, sitemap and route handlers.
- **@sanity/client 8 changes the runtime, not the API.** It is ESM-only, needs Node ≥22.12 and is fetch-based, and it removes `requester`/`unstable__*`. next-sanity 13.4 accepts `^7.28 || ^8.11` as a peer but still installs v7.

---

## 1. defineLive: API and the Next 16 Cache Components pattern

### 1.1 `defineLive` options (source: [`src/live/shared/types.ts`](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/src/live/shared/types.ts))

| Option | Type | Notes |
|---|---|---|
| `client` | `SanityClient` | Internally re-configured with `useCdn: true, perspective: 'published', stega: false, allowReconfigure: false` |
| `serverToken` | `string \| false` | Used only for non-published perspectives or stega requests. Set it to `false` to silence the dev warning |
| `browserToken` | `string \| false` | Sent to the browser only when `<SanityLive includeDrafts>` is true. Must be Viewer or lower |
| `strict` | `boolean` (default `false`) | Makes `perspective` and `stega` required on `sanityFetch` and `includeDrafts` required on `<SanityLive>`, with no `draftMode()`/cookie auto-resolution. **Use it with cacheComponents** |
| ~~`fetchOptions`~~ | removed in v13 | Use a Sync Tag Invalidate Function instead of time-based revalidation |
| ~~`stega`~~ | removed in v13 | Pass `stega` per `sanityFetch` call, or leave `client.stega.studioUrl` unset |

### 1.2 `sanityFetch(options)` → `Promise<{data, sourceMap, tags}>`

- **Options:** `query`, `params` (it may be a Promise), `perspective` (`LivePerspective` = `ClientPerspective` minus `'raw'`), `variant` (13.2+), `stega`, `tags` (extra cache tags, for read-your-own-writes), and `requestTag`. The `requestTag` default is `'next-loader.fetch'` (or `.cache-components`) and it is combined with the client's `requestTagPrefix`.
- **`data` typing:** `data` is **stega-branded** (`StegaString`) unless you pass the literal `stega: false` (13.3.0+). 13.4.0 can infer types from branded `.groq` imports (experimental).
- **`tags`:** the cache tags that were applied. Sync tags are prefixed with `sanity:`.
- **Implementation:** see [`conditions/next-js/defineLive.tsx`](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/src/live/conditions/next-js/defineLive.tsx) and [`react-server/defineLive.tsx`](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/src/live/conditions/react-server/defineLive.tsx).
  - `useCdn = perspective === 'published'`. A drafts or release-array perspective goes to the live API.
  - `cacheMode: 'noStale'` is used on the CDN except during `next build`.
  - **With cacheComponents**, there is a single `client.fetch(..., {filterResponse:false})`, followed by `cacheTag(...syncTags)` and `cacheLife(sanity)`.
  - **Without cacheComponents**, there are two requests. The first is an uncached sync-tag lookup, which "does not count toward Sanity API usage quotas". The second is the `fetch` with `next: {revalidate:false, tags}`.

### 1.3 `<SanityLive>` props (v13)

| Prop | Default / notes |
|---|---|
| `includeDrafts` | Auto in non-strict mode: `draftMode().isEnabled` when a browserToken is set. **Required** in strict mode. Pass `includeDrafts={isDraftMode}` |
| `waitFor="function"` | Holds events until a Sync Tag Invalidate Function calls `done()`. Ignored when `includeDrafts` is true |
| `action` | A server or client action, or the string `'refresh'`. Default outside draft mode: `revalidateTag(tag,'max')` and then `'refresh'` (in dev it uses `updateTag`). The default is `'refresh'` when `includeDrafts` or `waitFor="function"` is set. Use `parseTags()` from `next-sanity/live` to parse tags |
| `onError` | Logs to the console by default. `'throw'` hands the error to `unstable_catchError` (with retry) |
| `onWelcome` / `onReconnect` | Log by default. `false` disables them |
| `onRestart` | `router.refresh()` by default. `false` disables it |
| `onGoAway(event, ctx, setPollingInterval)` | Polling fallback by default when the connection is refused (for example "connection limit reached"). `false` disables polling |
| `requestTag` | `'next-loader.live'` by default |

Removed in v13: `revalidateSyncTags` (replaced by `action`), `refreshOnFocus`, `refreshOnReconnect`, `refreshOnMount`, `intervalOnGoAway`, `tag` (renamed `requestTag`). The [migration guide](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/MIGRATE-v12-to-v13.md) has userland replacements for each.

Other exports from `next-sanity/live`: `resolvePerspectiveFromCookies`, `resolveVariantFromCookies`, `parseTags`, `isCorsOriginError`, and the types `LivePerspective`, `DefineLiveOptions`, `DefinedLiveProps` and `DefinedFetchType`.

### 1.4 Official Cache Components pattern ([docs](https://www.sanity.io/docs/nextjs/cache-components))

Sanity's docs say: "This guide requires next-sanity v13 and Next.js v16. We recommend Next.js v16.2 or later." Sanity also publishes an agent skill for the migration: `npx skills add https://github.com/sanity-io/next-sanity --skill sanity-live-cache-components`.

```ts
// next.config.ts
import {sanity} from 'next-sanity/live/cache-life' // = {revalidate: 31_536_000}
export default {cacheComponents: true, cacheLife: {default: sanity}} satisfies NextConfig
```

```ts
// sanity/lib/live.ts
export const {sanityFetch, SanityLive} = defineLive({client, serverToken: token, browserToken: token, strict: true})

export async function getDynamicFetchOptions(): Promise<{perspective: LivePerspective; stega: boolean}> {
  const {isEnabled} = await draftMode()
  if (!isEnabled) return {perspective: 'published', stega: false}
  const perspective = await resolvePerspectiveFromCookies({cookies: await cookies()})
  return {perspective: perspective ?? 'drafts', stega: true}
}
export async function sanityFetchStaticParams({query, params = {}}) {
  'use cache'
  return {data: (await sanityFetch({query, params, perspective: 'published', stega: false})).data}
}
export async function sanityFetchMetadata({query, params = {}, perspective}) {
  'use cache'
  return {data: (await sanityFetch({query, params, perspective, stega: false})).data}
}
```

```tsx
// page: orchestrator → dynamic → cached
export default async function ProductPage({params}: PageProps<'/product/[slug]'>) {
  if ((await draftMode()).isEnabled)
    return <Suspense fallback={…}><DynamicProductPage params={params} /></Suspense>
  const {slug} = await params
  return <CachedProductPage slug={slug} perspective="published" stega={false} />
}
async function DynamicProductPage({params}) {
  const [{slug}, opts] = await Promise.all([params, getDynamicFetchOptions()])
  return <CachedProductPage slug={slug} {...opts} />
}
async function CachedProductPage({slug, perspective, stega}) {
  'use cache'
  const {data} = await sanityFetch({query: PRODUCT_QUERY, params: {slug}, perspective, stega})
  …
}
```

```tsx
// root (or route-group) layout. Must NOT wrap an embedded /studio route
const {isEnabled: isDraftMode} = await draftMode()
<SanityLive includeDrafts={isDraftMode} />
{isDraftMode && <VisualEditing />}
```

Rules from the doc:
- Every async function that calls `sanityFetch` needs `'use cache'` or `'use cache: remote'`.
- Don't hardcode `published`/`false` inside cached content components. Resolve those values outside the cache boundary and pass them in as props.
- Never accept `perspective`/`stega` as server-action input.
- Route handlers use `stega: false`.
- Use `sanityFetchMetadata` in `generateMetadata`, `sitemap.ts` and `opengraph-image.tsx`.
- Render exactly one `<SanityLive>` and one `<VisualEditing>`.
- Test both draft and non-draft mode in `next dev`. `next build --debug-prerender` alone isn't enough.
- If the route has a sibling `loading.tsx`, it can await `params` and `getDynamicFetchOptions()` directly, without its own Suspense boundary.

**generateStaticParams:** `perspective: 'published', stega: false` inside a `'use cache'` helper (above). In the non-cacheComponents guide, `sanityFetch({query, perspective:'published', stega:false})` works directly ([VE guide](https://www.sanity.io/docs/visual-editing/visual-editing-with-next-js-app-router)).

**Draft mode and perspectives:**
- `defineEnableDraftMode` validates the Presentation secret and enables `draftMode()`. It then sets the `sanity-preview-perspective` cookie, and `sanity-preview-variant` when a variant is selected. Since 13.1.4 cookies are CHIPS-`Partitioned` in cross-site iframes, so Safari works.
- `<VisualEditing>` wires `onPerspectiveChange` to a server action that rewrites the perspective cookie and calls `refresh()`. That is how Content Release perspectives selected in Presentation reach `resolvePerspectiveFromCookies` (for example `["rXXXX","drafts"]`).

---

## 2. Cost model and how to reduce it

### 2.1 What is billed ([Plans and payments](https://www.sanity.io/docs/platform-management/plans-and-payments), [pricing](https://www.sanity.io/pricing))

| Metric | Free | Growth ($15/seat/mo) |
|---|---|---|
| API requests (`*.api.sanity.io`, excl. OPTIONS) | 250k, hard cap | 250k, then $1 per 25k |
| API CDN requests (`*.apicdn.sanity.io`) | 1M, hard cap | 1M, then $1 per 250k |
| Bandwidth (API + CDN + assets) | 100 GB | 100 GB, then $0.30/GB |
| Live connections (per dataset) | 1k | 1k (Enterprise custom) |
| Live retention (event replay) | 15 min | 15 min |
| Functions (org-wide) | n/a | 500k invocations (+$1/1M), 20k GB-s (+$1/20k) |

- **Not billed:** 4xx/5xx responses, OPTIONS requests, and requests from Sanity Studio, Dashboard and other first-party apps (their request tags start with `sanity.`). **Requests made from inside a Sanity Function do count.**
- **Live Content API ([doc](https://www.sanity.io/docs/content-lake/live-content-api)):** the docs say "Live connections don't request data … new requests contribute to your API usage quota". The stream itself is redirected to the live API and never served from the CDN.
  - Beyond the connection limit the server sends `goaway` ("connection limit reached"). `<SanityLive>` then falls back to **polling**, which issues `router.refresh()` and therefore extra requests. Pass `onGoAway` with a long interval, or `false`, if that matters.
- **API vs API CDN:** the CDN quota is 4× larger, and it is 10× cheaper per overage request ($1/250k vs $1/25k).

### 2.2 Does Live reduce requests compared with ISR or webhooks?

- **Live vs time-based ISR:** the docs say yes for time-based ISR. `fetchOptions.revalidate` was removed because "time-based revalidation ended up causing many unnecessary ISR writes" ([migration](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/MIGRATE-v12-to-v13.md#fetchoptions-removed-from-definelive)). With sync tags plus `cacheLife: sanity` (365 days), a cache entry is refetched only when content it actually depends on changes.
- **The v12 trap ([help article](https://www.sanity.io/docs/help/nextjs-16-sanitylive-status)).** On next-sanity v12 with Next 16:
  - `revalidateTag(tag,{expire:0})` from live events cleared the client router cache.
  - Next 16 incremental `<Link>` prefetch then refetched every visible link (sanity.io saw 7 `?rsc` requests on v16 vs 2 on v15).
  - Prefetches that hit a revalidated route each triggered a Sanity fetch and an ISR write.
  - The result was **4× average and 7–10× worst-case** request growth.
  - v13 fixes this by switching to `revalidateTag(tag,'max')`. The upstream cause is still open as [vercel/next.js#93210](https://github.com/vercel/next.js/issues/93210).
- **Live vs a webhook:** a sync-tag-function setup is the "webhook done right". It is triggered by actual sync-tag invalidation (precise tags, not hand-maintained type→tag maps), and it releases events to browsers only after the cache is invalidated (`waitFor="function"`).
  - The docs call it "the recommended way to opt in to guaranteed live content updates" ([migration](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/MIGRATE-v12-to-v13.md#opting-in-to-guaranteed-live-content-updates), [quickstart](https://www.sanity.io/docs/functions/sync-tag-function-quickstart)).
  - Keep **one** sync-tag function per dataset and scope it with `event.resource`. Multiple functions cause "race conditions … or increased usage".
  - Its `done()` callback must succeed, or clients waiting with `waitFor=function` never receive the event.
  - Endpoint: `revalidateTag(\`sanity:${tag}\`, 'max')`. Use `{expire:0}` only if you want v12-style instant updates.

```ts
// sanity.blueprint.ts
defineSyncTagInvalidateFunction({name: 'invalidate-tags', event: {resource: {type: 'dataset', id: '<projectId>.<dataset>'}}})
// functions/invalidate-tags/index.ts → POST tags to https://site/api/revalidate-tags?secret=… then `await done(event.data.syncTags)`
```

### 2.3 Cost-reduction practices (consolidated from the docs above)

1. **Use the API CDN for all published reads.** `defineLive` already forces this. For any plain `client.fetch` use `useCdn: true`. Drafts and release arrays always go to the live API, so keep them in draft mode only ([diagnose spikes](https://www.sanity.io/docs/platform-management/diagnose-api-request-spikes)).
   - The docs disagree on builds. `generateStaticParams`/builds use `useCdn:false` in the [client matrix](https://www.sanity.io/docs/nextjs/configure-sanity-client-nextjs), but `sanityFetch` uses the CDN anyway. Build traffic doesn't scale with visitors, so it is low-risk either way.
2. **Use `cacheComponents: true` with `cacheLife: {default: sanity}`.** You get one request per fetch, long-lived cache entries and tag-precise invalidation. Prefer `'use cache: remote'` for dynamic routes that would otherwise re-hit the CDN ([migration note](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/MIGRATE-v12-to-v13.md#sanityfetch-in-cachecomponents-false-mode-no-longer-caches-the-internal-sync-tag-lookup-request)).
3. **Don't fetch from the client side.** Fetch server-side inside cached boundaries. `<SanityLive>` events carry only opaque tags, so the browser needs no read requests.
4. **Keep projections narrow.** Avoid `...` and bare `->`. Request sized image URLs (`?w=…&auto=format`). Smaller responses reduce bandwidth, and fewer touched documents reduce how often an entry is invalidated ([Presentation perf](https://www.sanity.io/docs/visual-editing/presentation-performance)).
5. **Use few queries per route in draft mode.** In draft mode `<SanityLive>` does `router.refresh()`, and every `sanityFetch` re-executes uncached against the live API on every edit. Without cacheComponents that is two requests per fetch. "One query per section means two round trips per section". In production, though, splitting pays off because untouched sections stay cached.
6. **Tag requests.** Set `requestTagPrefix` on the client (for example `'web'`) and `requestTag` per `sanityFetch` (for example `'product.page'`). Tags may be up to 75 characters of `[A-Za-z0-9._-]`. You can then attribute usage in request logs ([request tags](https://www.sanity.io/docs/platform-management/reference-api-request-tags)).
7. **Render `<SanityLive>` once,** outside any embedded Studio route. Consider `onGoAway` behaviour and dropping `RefreshOnFocus`-style helpers.
8. **Don't use time-based `revalidate` for Sanity data.** Let sync tags or the function invalidate it.

### 2.4 Measuring usage

- **Manage → project → Usage tab:** compare API vs API CDN requests per month. Set a **spending alert** at the org level on Growth.
- **Request log export (self-serve):** NDJSON for up to 7 days, ≤1 GB, from the Usage tab.
  - Group by `attributes.sanity.domain` (api / apicdn / cdn), `attributes.sanity.tags[]` and `groqQueryIdentifier`. Ready-made `jq` recipes are in [Diagnose an API request spike](https://www.sanity.io/docs/platform-management/diagnose-api-request-spikes).
  - POST queries (≥11,264-char URLs) have no identifier, so tag them.
- **Defaults to watch for:** next-sanity tags its requests by default with `next-loader.fetch[.cache-components]`, `…fetch-sync-tags` and `next-loader.live`. Filter on these.

---

## 3. Presentation tool: minimal current setup

**Studio (`sanity.config.ts`)** ([Configuring the Presentation Tool](https://www.sanity.io/docs/visual-editing/configuring-the-presentation-tool)):

```ts
import {presentationTool, defineDocuments, defineLocations} from 'sanity/presentation'

presentationTool({
  previewUrl: {
    initial: process.env.SANITY_STUDIO_PREVIEW_URL || 'http://localhost:3000',
    previewMode: {enable: '/api/draft-mode/enable'}, // `disable` is typed but never called by Presentation
  },
  allowOrigins: ['http://localhost:*', 'https://www.example.com'], // optional; defaults to the origin of `initial`
  resolve: {
    mainDocuments: defineDocuments([
      {route: '/produkty/:slug', filter: `_type == "product" && slug.current == $slug`},
      {route: '/', type: 'homePage'},
    ]), // first match wins
    locations: {
      product: defineLocations({
        select: {title: 'name', slug: 'slug.current'},
        resolve: (doc) => ({locations: [{title: doc?.title || 'Untitled', href: `/produkty/${doc?.slug}`}]}),
      }),
      settings: defineLocations({message: 'Used on all pages', tone: 'caution'}),
    },
  },
})
```

- **Route matching:** since Studio **6.10.0**, `mainDocuments` routes use the **URLPattern** API instead of path-to-regexp v8. Regex params (`/:locale(en|pl)/…`), optional params (`:slug?`) and repeated params (`:path*`) work again. The catch is that a `{…}` group without a modifier is required, so write `/books{/:id}?` if the segment is optional ([changelog](https://www.sanity.io/docs/changelog/studio-Ni45LjI.md)).
- **`previewMode` as a function:** `previewMode` can be a function of `{targetOrigin}`, which lets one Studio preview several frontends.

**Next.js**

```ts
// app/api/draft-mode/enable/route.ts
import {defineEnableDraftMode} from 'next-sanity/draft-mode'
export const {GET} = defineEnableDraftMode({client: client.withConfig({token: process.env.SANITY_API_READ_TOKEN})})
// options: { client, secureDevMode?: boolean }. Sets perspective + variant cookies; uses @sanity/preview-url-secret internally
```

```ts
// client.ts: stega config lives on the client; sanityFetch turns it on only in draft mode
createClient({projectId, dataset, apiVersion: '2026-…', useCdn: true, perspective: 'published',
  stega: {studioUrl: process.env.NEXT_PUBLIC_SANITY_STUDIO_URL, /* filter: (p) => p.filterDefault(p) */}})
```

```tsx
// layout: see §1.4 (SanityLive includeDrafts + VisualEditing in draft mode only)
// optional "exit preview" link hidden inside Presentation:
'use client'; import {useIsPresentationTool} from 'next-sanity/hooks'
```

- **Import paths (v13):** `createClient`, `defineQuery`, `stegaClean` and `stegaBrand` come from `next-sanity`. `defineLive` is in `next-sanity/live`, `VisualEditing` in `next-sanity/visual-editing` and `defineEnableDraftMode` in `next-sanity/draft-mode`. `useIsPresentationTool`, `useOptimistic`, `usePresentationQuery` and `useVisualEditingEnvironment` are in `next-sanity/hooks`.
- **CORS:** add the frontend origin with **Allow credentials** (`npx sanity cors add <origin> --credentials`).
- **Avoiding stega leaks:**
  - Use `stega: false` for `generateMetadata`, sitemap, OG images, JSON-LD and route handlers. Use `stegaClean()` for comparisons, class names, URLs and dates.
  - The default stega filter already skips dates, URLs, `slug.current`, `_*` keys, `*Id` fields, and paths under `meta`/`metadata`/`openGraph`/`seo` (plus a 39-name denylist: `href`, `url`, `color`, `icon`…).
  - For a project-specific `filter` (for example skipping `jsonLd`, `cssClass` or `variant`), compose it on top of `props.filterDefault`.
  - Dev-only `<VisualEditing onSuspiciousStega={…} />` audits attributes, `<head>`/JSON-LD, scripts and textareas. Don't enable it in production.
  - Copied text is cleaned by default (`keepStegaOnCopy` opts out), and Studio 6.6+ strips stega on paste ([stega doc](https://www.sanity.io/docs/visual-editing/visual-editing-client-stega)).
- **Drag-and-drop and optimistic updates ([DnD](https://www.sanity.io/docs/visual-editing/enabling-drag-and-drop), [useOptimistic](https://www.sanity.io/docs/visual-editing/useoptimistic-reference)):**
  - Add `data-sanity={createDataAttribute({id, type, path: 'sections:<_key>'})}` on array children. Drag is enabled automatically.
  - Use `useOptimistic(passthrough, (state, action) => action.id === pageId ? action.document.sections : state)` in a **client** component. It is a no-op outside Presentation.
  - Customize with the attributes `data-sanity-drag-disable`, `-drag-flow`, `-drag-group`, `-drag-prevent-default` and `-drag-minimap-disable`.
- **2026 additions relevant here:**
  - Content Release perspectives flow through the perspective cookie, which `resolvePerspectiveFromCookies` reads.
  - **Editing variants** (next-sanity 13.2.0): a `sanity-preview-variant` cookie and the `variant` option on `sanityFetch`.
  - `stega: true` works on the published perspective (13.0), for example for Vercel Content Link.
  - `usePresentationQuery`, `useIsPresentationTool` and `useVisualEditingEnvironment` need only `<VisualEditing>` (13.0).
  - Since 13.0.2 document edits no longer show a refresh spinner.
  - Studio 6.17 keeps the URL fragment and draft content when "Open preview" opens a new tab.
  - Studio 6.10 shows a timeout and retry after 15 s. Next 16.2.x dev in Firefox reload-loops, so use Next 16.3 or `experimental.reactDebugChannel: false`.
  - I found no Canvas-specific Presentation feature in the docs.

---

## 4. Breaking changes

### next-sanity 12 → 13 (13.0.0, 2026-05-21; [changelog](https://www.sanity.io/docs/changelog/1b810aef-7d2e-4422-bece-dc317bbd2995.md), [MIGRATE](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/MIGRATE-v12-to-v13.md))

- `<SanityLive revalidateSyncTags>` is replaced by `action`. The default changed to `revalidateTag(tag,'max')` + `'refresh'`, and in draft mode it only does `router.refresh()`. Updates are now eventually consistent unless you use a sync-tag function with `waitFor="function"`.
- With `cacheComponents: false`, the sync-tag lookup is no longer cached (an extra CDN round trip on dynamic routes, not billed).
- Removed `refreshOnFocus` (it was on by default), `refreshOnReconnect` (on by default), `refreshOnMount` and `intervalOnGoAway`. The `onGoAway` signature is now `(event, ctx, setPollingInterval)`.
- Removed `defineLive({fetchOptions, stega})`.
- Removed the hooks `useDraftModePerspective`, `useIsLivePreview` and `useDraftModeEnvironment` (use `useVisualEditingEnvironment` and `resolvePerspectiveFromCookies`).
- `tag` became `requestTag` on both `sanityFetch` and `<SanityLive>`.
- Renamed types: `DefinedSanityFetchType` → `DefinedFetchType`, `DefinedSanityLiveProps` → `DefinedLiveProps`, `DefineSanityLiveOptions` → `DefineLiveOptions`.
- v12 minimums still apply: sanity ≥5, React ≥19.2.3, Next ≥16 ([MIGRATE-v11-to-v12](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/MIGRATE-v11-to-v12.md)).

### Within 13.x ([CHANGELOG](https://github.com/sanity-io/next-sanity/blob/main/packages/next-sanity/CHANGELOG.md))

- **13.0.2:** the action defaults to `'refresh'` when `includeDrafts` is set.
- **13.1.0:** sanity v6 monorepo.
- **13.1.7:** `<SanityLive>` no longer emits `BAILOUT_TO_CLIENT_SIDE_RENDERING` into prerendered HTML.
- **13.2.0:** variants.
- **13.3.0 (type-level break):** `sanityFetch` data is **stega-branded**. Comparing against string literals now needs `stegaClean`, or pass the literal `stega: false`. 13.3.1 relaxed assignability.
- **13.3.4:** the `unstable__adapter` and `unstable__environment` re-exports are removed, and `@sanity/client` v8 is allowed as a peer.
- **13.4.0:** raises the minimums to `@sanity/client ^7.28.0` (peer `^7.28 || ^8.11`) and `@sanity/visual-editing ^6.2.0`, and adds `.groq` type inference.

### @sanity/client 7 → 8 (8.0.0, 2026-08-12; [CHANGELOG](https://github.com/sanity-io/client/blob/main/CHANGELOG.md#800))

- Requires Node ≥22.12. The package is **ESM-only** (no CJS, no UMD, no `main`/`module`/`typesVersions`), so TypeScript needs `moduleResolution` set to `bundler`/`node16`/`nodenext`.
- The transport is fetch-based (get-it v9).
- Removed `requester`, the per-request `proxy`, `_requestHandler`/`RequestHandler`, `unstable__adapter`/`unstable__environment`, and `HttpRequestEvent`/`ResponseEvent`/`ProgressEvent`. Observable uploads emit `UploadEvent<T>`.
- Proxy env vars are read only at startup. DNS `ENOTFOUND` is retried.
- 8.1/8.2 widened the `Action` union (an exhaustive `switch` breaks) and fixed the `delete()`/`mutate()` return types.
- 8.11 adds branded-query type inference. There is no MIGRATE-v8 doc.
- For this repo: next-sanity still installs client v7, so a v8 upgrade is optional. It matters mainly for direct `@sanity/client` usage (`apps/web` lists `^7.26.2`; 13.4 requires `^7.28`).

### Sanity Studio v6 ([v6.0.0 changelog](https://www.sanity.io/docs/changelog/studio-NS4zMS4w.md))

- **v6.0.0:** Node ≥22.12, React StrictMode in dev, `auth.providers` replaces by default, groq2024 search, Vite 8. "Schemas, plugins, configuration shape, and content APIs are unchanged."
- **Presentation-relevant minors:** 6.1.0 (PT re-entry fix), 6.10.0 (URLPattern routes, preview timeout and retry), 6.12.0 (comlink stability), 6.17.0 (Open-preview fragment and drafts, locations banner).
- **⚠️ 6.10.x–6.12.x are deprecated** because of the Portable Text data-loss bug fixed in 6.14.1.

---

## 5. Uncertainties and contradictions

1. **Are Live connections billed?** Pricing lists only a 1k connections-per-dataset limit and 15-minute retention. No per-event or per-connection price is published, and the docs never say whether the EventSource GET counts as one API request. Assume refetches count and the connection itself does not. Verify in the request logs (`next-loader.live` tag).
2. **`useCdn` for builds:** the [client matrix](https://www.sanity.io/docs/nextjs/configure-sanity-client-nextjs) recommends `useCdn:false` for `generateStaticParams` and webhook revalidation. `defineLive` ignores the client's `useCdn` and always uses the CDN for published content (`cacheMode: 'noStale'` outside builds). It is unclear whether `noStale` guarantees post-publish freshness on the CDN. The code comment implies it does.
3. **Doc examples disagree.** The [VE App Router guide](https://www.sanity.io/docs/visual-editing/visual-editing-with-next-js-app-router) still shows a non-strict, non-cacheComponents setup (plain `<SanityLive />`, metadata without `perspective`). The [Cache Components guide](https://www.sanity.io/docs/nextjs/cache-components) is authoritative for this repo (cacheComponents: true).
4. **The default is now "less live".** v13's default is a deliberate trade-off until next.js#93210 is fixed. Expect that default to change again in a future minor. Watch the next-sanity changelog.
5. **`waitFor="function"` with `revalidateTag(...,'max')`:** the docs recommend `'max'` but say `{expire:0}` gives v12-style instant updates. Cost per option on Vercel (ISR writes) isn't quantified.
6. **Presentation in draft mode can't be scoped on Next.js.** The docs state that a custom `action` "cannot help" because draft mode bypasses the cache, so every edit re-renders the whole route. That is a latency and live-API-request cost in the Studio, and the only levers are fewer and narrower queries and Suspense streaming.
7. **Disable route:** Presentation never calls `previewMode.disable`, even though it is in the types.
8. **The "experimental cache components" variant is gone.** `EXPERIMENTAL-CACHE-COMPONENTS.md` now only redirects. Older blog posts that mention `next-sanity/experimental/*` are stale.
