# 01 — Najbar: Live Content API fetch layer, invalidation, and cost lessons

Research input for the audiofast Sanity modernization. Scope: goal (1), meaning `defineLive`, the fetch/query layer and invalidation, plus their cost effects. Presentation and visual editing appear only where they touch the fetch layer.

Sources read in full:
- `Najbar/context/archive/2026-07-28-live-content-api-adoption/` (change, research, plan-brief, plan)
- `Najbar/context/archive/2026-07-23-m13-5-revalidation-visual-editing/` (change, research, plan-brief, plan)
- `Najbar/context/archive/2026-07-27-sanity-gold-standard/` (change, notepad, TODOS, research)
- `Najbar/context/archive/2026-07-31-next-dev-cached-shell-hang/` (change, frame, plan-brief, plan)
- `Najbar/context/archive/2026-07-27-dependency-updates/` (change, plan-brief, plan)
- `Najbar/context/foundation/` (lessons, tech-stack, infrastructure, launch-checklist; starter-rules grepped for Sanity rules)

All of this was checked against live code at Najbar HEAD `5ca0478`, plus the installed `next-sanity@13.2.2` dist. I also diffed `defineLive` against audiofast's installed `next-sanity@13.3.3`: the same logic (see §3.6).

---

## 1. Summary

- Najbar went through two generations in five days.
  - **m13-5 (2026-07-23):** a hand-rolled `sanityFetch` with `'use cache'` inside the helper, a hand-maintained per-`_type` tag taxonomy, an HMAC GROQ webhook calling `/api/revalidate` and `revalidateTag(_type, {expire:0})`, and a 2.1 s `_rev` polling loop for draft refresh.
  - **live-content-api-adoption (2026-07-28):** replaced all of it with:
    1. a single strict-mode `defineLive` fetch that emits native `sanity:` sync tags;
    2. a Sanity Function (`defineSyncTagInvalidateFunction`) that POSTs sync tags to `/api/revalidate-tags`;
    3. `<SanityLive includeDrafts>`, mounted only in draft sessions;
    4. `useOptimistic` for PageBuilder reordering;
    5. two redirect Functions (Vercel Bulk Redirects sync, plus auto-redirect on slug change).
- **Governing rule:** "the Function is correctness, SanityLive is latency".
  - A publish with zero connected browsers must still invalidate, so the Function is mandatory.
  - SanityLive never mounts for public visitors. That is now a permanent decision, made on benefit/risk grounds rather than cost.
- **Published-site cost model.** Published HTML is fully static (`cacheComponents` + `'use cache'` + `cacheLife('sanity')`, revalidate 1 y). Freshness is tag-only. Sanity is hit only:
  - at build,
  - on the first request after a tag is expired,
  - in draft mode,
  - by the search API.
- **`defineLive` routes published reads through the Sanity API CDN.** It does this with `useCdn: true` + `cacheMode: 'noStale'`, overriding the base client's `useCdn: false`. Draft or stega reads go to the uncached API with the server token.
- **Two traps are mandatory to know:**
  - `strict: true` is required under `cacheComponents`. Non-strict mode silently resolves to `published`/`stega:false` everywhere and draft mode stops working.
  - `browserToken` is required for `includeDrafts`. Without it, the prop silently degrades and the default action becomes a no-op tag revalidation.
- **Composition rule from the dev-hang fix:** never put the App Router `children` slot inside a `'use cache'` scope. Cache leaves, not shells.
- **No request counts were measured** in any Najbar doc. The "≈ $0 delta" was modeled from Growth-plan quotas. The audiofast case study cited in Najbar's research (620k CDN req/mo caused by rendering multipliers) lives only in a conversation, not in the repo.
- **For audiofast, almost the whole fetch layer pattern is directly reusable.** The parts that need audiofast-specific design:
  - the 1007-line `/api/revalidate` route, which also performs **denormalization writes** and reverse-reference lookups that sync tags do not replace;
  - Supabase-backed (non-Sanity) cache tags;
  - the two-domain `IS_PRODUCTION_DEPLOYMENT` client switch.

---

## 2. What was built (live code, file:line)

### 2.1 Fetch layer (`Najbar/apps/web/src/global/sanity/`)

| What | Where |
|---|---|
| Single `defineLive` instance: `client`, `serverToken: SANITY_AUTH_TOKEN`, `browserToken: SANITY_API_READ_TOKEN`, `strict: true` | `Najbar/apps/web/src/global/sanity/live.ts:30-40` |
| `getDynamicFetchOptions()`: `draftMode()`, then published/stega-off, or `resolvePerspectiveFromCookies()` + `stega:true` (honors the Presentation perspective switcher and release stacks) | `live.ts:55-65` |
| Typed `sanityFetch` wrapper: infers the result type from the `TypedQuery<T>` brand; must be called inside `'use cache'` (because of `cacheTag()`); runs the SVG sanitizer on every result | `live.ts:73-99` |
| `sanityFetchPublished`, with its own `'use cache'` + `cacheLife('sanity')`, hard-pinned published + `stega:false`, for `generateMetadata` / `generateStaticParams` / `sitemap.ts` | `live.ts:106-122` |
| `sanityFetchMetadata` / `sanityFetchStaticParams` are **the same function object**, so metadata and static params for one query share one cache entry and one round trip | `live.ts:124-128` |
| Base client: `createClient` from `next-sanity`, `useCdn:false`, token (private dataset), `perspective:'published'`, `stega:{studioUrl, enabled:false, filter}` | `Najbar/apps/web/src/global/sanity/client.ts:70-97` |
| Stega logic-only field set, applied as a `stega.filter` on the **client config**, because `defineLive` has no stega option | `client.ts:46-61`, `:86-96` |
| Module-load GROQ parse gate (`groq-js`) sweeping the whole `queries` namespace, so `next build` fails on malformed composed GROQ | `client.ts:22`, `Najbar/apps/web/src/global/sanity/assert-groq.ts` |
| SVG sanitization at the single fetch choke point | `Najbar/apps/web/src/global/sanity/sanitize-result.ts:32-48` |
| `TypedQuery<T>` brand (generated types are reached through a brand, not through `SanityQueries` augmentation) | `Najbar/apps/web/src/global/sanity/types.ts:41-43` |
| Type alias layer derived from generated `*_QUERY_RESULT` types (129 hand-written types became aliases) | `types.ts:1-11` and onward |
| Queries: `export const X_QUERY: TypedQuery<X_QUERY_RESULT> = groq\`...\`` (46 queries; `defineQuery` is not used) | `Najbar/apps/web/src/global/sanity/queries.ts:66-1048` |
| Fragment factories (`imageFragment(name)` and similar), expression-bodied only (see §5) | `Najbar/apps/web/src/global/sanity/fragments.ts` |
| Typegen config: `overloadClientMethods`, path/generates targeting `apps/web` | `Najbar/apps/studio/sanity-typegen.json`; `Najbar/apps/studio/sanity.cli.ts` (watch mode off, `enforceRequiredFields: true`) |
| Root script `typegen` = `schema extract --force && typegen generate` | `Najbar/package.json:20` |

### 2.2 Cache profile

- `Najbar/apps/web/next.config.ts:12` sets `cacheComponents: true`.
- `next.config.ts:58-69` defines the named `sanity` profile:
  - prod: `{stale: 30d, revalidate: 1y, expire: 1y}`
  - dev: `{stale: 0, revalidate: 1, expire: 30d}`
- The other six built-in profiles are all overridden to 30-day windows (`:22-52`). The comment at `:16-21` states that windows are a fallback ceiling, not the freshness mechanism.

### 2.3 Route pattern (three layers; repeated on every CMS page)

- `Najbar/apps/web/src/app/(site)/page.tsx`:
  - `:18-21` `generateMetadata` uses `sanityFetchMetadata`.
  - `:30-42` the dispatcher: `draftMode()`. Draft renders `<Suspense><Dynamic/></Suspense>`; published renders `<Cached perspective="published" stega={false}/>`.
  - `:44-47` the Dynamic layer resolves `getDynamicFetchOptions()`.
  - `:49-70` the Cached layer: `'use cache'` + `cacheLife('sanity')` + `sanityFetch`.
- `Najbar/apps/web/src/app/(site)/akademia/[slug]/page.tsx` adds params:
  - `:35-49` `generateStaticParams` via `sanityFetchStaticParams` (deduped slugs).
  - `:51-69` metadata, with `notFoundUnlessDraft()` (`Najbar/apps/web/src/global/sanity/metadata.ts:36-39`).
  - `:71-98` dispatcher plus dynamic layer.
  - `:100-115` cached layer, with `notFound()` inside the cached body.
- Paginated listings: `generateStaticParams` derives the page count from a `*_TOTAL_COUNT_QUERY`, and pages past the count render on demand through `dynamicParams` (e.g. `Najbar/apps/web/src/app/(site)/akademia/strona/[page]/page.tsx:30-40`).
- Self-fetching cached leaves take `perspective`/`stega`/`isDraft` as props. Example: `Najbar/apps/web/src/global/components/layout/Header/index.tsx:35-48`.

### 2.4 Layouts and the live mount

- Root layout: `Najbar/apps/web/src/app/layout.tsx:42` reads `draftMode()` uncached (does not opt out of prerender). `:57-63` renders `{isDraft && <PreviewBar/><LiveVisualEditing/><SanityLive includeDrafts/>}`. `:56` mounts analytics only when not in draft mode.
- `(site)` layout is an **uncached** shell that composes cached leaves around `<main>{children}</main>`: `Najbar/apps/web/src/app/(site)/layout.tsx:34-50`. The comment explaining the dev-hang rule is at `:13-24`.
- `LiveVisualEditing` is collapsed to a bare `<VisualEditing basePath="" trailingSlash/>`: `Najbar/apps/web/src/global/components/layout/LiveVisualEditing/index.tsx:11-13`. The polling apparatus is deleted. `actions/draft-mode.ts` keeps only `disableDraftMode` (`Najbar/apps/web/src/app/actions/draft-mode.ts:7-9`).
- Draft enable route is the canonical one-liner `defineEnableDraftMode({client: sanityClient})`: `Najbar/apps/web/src/app/api/draft-mode/enable/route.ts:10`.

### 2.5 Invalidation (webhook route deleted)

- **Blueprint** at the repo root (next to `bun.lock`, never in `apps/studio`): `Najbar/sanity.blueprint.ts`. It declares three resources:
  - `defineSyncTagInvalidateFunction` `invalidate-sync-tags`, scoped to dataset `81ryxohl.production`;
  - `defineDocumentFunction` `sync-bulk-redirects` (`on: create/update/delete`, `_type=="redirect"`, projection `{_id}`, timeout 60);
  - `defineDocumentFunction` `auto-redirect` (`on: publish`, filter `delta::changedAny(slug.current) && defined(before().slug.current)`).
- **Functions workspace** `Najbar/apps/functions/`. Each function has its own `package.json`, because function bundles do not see root dependencies.
  - Sync-tag handler: `Najbar/apps/functions/invalidate-sync-tags/index.ts:19-66`. It uses `syncTagInvalidateEventHandler`, throws on a missing `syncTags` or env, POSTs `{tags}` to `${REVALIDATE_ENDPOINT_URL}?secret=…`, throws on non-2xx, then calls `done(syncTags)`.
- **Receiving route** `Najbar/apps/web/src/app/api/revalidate-tags/route.ts`:
  - `MAX_TAGS = 1000` (`:23`);
  - `timingSafeEqual` secret compare (`:25-39`);
  - validates `string[]` (`:53-58`);
  - `revalidateTag(\`sanity:${tag}\`, {expire: 0})` (`:70-72`);
  - returns 500 on error so the Function throws (`:79-87`).
  - There is no type allowlist: expiring an unknown tag is a no-op.
- **Deleted** (commit `571338d`): `api/revalidate/route.ts`, `global/sanity/tags.ts`, the dashboard webhook, and `SANITY_REVALIDATE_SECRET`.
- Function env is provisioned after deploy with `bunx sanity functions env add <fn> <VAR> <value>`. Vercel and `turbo.json` env do not reach Sanity infrastructure.
- Deploys are manual, via `bun run blueprints:deploy` (`Najbar/package.json:21`).

### 2.6 Direct-client reads that deliberately bypass `defineLive`

- Search API: `sanityClient.withConfig({useCdn: true})` (`Najbar/apps/web/src/app/api/search/route.ts:21-29`). Search is per-request and uncacheable, so it is routed through the CDN.
- `api/contact` and `api/newsletter` read through the base client (published).

### 2.7 Bundle fix (from the later PageSpeed audit)

Draft-only `@sanity/visual-editing` code (~225 KB gzip) was reaching every anonymous visitor. It came in through three static import edges:
- `next-sanity/hooks` in `PreviewBar` and `OptimisticBlocks`;
- the `next-sanity` **root barrel** in a `'use client'` `FormStates`.

Fixes:
- `next/dynamic` split boundaries: `Najbar/apps/web/src/global/components/layout/PreviewBar/index.tsx:13-15` (`ssr:false`) and `Najbar/apps/web/src/global/components/shared/PageBuilder/OptimisticBlocks.tsx:17` (deliberately **without** `ssr:false`, because it wraps `children`);
- importing `PortableText` from `@portabletext/react` directly (`Najbar/apps/web/src/global/components/shared/FormStates/index.tsx:3-7`).

Evidence: `Najbar/context/archive/2026-07-30-pagespeed-najbar-2026-07-30/findings.md` SC-1.

### 2.8 Commits (for `git show` diving)

- `4f535bb`: phase 1, `defineLive` + type pivot (38+ files)
- `bf45264`: phase 2, SanityLive + useOptimistic
- `f22cda4`, `5bc5609`: optimistic fixes
- `fc7ee66`, `571338d`: Function + cutover
- `eedaa2d`: bulk redirects
- `c6cfdd8`: auto-redirect
- `c11c344`: dev cached-shell fix

---

## 3. Architecture of the fetch layer (key excerpts)

### 3.1 `live.ts` (core)

```ts
const { sanityFetch: liveSanityFetch, SanityLive } = defineLive({
  client: sanityClient,
  serverToken: env.SANITY_AUTH_TOKEN,      // draft/stega reads
  browserToken: env.SANITY_API_READ_TOKEN, // Viewer token, sent to browser ONLY with includeDrafts
  strict: true,                            // mandatory under cacheComponents
});

export async function getDynamicFetchOptions() {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return { perspective: 'published', stega: false }; // prerender-safe, no cookies()
  const perspective = await resolvePerspectiveFromCookies({ cookies: await cookies() });
  return { perspective: perspective ?? 'drafts', stega: true };
}

export async function sanityFetch<T>({ query, params = {}, perspective, stega }:
  { query: TypedQuery<T>; params?: QueryParams; perspective: LivePerspective; stega: boolean }) {
  const { data, sourceMap, tags } = await liveSanityFetch({ query, params, perspective, stega });
  sanitizeSvgFields(data);
  return { data: data as T, sourceMap, tags };
}

export async function sanityFetchPublished<T>({ query, params = {} }) {
  'use cache';
  cacheLife('sanity');
  const { data } = await sanityFetch({ query, params, perspective: 'published', stega: false });
  return { data };
}
export const sanityFetchMetadata = sanityFetchPublished;     // same fn object
export const sanityFetchStaticParams = sanityFetchPublished; // => shared cache entry
```

### 3.2 `client.ts` (stega filter on the client)

```ts
export const sanityClient = createClient({
  projectId, dataset, apiVersion,
  useCdn: false,           // defineLive overrides this for its own fetches
  token: env.SANITY_AUTH_TOKEN,
  perspective: 'published',
  stega: { studioUrl: STUDIO_URL, enabled: false,
    filter: (p) => STEGA_LOGIC_ONLY_FIELDS.has(p.sourcePath.at(-1)) ? false : p.filterDefault(p) },
});
```

### 3.3 Page (three layers)

```tsx
export default async function Page() {
  const { isEnabled: isDraft } = await draftMode();
  if (isDraft) return <Suspense><Dynamic /></Suspense>;
  return <Cached perspective="published" stega={false} />;
}
async function Dynamic() { const o = await getDynamicFetchOptions(); return <Cached {...o} isDraft />; }
async function Cached({ perspective, stega, isDraft = false }) {
  'use cache';
  cacheLife('sanity');
  const { data } = await sanityFetch({ query: HOMEPAGE_QUERY, perspective, stega });
  return <PageBuilder ... isDraft={isDraft} />;
}
```

The draft branch also passes through the `'use cache'` component, and Next **bypasses** (and never persists) `'use cache'` entries while draft mode is on. next-sanity's own server action states this ("cache is bypassed in draft mode"). Drafts are therefore effectively uncached without a second, uncached code path. The original plan said "no `'use cache'` on the draft path", but that was impossible because `sanityFetch`'s `cacheTag()` throws outside a cache scope.

### 3.4 Invalidation receiver

```ts
const MAX_TAGS = 1000;
// timingSafeEqual(secret) → validate string[] → cap → 
for (const tag of tags) revalidateTag(`sanity:${tag}`, { expire: 0 });
// 500 on error so the Function throws and surfaces in `sanity functions logs`
```

### 3.5 Function handler

```ts
export const handler = syncTagInvalidateEventHandler(async ({ event, done }) => {
  const { syncTags } = event.data ?? {};
  if (!Array.isArray(syncTags)) throw new Error('Event carried no syncTags array');
  const res = await fetch(`${process.env.REVALIDATE_ENDPOINT_URL}?secret=${encodeURIComponent(secret)}`,
    { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ tags: syncTags }) });
  if (!res.ok) throw new Error(`Revalidate endpoint responded ${res.status}`);
  try { await done(syncTags); } catch (e) { console.error(e); }
});
```

### 3.6 What `defineLive` actually does (installed dist; identical in 13.2.2 and audiofast's 13.3.3)

From `next-sanity/dist/live/conditions/next-js/index.js`:
- **Lines 17-21:** the client is reconfigured to `useCdn: true, perspective: 'published', stega: false, allowReconfigure: false`.
- **Line 27:** `useCdn = perspective === 'published'`, so published reads go through the CDN and draft/release reads go to the uncached API.
- **Line 29:** `cacheMode = 'noStale'` unless `NEXT_PHASE === production-build`. Consequence: **during `next build` published reads hit the CDN without `noStale`**, so they may receive a stale-while-revalidate CDN entry.
- **Line 30:** the token is sent only when `perspective !== 'published' || stega`. Najbar still authenticates published reads, because its base client carries the token (private dataset).
- **Lines 42-47:** `cacheTag(...customTags, ...syncTags.map(t => 'sanity:' + t))`. Custom `tags` are supported and appended, which helps with mixed data sources.
- **Line 52:** `cacheLife(sanity)`, where `sanity = {revalidate: 31_536_000}` from `next-sanity/live/cache-life`. This is called inside the library in addition to the wrapper's own `cacheLife('sanity')` (see open questions).
- **Line 63:** `includeDrafts` is true only if `browserToken` is a non-empty string. Otherwise it silently becomes false.
- **Line 79:** the default action is `'refresh'` (`router.refresh()`) when `includeDrafts` is on; otherwise it is `revalidateSyncTagsAction`.
- `dist/live/server-actions/index.js`: in draft mode it returns `'refresh'`; in dev it calls `updateTag`; in prod it calls `revalidateTag(tag, 'max')` (SWR). This is the visitor-facing SanityLive path that Najbar rejected.

---

## 4. Decisions and rationale (with sources)

| Decision | Rationale | Source |
|---|---|---|
| Single domain, cookie-scoped draft mode, replacing a two-domain preview | The two-domain model is officially superseded. Audiofast's version produced a preview cache regression, a draft-leak surface and four generations of perspective flags. | `m13-5 research.md` "Pillar 3", Decisions §1-4 |
| Dev identical to prod (localhost renders published; drafts only via draft mode) | One code path; removes the `NODE_ENV` perspective switch | `m13-5 research.md` Decision 4 |
| `useCdn: false` on the base client | Avoids the webhook-before-CDN-propagation race (~30-60 s) re-pinning stale data into the Next Data Cache for weeks. (Since `defineLive`, CDN + `noStale` covers the same race for published reads.) | `m13-5 plan.md` Key Discoveries; `client.ts:74-80` |
| `revalidateTag(tag, {expire: 0})`, not `'max'` | On a low-traffic site the first post-publish visitor is usually the editor checking their change; SWR would show them stale content and generate "CMS is broken" tickets. Starter rule: use `expire:0` when tags are fine-grained and the first visitor is likely the author; use SWR `'max'` when invalidated entries face real concurrent traffic. | `live-content-api research.md` Open Q1 (resolved); `revalidate-tags/route.ts:8-15` |
| Adopt `defineLive` and drop the hand-rolled taxonomy (reversing m13-5's "keep hand-rolled") | Trigger was editor pain (2-3 s Presentation lag). Sync tags also remove the "forgot to update `tags.ts`" bug class, since Sanity computes what each query read. | `gold-standard notepad.md` §2 + decision update; `live-content-api plan-brief.md` |
| `strict: true` | Under `cacheComponents`, non-strict mode resolves to published/stega-off everywhere | `live-content-api research.md` §1; `live.ts:25-29` |
| `SanityLive` draft-scoped only, permanently | Zero visitor benefit on a marketing site. Live events have about 15 minutes of retention and no replay, so they cannot provide correctness. The Sanity Next 16 advisory documents a 4-10x request overage with always-on SanityLive + Next 16 prefetching. | `m13-5 research.md` web research; `live-content-api research.md` Architecture Insight 3; notepad §2 |
| Sync-tag Function, not a dashboard webhook | `defineSyncTagInvalidateFunction` is the official contract for native sync tags. Webhooks cannot easily compute sync tags. | `live-content-api plan.md` Key Discoveries |
| Function auth: shared secret, `timingSafeEqual`, `MAX_TAGS`, throw instead of swallowing | Closes two gaps m13-5 had dropped. Function retry semantics are undocumented, so idempotency is the safety mechanism. | `live-content-api plan.md` Critical Details |
| Named `sanity` cacheLife profile, NODE_ENV-branched | The dev/prod split lives in one place instead of 23 wrappers | `live-content-api plan.md` Phase 1 §3 |
| Drafts stay uncached | Zero stale-draft risk; caching drafts buys nothing at editor scale | `live-content-api plan-brief.md` |
| Metadata / JSON-LD / sitemap / `generateStaticParams` are always published + stega-off, even in draft sessions | Zero-width stega characters would leak into `<head>` and crawlable output | `m13-5 plan.md` "Stega hygiene"; `live.ts:101-105` |
| Type pivot to a slim alias layer derived from generated `*_QUERY_RESULT` | Single source of truth; drift becomes a compile error | `live-content-api plan.md` Phase 1 §6; commit `4f535bb` |
| Straight cutover, no parallel run (Najbar was not launched) | The site was unlaunched. A parallel run was described as cheap insurance in general, because both channels only expire tags. | `live-content-api research.md` Open Q9, Insight 5 |
| Redirects moved from build-time `next.config` to Vercel Bulk Redirects via a Function | Real 301s, live in seconds, no redeploy, CDN-level, zero function invocations, scales to 1M entries. Used the audiofast pipeline as the cautionary tale. | `live-content-api research.md` Follow-up (redirect delivery) |
| Never wrap `children` in `'use cache'` | See §5 (dev hang) | `next-dev-cached-shell-hang/frame.md` |

---

## 5. Pitfalls and bugs hit, with fixes

1. **Silent loss of draft mode in non-strict `defineLive` under `cacheComponents`.** Avoided by `strict: true` and passing `perspective`/`stega` at every call site.
2. **`browserToken` silently degrades `includeDrafts`.** Without a Viewer token, SanityLive falls back to `revalidateSyncTagsAction`, which is a no-op against an untagged fetch layer. Fix: a new `SANITY_API_READ_TOKEN` (Viewer); verify it reaches the client in draft sessions and is absent for visitors (plan 2.6). Never give it a `NEXT_PUBLIC_` prefix (`Najbar/context/foundation/infrastructure.md`, Security).
3. **No stega option on `defineLive`.** The `STEGA_LOGIC_ONLY_FIELDS` filter must live on the client config passed to `defineLive`. The filter matches the **source path leaf, not the GROQ alias**: for `coalesce(alt, asset->altText, caption)` all three names must be listed (`client.ts:42-45`).
4. **`sanityFetch` throws outside `'use cache'`.** `cacheTag()` requires a cache scope. Every call must sit inside a cached component or `sanityFetchPublished`. `generateMetadata`, `generateStaticParams` and `sitemap.ts` are not cache scopes, which is why `sanityFetchPublished` carries its own directive.
5. **LP layout depended on the old helper's internal `'use cache'` for deduplication.** When caching moved out of the helper it needed its own cached wrapper (`live-content-api research.md` §1 delta 3).
6. **`SanityQueries` augmentation was unreachable.** `groq\`\`` with fragment interpolation types as plain `string`, so result types never inferred. Fix: the `TypedQuery<RESULT>` brand on each query constant (`types.ts:36-43`; commit `4f535bb`). Typegen still generates the `*_QUERY_RESULT` types because it resolves fragments statically.
7. **Typegen silently drops queries when a fragment factory has a block body.** One block-bodied factory took typegen from 47 queries to 27 (`assert-groq.ts:14-21`). Keep factories expression-bodied and assert GROQ from module scope instead.
8. **Typegen/schema watch mode segfaults node under `sanity dev`.** Disabled (`schemaExtraction.enabled:false`); `enforceRequiredFields` is still honored. Run `bun run typegen` by hand (`Najbar/CLAUDE.md:26-30`; `sanity.cli.ts`).
9. **Dev cold loads hang indefinitely (`next-dev-cached-shell-hang`).**
   - Cause: a `'use cache'` shell wrapped `children` and contained nested Sanity cache leaves whose dev profile is `stale: 0`. Next propagates the lowest nested lifetime to the outer entry, which then falls below `RUNTIME_PREFETCH_DYNAMIC_STALE` (30 s). Next 16.2's blocking cache-miss restart then withheld the first stream (hangs over 60 s).
   - Fix: uncached layouts composing cached leaves; fetches pushed down into leaves (`(lp)` header). Cold loads dropped to 2-9 s.
   - Production side effect: route `Revalidate` moved from 30 d to 1 y, because the shell without an explicit `cacheLife` had been imposing the `default` profile's 30 d.
   - Next 16.3 (`PR #94457`) streams dev renders instead of restarting. The composition rule still stands.
   - Residual: `/lp/[slug]` still stalled intermittently in dev, independent of the shell (unresolved follow-up).
10. **Stega in page-level JSON-LD in draft renders.** `BreadcrumbList`/`FAQPage` were fed draft data, which contradicts the "JSON-LD never stega" rule. Recorded as a follow-up in `next-dev-cached-shell-hang/plan.md` "Follow-up" §2.
11. **Optimistic PageBuilder bugs.**
    - (a) The reducer re-reduces its own output across several `rebased.local` events per drag. Storing ReactNode state through `Children.toArray()` re-prefixed keys (`abc` → `.$abc` → `.$.$abc`) until every block vanished. Fix: the state is the bare `_key` order (`f22cda4`).
    - (b) A sparse event document reordered the page down to one section. Fix: match on raw `child.key` via `Children.forEach`, and fall back to server order when fewer keys match (`5bc5609`).
    - (c) The React key had to change from `` `${_key}-${i}` `` to bare `_key`. They audited for duplicate `_key`s first (zero found).
    - (d) Import `useOptimistic` only from `next-sanity/hooks`. A direct `@sanity/visual-editing` dependency breaks the actor singletons.
12. **Draft-only tooling in the public bundle.** See §2.7. Static imports of `next-sanity/hooks`, or of the `next-sanity` root barrel from `'use client'` modules, pull in about 106-225 KB. `VisualEditing` and `SanityLive` themselves are already `dynamic(..., {ssr:false})` inside next-sanity.
13. **`defineLive` in the build phase uses the CDN without `noStale`** (dist line 29). This is a theoretical stale-at-build window. Najbar records no incident. The CDN-race reasoning in `client.ts:74-80` covers runtime only.
14. **Function quirks.**
    - The blueprint must be at the repo root next to the lockfile.
    - Functions need their own `package.json`.
    - Env is set post-deploy with `sanity functions env add`.
    - `sanity functions test` delivers sync-tag events **without a payload** (CLI 7.13), hence the explicit throw.
    - Retry-on-throw is undocumented.
    - The endpoint URL needs a trailing slash, because the site 308s non-slashed paths (`launch-checklist.md` flip step 1).
    - The `done(syncTags)` call is best-effort.
15. **Freshness gap between phases.** After phase 1 deleted the call-site tags, the old webhook was a no-op until the Function went live. Accepted only because the site was pre-launch. **For a live site like audiofast, run both channels in parallel**: `defineLive` accepts custom `tags` alongside sync tags, and both channels only expire tags.
16. **Stale `.next` has poisoned builds before** (draft mode served published content). Wipe `.next` before baseline/parity builds.
17. **Dependency holds.** These are Najbar-specific but likely shared: TypeScript stays on 5.x (typescript-eslint peer below 6.1; Next 16.3's `useTypeScriptCli` is needed for TS 7); ESLint stays on 9 (`eslint-plugin-react`, `eslint-plugin-import`, `@sanity/eslint-config-studio` peers). `@sanity/client` must be ≥ 7.24 for next-sanity 13 peers (`dependency-updates/change.md`).

---

## 6. Cost-related findings

**Nothing was measured.** No Najbar doc records Sanity API/CDN request counts, bandwidth or Function invocations before or after the change. The claims are modeled.

Modeled and documented:
- Growth plan quotas cited in the 2026-07-28 research ("Related Research", conversation-sourced):
  - 250k API + 1M CDN requests/month;
  - 500k Function invocations included, $1 per 1M overage;
  - about 1k concurrent live connections;
  - SanityLive opens one SSE connection per tab, with a 30-minute listener lifetime and a fallback to 30 s polling on `goaway`;
  - each publish fans out to two round-trips per connected tab.
- The Live API docs (per notepad §2) say **every live connection counts toward API usage**. Always-on SanityLive therefore makes every visitor tab billable. The webhook/Function + ISR approach is the "cost floor".
- The Sanity Next 16 advisory (via m13-5 research): always-on SanityLive + Next 16 prefetching caused **4-10x request overage**. Mitigation: SanityLive in draft mode only, with server-side invalidation for published content.
- Worst case named in notepad §2: a misconfigured `defineLive` with no `'use cache'` makes published fetches dynamic, which costs both Sanity API requests and Vercel CPU on every page view.
- Verdict: ≈ $0 delta at Najbar's traffic. Draft-scoped SanityLive is cost-neutral (editor sessions only). Function volume is about thousands per month against 500k included.
- **Audiofast case study (from Najbar's research, conversation-only):** "620k CDN req/mo traced to rendering multipliers, not invalidation delivery." The Najbar repo has no breakdown; reconstruct it in audiofast.

Cost levers actually present in Najbar code (all directly relevant to audiofast):
1. Published HTML is static. Sanity is read only on a cache miss: at build, after `expire:0` invalidation of affected tags, in draft mode, and from the search API.
2. Published reads use the **API CDN** (`useCdn:true` + `noStale`), which has the larger quota. Only draft/stega reads use the uncached API.
3. **Per-query sync tags instead of per-`_type` tags** give a smaller invalidation blast radius, so fewer refetches per publish. Najbar asserted this but told itself to "observe, not assume" (plan, Performance Considerations); it was never measured.
4. Metadata and static params for the same query share one cache entry (same function object).
5. Long `cacheLife` (1 y revalidate in prod) means no time-based regeneration churn. Audiofast already has the same overrides, with a comment stating that 5-minute default staleness was causing ISR writes.
6. Uncacheable search goes through the CDN rather than the API (`api/search/route.ts:21-29`).
7. Out-of-scope but cost-relevant: the single-layer image pipeline (a custom `next/image` loader to `cdn.sanity.io`, with Vercel's optimizer never invoked) and a 1440 `deviceSizes` rung added to cut Sanity CDN bandwidth (`next.config.ts:71-86`).
8. Redirects through Vercel Bulk Redirects: zero function invocations and no middleware compute on every request. Audiofast currently runs a 382 KB redirect map in `proxy.ts` on every HTML request (`live-content-api research.md`, Follow-up "Audiofast evidence").

---

## 7. Reusable for audiofast vs Najbar-specific

### Directly reusable (copy the pattern almost verbatim)

- `live.ts` shape: `defineLive({strict:true, serverToken, browserToken})`, `getDynamicFetchOptions()`, the typed `sanityFetch` wrapper, and `sanityFetchPublished` with shared-object aliases for metadata and static params.
- The base client with the stega `filter` on the config, plus an audiofast-specific `STEGA_LOGIC_ONLY_FIELDS` set. Audit enums, `href`s, map keys, alt text and anything used in price or slug comparisons.
- The three-layer page pattern, and the rule that `notFound()` and request APIs stay outside `'use cache'` except for data-dependent `notFound()` inside the cached body as Najbar does.
- The named `sanity` cacheLife profile, NODE_ENV-branched.
- `/api/revalidate-tags` route and the `invalidate-sync-tags` Function plus the blueprint layout (root blueprint, `apps/functions/<fn>/package.json`, `sanity functions env add`).
- Root layout `{isDraft && <SanityLive includeDrafts/> …}`, a Viewer `SANITY_API_READ_TOKEN`, and the canonical `defineEnableDraftMode` route.
- The rule "no `'use cache'` component accepts `children`".
- Bundle hygiene: dynamic-import anything touching `next-sanity/hooks`; never import the `next-sanity` root barrel from `'use client'` files.
- Typing: `TypedQuery<RESULT>` brand + `overloadClientMethods` typegen + an alias layer; keep fragment factories expression-bodied; add a `groq-js` parse gate at module load.
- Cost guardrails: never mount SanityLive for visitors; keep published fetches inside `'use cache'`; route uncacheable search through the CDN.
- Parallel-run migration (custom `tags` plus sync tags) is the right choice for audiofast **because it is live**, unlike Najbar.

### Needs audiofast-specific design

- **Audiofast's `/api/revalidate` (1007 lines) does more than invalidation.** It runs GROQ reverse-reference lookups and category fan-out, and it **writes denormalized product fields** (`denormBrandSlug`, `denormCategorySlugs`, `denormFilterKeys`, …; see `audiofast/CLAUDE.md`). Sync tags replace the invalidation half. Reference fan-out is largely covered, because sync tags reflect what each query read, including `->` dereferences; this still needs verification on audiofast's filter queries. The **denormalization writes must move elsewhere**, for example into a `defineDocumentFunction` on publish using `context.clientOptions` for write auth. Najbar has no equivalent.
- **Supabase-backed data** (pricing, B2C) cannot emit Sanity sync tags. Pass custom `tags` to `defineLive`'s `sanityFetch` and keep custom invalidation for those, or keep Supabase reads in separately tagged cached functions.
- **Two-domain / `IS_PRODUCTION_DEPLOYMENT` client switch** (`audiofast/apps/web/src/global/sanity/client.ts:52-54`: `useCdn: IS_PRODUCTION_DEPLOYMENT`, perspective `drafts` off-Vercel, token only on non-prod). Najbar's "dev identical to prod" plus cookie draft mode replaces this. Audiofast also currently has no `draftMode()` (the stack was removed in `a73f098`), so the three-layer routing rollout covers every CMS route.
- **Private versus public dataset.** Najbar's dataset is private, so the token sits on the base client and published CDN reads are authenticated. If audiofast's production dataset is public, published reads can go tokenless; `defineLive` only sends the token for draft/stega.
- **Audiofast is already on Next 16.3.2 with `partialPrefetching: true`.** The 16.2 dev-hang mechanism is fixed upstream in 16.3, but the composition rule still applies. The Sanity advisory's "prefetching multiplies requests" warning is directly relevant if SanityLive were ever mounted for visitors, which is one more reason to keep it draft-only.
- **Existing `fetchSanityWithRetry` (3 attempts) and `noStale` in audiofast `fetch.ts`.** Decide whether to keep the retry wrapper around `liveSanityFetch`. `defineLive` already applies `noStale` at runtime, though not during build.
- Redirect Functions (Bulk Redirects, auto-redirect): reusable in concept, but audiofast's 3,161-item redirect singleton and the CSV-vs-documents split need their own decision. Najbar's rule: editorial redirects are Sanity documents synced to Bulk Redirects; bulk migration sets are a one-time `vercel redirects upload`. This is goal-adjacent rather than core.

### Najbar-only

The `pillar → service` URL reconstruction in `auto-redirect/urls.ts`, the 5 pinned singletons, `LISTABLE_TYPES`/`INDEX_TOGGLE_TYPES`, the `(lp)` route group, and the Tabler SVG sanitizer specifics (the choke-point pattern itself is reusable).

---

## 8. Open questions

1. **Real request deltas.** Najbar never measured API or CDN requests before and after. For audiofast, capture a baseline from the Sanity usage dashboard (API vs CDN, per day) **before** migrating, then compare. Also reconstruct the "620k CDN req/mo from rendering multipliers" analysis, which is not in any repo.
2. **Double `cacheLife` inside one scope.** `defineLive` calls `cacheLife({revalidate: 1y})` internally (dist line 52), and Najbar's wrapper also calls `cacheLife('sanity')`. Which call wins in the same scope (last call vs minimum) is not documented in Najbar. The shell-hang analysis shows the dev `stale:0` profile took effect, which suggests the named profile dominates there. Verify against Next 16.3 docs before relying on either.
3. **Build-phase CDN staleness.** `cacheMode` is unset during `next build`, so published build reads can receive stale CDN entries (for example, shortly after a bulk price sync). Audiofast's own `noStale` comment shows it has hit this class of bug, so it matters more there.
4. **Reference fan-out coverage of sync tags for audiofast's denormalized filter queries.** Queries that read `denorm*` fields only depend on the product document. Upstream brand or category changes reach them only once the denormalization write republishes the product. Ordering is therefore: denorm Function write → product sync tag fires → invalidate. Needs a design.
5. **Function retry semantics** are still undocumented. A transiently failed invalidation stays stale until the next publish, because the 1 y profile has no time-based fallback. Decide whether audiofast wants a shorter safety ceiling.
6. **Unresolved Najbar follow-ups that may recur in audiofast:** the intermittent `/lp/[slug]` dev stall (cause in the page or its blocks), and stega in page-level JSON-LD in draft renders.
7. Whether the Sanity Next 16 SanityLive advisory still applies to next-sanity 13.3 with `cacheComponents`. Najbar resolved this as moot by staying draft-scoped. Audiofast should do the same.
