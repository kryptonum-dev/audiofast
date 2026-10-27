# 03 — Presentation tool (visual editing) reference: lsse-www + Najbar → audiofast

Researched 2026-10-26, read-only. Sources: the three archived change folders named in the brief (every document read in full; the ~200 evidence files under the lsse `walkthrough/run-*/evidence/` were read selectively, by name and by grep for the decisive ones — they are raw transcripts), other `context/` mentions, and live code in both repos at their current HEADs (lsse `16f9c8a8`, Najbar `5ca0478`).

Path conventions: `lsse:` = `/Users/oliwiersellig/Kryptonum/lsse/lsse-www/`, `najbar:` = `/Users/oliwiersellig/Kryptonum/Najbar/`, `af:` = `/Users/oliwiersellig/Kryptonum/audiofast/`. Archive folders:
- `lsse:context/archive/2026-09-04-presentation-walkthrough/` (abbreviated **LW/**)
- `najbar:context/archive/2026-07-23-m13-5-revalidation-visual-editing/` (**M135/**)
- `najbar:context/archive/2026-07-27-presentation-dnd-sorting/` (**DND/**)
- `najbar:context/archive/2026-07-28-live-content-api-adoption/` (**LIVE/**, the follow-up that changed Najbar's live code after M135)

---

## 0. Summary

1. **Both siblings run the same runtime skeleton**, which Najbar copied from Sanity's `turbo-start-sanity` starter and lsse copied from Najbar:
   - Studio `presentationTool({ title: 'Podgląd', previewUrl: { initial: getPresentationUrl, previewMode: { enable: '/api/draft-mode/enable' } }, allowOrigins, resolve: { locations, mainDocuments } })` plus an "Otwórz w podglądzie" document action.
   - Web: a 1-line `defineEnableDraftMode({ client })` route, `defineLive({ strict: true, serverToken, browserToken })`, `getDynamicFetchOptions()` (draft cookie → `{perspective, stega}`), a three-layer page dispatcher, and `{isDraft && <PreviewBar/><VisualEditing/><SanityLive includeDrafts/>}` in the root layout.
   - Stega is filtered on the base client by **leaf field name** (`STEGA_LOGIC_ONLY_FIELDS`). Metadata, JSON-LD, sitemap and `generateStaticParams` are hard-pinned to `perspective: 'published', stega: false`.
   - `data-sanity` comes from one draft-gated `getDataAttribute()` helper and is applied once per block in `PageBuilder`.
2. **Neither is simple, and lsse especially is not.**
   - lsse: ~2,400 lines in `apps/studio/presentation/` (locations, paginated-parent resolution, news pagination, preview-target resolver, contextual tool menu, slug-follow navigation). Also ~104 `STEGA_LOGIC_ONLY_FIELDS`, 724 `stegaClean` calls, 214 `data-sanity` sites in 83 files, 22 "drag-surface" helper files, a 1,232-line stega crawler, six gate tests, and an optimistic reorder layer.
   - Najbar is the leaner reference: ~470 lines of Studio presentation code, 10 stega-filtered fields, 17 `stegaClean` calls, 63 `data-sanity` sites in 26 files. Even so, it annotated *every* nested array (7-phase DnD change), which is the part to skip.
3. **The lsse audit was the valuable artifact**, and it is reusable almost verbatim:
   - Tier 0: deterministic gates, starting with a published + draft crawler that fails on any stega marker where a machine reads it.
   - Tier 1: an LLM-driven browser walkthrough under an immutable run-folder contract. 65 scenario rows in suites P, A, B, C, D, E, F, G, H, I, J, each with a literal DOM/GROQ PASS observable, plus a deterministic results summariser and a GROQ-asserted draft cleanup.
   - It found **5 real defects** on its first run, and a stega leak in an `aria-label` on the first crawl. Final tally: 56 PASS / 0 FAIL / 9 BLOCKED. Section 3 reproduces it in re-runnable detail.
4. **The stega leaks in production were zero.**
   - Published crawl: 711, then 744 URLs, 0 findings, 0 `data-sanity`.
   - Every real leak was **draft-only**: the `aria-label` on the `/en/about-us/re-action/` CTA, `videoEmbed.title` reaching `<iframe title>` and `aria-label`, and emptiness predicates that are truthy on a cleared string.
   - lsse also found that its hand-rolled `STEGA_CHARS` regex stripped the wrong Unicode block (TAG U+E0000–E007F) for weeks. The real alphabet is U+200B/U+200C/U+200D/U+FEFF, plus legacy U+2060–2063 and U+1D173–1D17A.
5. **For audiofast, the simple target** is Najbar's skeleton minus the DnD sweep, minus lsse's navigation/pagination machinery, and minus the optimistic layer:
   - block-level `data-sanity` only;
   - a hand-written `mainDocuments` route list;
   - `locations` for routed types plus a small static-message map;
   - a short stega filter list;
   - a `stegaClean` rule for machine-read strings;
   - draft-gated SanityLive;
   - one crawler gate.

   Then run the lsse audit, trimmed to the suites that apply. Section 6 spells it out.
6. **Audiofast history matters.** Audiofast had the full Presentation stack at bootstrap and deliberately removed it in commit `a73f098` (2025-09-21, "feat: add custom Image, PageBuilder, PortableText"; it deleted `apps/studio/location.ts`, `plugins/presentation-url.ts`, `api/presentation-draft`, `api/disable-draft`).

   Today it runs the "two-domain" model: `af:apps/web/src/global/sanity/client.ts:49-55` switches `useCdn`/token on `IS_PRODUCTION_DEPLOYMENT` and `perspective` on `VERCEL_ENV`, and attaches a token named **`NEXT_PUBLIC_SANITY_API_READ_TOKEN`** (`client.ts:30-33`).

   Najbar's research (M135/research.md, "Pillar 3") listed that model's pain points: a preview-cache regression, a draft-leak surface on a public preview domain, and perspective-flag churn. That is the "why" for doing this.

---

## 1. lsse-www presentation setup (live code, HEAD `16f9c8a8`)

### 1.1 Studio

**`lsse:apps/studio/sanity.config.ts`**
- `:305-308`: `PRESENTATION_ORIGINS = ['http://localhost:3000', 'https://lsse-www.vercel.app']`. The comment warns that each origin also needs a Sanity CORS entry **with credentials**, because unattended `cors add` defaults to `allowCredentials: false`.
- `:321-332`: `getPresentationUrl()`, resolved lazily. It returns `http://localhost:3000` in dev, otherwise `SANITY_STUDIO_PRESENTATION_URL`, and throws only when the tool opens, so a misconfigured build still boots. `SANITY_STUDIO_*` is inlined at build time.
- `:344`: `studio: { components: { toolMenu: ContextualToolMenu } }`. This `@beta` hack makes the „Treść”/„Podgląd” tabs carry the open document (studio-workshop-fixes-2026-10). Skip it for audiofast.
- `:346-363`: `presentationTool({ title: 'Podgląd', previewUrl: { initial: getPresentationUrl, previewMode: { enable: '/api/draft-mode/enable', shareAccess: true } }, allowOrigins: PRESENTATION_ORIGINS, resolve: { locations, mainDocuments } })`.
  - The comment on `shareAccess: true` explains it is "the ONLY working 'open draft preview in a tab' path". The plain "Otwórz podgląd" URL does not carry drafts, because the iframe's CHIPS-partitioned cookie is invisible to a new tab.
- `:493`: `OpenInPresentationAction` is appended to every type's actions (`plugins/presentation-url.ts`, 196 lines). It was later rewritten to an `edit` intent with `mode: 'presentation'` (studio-workshop-fixes-2026-10).

**`lsse:apps/studio/presentation/`** (2,437 lines including tests)
- `routes.ts:88` `HREF_EXPRESSIONS` is **generated** from `SLUG_CONFIGS` (`utils/slug-validation.ts:197`, about 35 routable types, two locales) via `hrefExpression()` (`:69`) and `localizedExpression()` (`:45`).
  - `TITLE_EXPRESSIONS` is hand-kept (`:108`).
  - `PARENT_LOCATIONS` is hand-kept (`:282`, "listing pages also show this doc").
  - `hrefQuery()` (`:321`) feeds the open-in action.
- `locations.ts` is the "Used on" resolver:
  - `STATIC_LOCATIONS` (`:59`, 11 types with a Polish message: navigation, footer, settings, analytics, notFound, redirect, calculator*, tag, accentColor).
  - `REFERENCED_ONLY_TYPES` (`:124`, 11 types resolved by `references($id)`).
  - `locations` (`:311`) returns a static state, or `context.documentStore.listenQuery({ fetch, listen: '*[_id in [$id,$draftId] || references($id)]' }, …, { perspective: params.perspectiveStack || 'drafts' })`, piped through `news-pagination.ts` / `parent-pagination.ts` for paginated parents.
  - It returns `null` (no panel) for any type in no list. That bug class was caught by a test.
- `locations.ts:431-508` `buildMainDocuments()`: route → document, **generated** per locale from `SLUG_CONFIGS`.
  - Pin singletons get `filter: _type == X && language == L`.
  - Authored slugs are matched per collision group (`page` + `legalDocument` share `/:slug`).
  - Paginated families get a `/strona/:page` twin.
  - Patterns are sorted deepest-first, so the first match wins (`/landing/:slug` before `/:slug`).
- Tests: `locations.test.ts` (every schema doc type ∈ routed ∪ static ∪ referenced; landing before root; `PAGINATED_TYPES` ↔ `next.config.ts` page-1 redirects), `presentation-url.test.ts`, `preview-target.test.ts`, `contextual-tool-menu.test.ts`, `slug-preview-navigation.test.ts`, `news-pagination.test.ts`, `parent-pagination.test.ts`.

### 1.2 Web

- `lsse:apps/web/src/app/api/draft-mode/enable/route.ts:19`: `export const { GET } = defineEnableDraftMode({ client: sanityClient })`. The comment covers the CHIPS `Partitioned` cookie being added only in the cross-site iframe in production ("Safari drops the cookie outright and preview silently shows published content") and why this is a route rather than a server action. Disabling is a server action (`app/actions/draft-mode.ts`) called by `PreviewBar`.
- `lsse:apps/web/src/global/sanity/live.ts`
  - `:54-67` defines `defineLive({ client, serverToken: SANITY_AUTH_TOKEN, browserToken: SANITY_API_READ_TOKEN, strict: true })`. The comment notes that `strict` is mandatory under `cacheComponents`, because non-strict silently renders published under draft.
  - `:75` adds a second "uncapped" `defineLive` for large draft queries.
  - `:126-135` `getDynamicFetchOptions()` returns `{ perspective: resolvePerspectiveFromCookies() ?? 'drafts', stega: true }` in draft mode, and `{ 'published', false }` otherwise.
  - `notFoundUnlessDraft()` lives in `metadata.ts:125`.
- `lsse:apps/web/src/global/sanity/client.ts`
  - `:35-500`: `STEGA_LOGIC_ONLY_FIELDS` (~104 leaf names).
  - `:509-547`: the base `createClient({ useCdn: false, token, perspective: 'published', stega: { studioUrl: STUDIO_URL, enabled: false, filter } })`.
  - `filter` returns false when `sourcePath.at(-1)` is in the set. A primitive-array member is checked by its parent name (`sourcePath.at(-2)`). Everything else falls through to `props.filterDefault(props)`, the vendor default (dates, URLs, `slug.current`, `_`-prefixed, `*Id`, anything under `seo`/`meta`/`openGraph`, plus a 39-name denylist).
- `lsse:apps/web/src/app/[locale]/layout.tsx:94,121-147`: `isDraft` from `draftMode()`.
  - Analytics/consent mount only when `!isDraft`.
  - The draft branch mounts `<PreviewBar/>`, `<LiveVisualEditing/>` and `<SanityLive includeDrafts/>`, plus `DraftMediaProvider` (a run-1 fix: an explicit per-embed YouTube opt-in in draft mode, because consent is suppressed there).
- `lsse:apps/web/src/global/components/layout/LiveVisualEditing/index.tsx:1-88`: a `'use client'` wrapper so a callback prop can be passed.
  - `<VisualEditing basePath="" trailingSlash onSuspiciousStega={dev ? reportSuspiciousStega : undefined} />`.
  - Dev reports are pushed onto `window.__stegaReports` and `console.warn`ed.
- `lsse:apps/web/src/global/sanity/data-attribute.ts`: `getDataAttribute({id,type,isDraft})` returns `createDataAttribute({ baseUrl: STUDIO_URL, projectId, dataset, id, type })`, or `null` outside draft. `ScopedDataAttribute` is the caller-scoped type.
- PageBuilder: `OptimisticBlocks.tsx` + `OptimisticReorder.tsx` (`useOptimistic` from `next-sanity/hooks`), same shape as Najbar (§2.2).
- `lsse:apps/web/src/global/utils/stega-text.ts:44-75`: `STEGA_CHARS` (the vendor alphabet), `stripStega`, `hasText` (strip + trim + non-empty), `hasPortableTextCopy`. These are the shared emptiness predicates (§4).
- JSON-LD: `OrganizationSchema.tsx:93` fetches with `perspective: 'published'`. `JsonLdScript.tsx` is the single emitter.
- `STUDIO_URL` is hardcoded to the deployed Studio (`constants.ts:23`). Click-to-edit from a plain draft tab therefore always opens the deployed Studio; inside the iframe it uses comlink. Expected behaviour, not a bug.

### 1.3 Gates (lsse root `package.json:25,33`)
- `bun run check:stega-leaks` runs `apps/web/scripts/check-stega-leaks.ts` (1,232 lines). Details in §3.2.
- `scripts/presentation-gates/`:
  - `enum-stega-coverage.test.ts`: every `options.list` field name ∈ the stega set ∪ the vendor denylist; 36/36 at the time.
  - `emptiness-predicates.test.ts`: no TAG-block literal anywhere; every `.trim()` under components either goes through `hasText`/`stripStega` or is allow-listed.
  - `deref-key-lint.test.ts`: no bare `refs[]->{…}` in fragments/queries, because that drops `_key` and kills drag.
  - `data-attribute-coverage.test.ts`: every registered block references `dataAttribute`, or sits in `NO_ITEM_OVERLAY` with a reason.
  - `draft-not-found-status.test.ts` and `dev-static-path-warmup.test.ts`, added in run 1.
- `scripts/walkthrough/summarize-results.ts` (120 lines, with fixtures `results.{clean,sample,malformed}.md`): validates the results table; exits 0 iff there are no FAIL rows.

### 1.4 Footprint (why lsse is the opposite of simple)

| Metric | lsse | Najbar |
| --- | --- | --- |
| Studio presentation code (incl. tests) | 2,437 lines + 196-line action + tool-menu plugin | 380 lines + 89-line action |
| `STEGA_LOGIC_ONLY_FIELDS` | ~104 names | 10 names + SVG fields |
| `stegaClean` call sites (web) | 724 | 17 |
| `data-sanity` occurrences / files with `dataAttribute` | 214 / 83 | 63 / 26 |
| "drag-surface" helpers | 22 files | 0 |
| Gates | crawler + 6 bun tests + 7 Studio test files | none (manual E2E only) |

---

## 2. Najbar presentation setup (live code, HEAD `5ca0478`)

### 2.1 Studio
- `najbar:apps/studio/sanity.config.ts`
  - `:27-31` `PRESENTATION_ORIGINS = ['http://localhost:3000','https://najbar.vercel.app','https://najbar.com.pl']`. The launch checklist (`context/foundation/launch-checklist.md:28`) records that `najbar.vercel.app` is **stale**; the real deploy is `najbar-kryptonum.vercel.app`. Lesson: verify the origin inventory.
  - `:40-52` `getPresentationUrl()`, same as lsse.
  - `:61-72` `presentationTool({ title: 'Podgląd', previewUrl: { initial, previewMode: { enable: '/api/draft-mode/enable' } }, allowOrigins, resolve: { locations, mainDocuments } })`. No `shareAccess`.
  - `:118-125` appends `OpenInPresentationAction` last, so "Publish" stays the primary button.
- `najbar:apps/studio/presentation/routes.ts` (106 lines): **hand-written**, a mirror of the web route table.
  - `HREF_EXPRESSIONS` (`:29-47`, 16 routed types as GROQ string expressions such as `'"/maszyny/" + slug.current + "/"'`; `service` goes through `pillar->slug.current`).
  - `TITLE_EXPRESSIONS` (`:50-67`), `PARENT_LOCATIONS` (`:73-84`), `hrefQuery()` (`:93-94`), `ROUTE_SEGMENTS` (`:97-106`).
  - The comment says: "Change a route in `apps/web`, change it here too."
- `najbar:apps/studio/presentation/locations.ts` (274 lines)
  - `STATIC_LOCATIONS` (`:25-42`; navigation, footer, settings, analytics, notFound, redirect).
  - `REFERENCED_ONLY_TYPES` (`:49-55`; faq, form, partner, teamMember, socialMedia).
  - `routedLocationsQuery` (`:111-127`) and `referencedLocationsQuery` (`:135-144`) build the whole `DocumentLocationsState` in GROQ, so no rxjs import is needed.
  - `locations` resolver (`:162-186`), with the reasoning for the function form over `defineLocations`: record resolvers can't run `references($id)`.
  - `mainDocuments = defineDocuments([...])` (`:200-274`): **15 hand-written entries**, literal segments before params and the `/:slug` catch-all last. Paginated routes are given as arrays (`['/akademia', '/akademia/strona/:page']`).
  - **Coverage: 16 routed + 6 static + 5 referenced = 27 types get a panel.** There is no completeness test.
- `najbar:apps/studio/plugins/presentation-url.ts` (89 lines)
  - It resolves the href with `client.fetch(hrefQuery(type), {id: getPublishedId(id)}, {perspective: 'drafts'})`, re-running on every `_rev`.
  - Then it calls `router.navigateUrl({ path: '/presentation?preview=<href>' })`.
  - With no href it shows the toast „Brak adresu strony”.
  - The action is not rendered for non-routed types.
  - lsse later found that `navigateUrl` drops the sticky `perspective` param and leaves extra history entries; it moved to `navigateIntent('edit', {id, type, mode:'presentation', preview})`.

### 2.2 Web
- `najbar:apps/web/src/app/api/draft-mode/enable/route.ts:10`: `defineEnableDraftMode({ client: sanityClient })`, with the same CHIPS comment.
- `najbar:apps/web/src/global/sanity/client.ts`
  - `:46-61` `STEGA_LOGIC_ONLY_FIELDS` (kind, hoverShade, anchor, analyticsParam, analyticsValue, analyticsRole, leadSource, alt, altText, caption + SVG markup fields).
  - `:37-40`: the documented rule for new fields: "anything with `options.list`, or any string that ends up in an href, a `data-*` attribute, or a map key, belongs here — plus anything consumed by assistive tech". The filter matches the **source path**, so every branch of a `coalesce()` must be listed.
  - `:70-97` base client: `useCdn: false`, token (private dataset), `perspective: 'published'`, `stega: { studioUrl, enabled: false, filter }`.
- `najbar:apps/web/src/global/sanity/live.ts`
  - `:30-40`: `defineLive({ client: sanityClient, serverToken: SANITY_AUTH_TOKEN, browserToken: SANITY_API_READ_TOKEN /* Viewer */, strict: true })`.
  - `:55-65`: `getDynamicFetchOptions()`.
  - `:73-99`: typed `sanityFetch` wrapper (must run inside `'use cache'`, because syncTags call `cacheTag()`).
  - `:106-127`: `sanityFetchPublished` (own `'use cache'`, hard-pinned published, stega off), aliased as `sanityFetchMetadata` / `sanityFetchStaticParams`.
- `najbar:apps/web/src/app/(site)/page.tsx:16-70`: the **three-layer pattern**.
  - The uncached `Home()` reads `draftMode()`. Published renders `<CachedHome perspective="published" stega={false}/>`. Draft renders `<Suspense><DynamicHome/></Suspense>`, which awaits `getDynamicFetchOptions()` and renders the same `CachedHome` with `isDraft`.
  - `CachedHome` is the only `'use cache'` layer. Next bypasses (and never persists) `'use cache'` entries in draft mode.
- `najbar:apps/web/src/app/layout.tsx:35-63`
  - The root layout has no `'use cache'`. Reading `draftMode()` does not opt out of prerendering, because it resolves to `false` at prerender.
  - `{!isDraft && <AnalyticsRoot/>}`.
  - `{isDraft && <><PreviewBar/><LiveVisualEditing/><SanityLive includeDrafts/></>}`.
- `najbar:apps/web/src/global/components/layout/LiveVisualEditing/index.tsx:11-13`: a bare `<VisualEditing basePath="" trailingSlash />`. Refresh is SanityLive's job, and its events are document-agnostic, so they also cover chrome singletons and forms.
- `PreviewBar/index.tsx`: `dynamic(() => import('./PreviewBarImpl'), { ssr: false })`. `useIsPresentationTool` drags in about 106 KB of overlay code, so the import is split.
  - `PreviewBarImpl.tsx` renders only when `useIsPresentationTool() === false` (a plain tab, never inside the iframe).
  - It shows „Podgląd wersji roboczej” / „Wyjdź z podglądu”, calls the server action `disableDraftMode()`, then `router.refresh()`.
- `najbar:apps/web/src/global/sanity/data-attribute.ts:18-39`: `getDataAttribute` / `ScopedDataAttribute`; lsse's is a verbatim copy.
- `najbar:apps/web/src/global/components/shared/PageBuilder/index.tsx:156-201`
  - `dataAttribute = getDataAttribute({ id: documentId, type: documentType, isDraft })`.
  - Each block gets `dataAttribute?.scope(['pageBuilder', {_key}])` and is wrapped in `<div data-sanity={dataAttribute(`pageBuilder[_key=="${_key}"]`)}>` **only in draft**. The published path is a keyed `Fragment`, so there is no extra DOM.
  - Keys are bare `_key` (a duplicate-key audit was done first).
  - The result is wrapped in `<OptimisticBlocks documentId>` only in draft.
- `OptimisticBlocks.tsx`: `next/dynamic` **without** `ssr: false`. A BailoutToCSR there would strip every block from the draft SSR.
- `OptimisticReorder.tsx:36-83`: `useOptimistic` from `next-sanity/hooks`; a direct `@sanity/visual-editing` dependency would duplicate the actor singleton.
  - The reducer stores only the `_key[]` order from `action.document.pageBuilder`, and only if `action.id === documentId`.
  - Children are matched by `Children.forEach` on raw `child.key`, because `toArray` mangles keys.
  - It bails if it matches fewer children than are rendered, so a sparse document never drops sections.
- JSON-LD: `OrganizationSchema.tsx:40-42` uses `sanityFetch({ perspective: 'published', ... })`, and `JsonLdScript.tsx` is the single escaped emitter. Metadata always uses `sanityFetchMetadata`.
- Env: `turbo.json:5-11` includes `SANITY_STUDIO_PRESENTATION_URL`, `SANITY_AUTH_TOKEN` and `SANITY_API_READ_TOKEN`.

### 2.3 How Najbar got there (history worth knowing)

1. **M13.5 (2026-07-23→27)**
   - Single domain with a cookie-scoped draft; the two-domain model is "officially superseded".
   - HMAC webhook (`parseBody`/`isValidSignature`) → `revalidateTag(_type, {expire:0})`.
   - `useCdn: false`, to kill the webhook-before-CDN race.
   - **SanityLive skipped**. Refresh came first from VisualEditing's default handler, later from a custom 2.1 s `_rev` polling loop.
   - Dev was made identical to prod (localhost renders published; drafts only via draft mode).
   - Block-level `createDataAttribute` on every PageBuilder block.
   - Four editor-UX extras: exit bar, locations, Open-in-Presentation, mainDocuments.
   - Verification was **manual E2E only, no test framework**. `curl` on 2–3 production pages checked zero zero-width characters (`[​-‏⁠-⁤﻿]`) and no `data-sanity`. Chrome and Safari were checked.
2. **DND (2026-07-27)**, 7 phases annotating every authored nested array:
   - Tier 1 blocks: markup only. Tier 2 blocks: `_key` re-projection.
   - Forms (a `form` document attribute).
   - A pillar legacy-field migration to remove `coalesce()` paths.
   - Product/service/pillar/PT sections, then chrome.
   - Originally **no optimistic layer** (snap-back was accepted).
3. **LIVE (2026-07-28)**, triggered by editors complaining about 2–3 s refresh lag:
   - `defineLive` strict, a Viewer `browserToken`, draft-only `<SanityLive includeDrafts>`, and deletion of the polling loop.
   - `useOptimistic` on PageBuilder **only** (nested-array optimistic wrappers are explicitly out of scope).
   - A Sanity Function sync-tag invalidation replaced the webhook.
   - An auto-redirect Function plus Vercel Bulk Redirects.
   - Public-visitor SanityLive is "rejected permanently".

---

## 3. The lsse audit / walkthrough plan — re-runnable for audiofast

### 3.1 Why it exists, and its shape

From LW/research.md §0:
- Presentation had "never been verified in a browser". 14 change plans wrote a "drag one item" bullet that nobody executed.
- **Most failures are invisible to eyes**: stega markers in an `href`, `data-*`, `aria-label` or JSON-LD, an emptiness check that never fires, a silent drag snap-back, an absent "used on" panel.
- The plan is therefore **deterministic gates first, browser second**. The browser run asserts on DOM and Content Lake reads, never on screenshots.

Change artifacts and their order (re-create the same files for audiofast):
1. `research.md`: pipeline map, failure classes (§3.4), coverage by kind, lanes, fixtures, Tier 0/1/2, executor choice, findings in hand.
2. `decisions.md`: executor, sequencing, fixtures, fix-known-defects-first, Tier 0 scope, deploy-once, closeout, deferrals with reopen triggers.
3. `plan.md`, 7 phases:
   - Phase 1: known-defect fixes.
   - Phase 2: Tier 0 gates.
   - Phase 3: fixture seed.
   - Phase 4: walkthrough handoff (brief + run contract).
   - Phase 5: run on localhost.
   - Phase 6: deploy + deployed/Safari run.
   - Phase 7: closeout (docs drift, lessons, CLAUDE.md command row).
4. `walkthrough-brief.md`: everything the executor needs to author the test plan without asking. Sections:
   - §1 rig table + baseline;
   - §2 lanes;
   - §3 fixtures by id;
   - §4 catalogue skeleton;
   - §5 expected behaviours that look like bugs;
   - §6 surfaces + prompt template;
   - §7 pre-run checklist for the human;
   - §8 probes;
   - §9 gated order.
5. `test-plan.md`, authored by the executor from the brief:
   - §1 ground truth and frozen rig;
   - §2 execution and evidence model;
   - §3 expected behaviours;
   - §4 catalogue, where every row has Preconditions, Numbered steps, a Literal PASS observable, Evidence and BLOCKED;
   - §5 gated order;
   - §6 results convention;
   - §7 closeout.
6. `walkthrough/{README.md, loop.md, results.template.md}`: the run contract. Then immutable `run-<n>/{results.md, fixes.md?, needs-human.md?, done.md?, evidence/}`.

### 3.2 Tier 0: deterministic gates (build before any browser work)

| # | Gate | Proves | lsse implementation |
| --- | --- | --- | --- |
| 0.1 | `check:stega-leaks` crawler | **Published mode:** zero markers anywhere and zero `data-sanity`.<br>**Draft mode:** markers only in visible text. They are a finding in `<title>`, `<meta content>`, `<link href>`, JSON-LD strings, any attribute except `data-sanity*` (`href src srcset alt class id style name value lang datetime content aria-* data-*`), inline `<script>`/`<style>` (the RSC flight payload is exempt), `<textarea>`/`<input value>`/`<option value>`, and inline `<svg>`.<br>**Cross-mode:** the stega-stripped visible text (a bag of words) is identical, which catches a subtree that renders published under draft. It is informational while pending drafts exist.<br>**Either mode:** an `ssr-error` finding when React's "Switched to client rendering because the server rendering errored" template appears. | `apps/web/scripts/check-stega-leaks.ts`. Walks the sitemap plus `--probe` paths.<br>Args: `--base --out --mode published\|draft\|both --locale --concurrency --probe --limit` (a `--limit` run is never a gate). Exit codes: 0 clean, 1 findings, 2 bad arg / no sitemap / no draft session.<br>Draft cookie (`openDraftSession`, `:633-692`): read the share-access secret `*[_id=="sanity-preview-url-secret.share-access"][0].secret` (via `@sanity/preview-url-secret` constants `fetchSharedAccessQuery`), else `createPreviewSecret(client, 'check-stega-leaks', STUDIO_URL)` (60-min TTL). Then `GET /api/draft-mode/enable/?sanity-preview-secret=…&sanity-preview-perspective=drafts&sanity-preview-pathname=/` with `redirect:'manual'`, keeping all `Set-Cookie` headers. Mint cookies per run; `__prerender_bypass` changes every build.<br>Regex: `/[​‌‍﻿⁠-⁣\u{1D173}-\u{1D17A}]{4,}/gu` (`{4,}` spares ZWJ emoji). |
| 0.2 | Enum coverage test | every `options.list` field name ∈ stega set ∪ vendor denylist | `scripts/presentation-gates/enum-stega-coverage.test.ts` (source-regex over `apps/studio/schemaTypes/**`; number enums exempt) |
| 0.3 | `onSuspiciousStega` reporter | Sanity's own runtime audit (`attribute`, `head`, `script`, `style`, `form-value`, `url`) | `LiveVisualEditing` as `'use client'`, dev only → `window.__stegaReports` |
| 0.4 | Emptiness-predicate gate | no `.trim()` / `Boolean(x)` / `x \|\|` on a CMS string without stripping stega first | `utils/stega-text.ts` + `emptiness-predicates.test.ts` |
| 0.5 | `[]->` projection lint | no bare `refs[]->{…}` (drops `_key`, kills drag) | `deref-key-lint.test.ts` |
| 0.6 | Per-block `dataAttribute` coverage | every registered block threads `dataAttribute` or is on an exclusion list with a reason | `data-attribute-coverage.test.ts` |
| 0.7 | Resolver completeness | every doc type ∈ routed ∪ static ∪ referenced; `mainDocuments` ordering; paginated list ↔ `next.config` redirects | `apps/studio/presentation/locations.test.ts` |
| 0.8 | Stega-branded types audit | does `next-sanity` 13.3's `StegaBranded` reach consumers? **lsse finding: no**; `live.ts` returns `data as TResult`, which widens it away. | one-off `tsc` probe, recorded |
| 0.9 | Dataset hygiene | copy-paste stega contamination already in the Lake | `sanity migrations run strip-stega` **does not exist as a named migration**. lsse ran an equivalent read-only scan instead: 2,248 docs, 100,156 strings, 0 with 4+ stega code points (`run-1/evidence/preflight-gates.txt`). |

### 3.3 Lanes (what each environment can prove)

| Lane | Rig | Proves | Cannot prove |
| --- | --- | --- | --- |
| **[L]** | local Studio `:3333` → `localhost:3000` (human-owned servers; agents never restart/build/delete `.next`) | overlays, click-to-edit, drag, optimistic reorder, stega regressions, custom inputs, locations panel, perspective switcher, live refresh; **fixes retest in seconds** | the shipped Studio bundle, the inlined preview URL, CORS-with-credentials, CHIPS, the share link |
| **[D]** | deployed Studio → production web | all of the above for the shipped pair (every fix = push + `sanity deploy`) | fast iteration |
| **[S]** | Safari on [D] | the CHIPS-partitioned draft cookie (never fires on `http://localhost`) | anything Chromium already proved |
| **[H]** | Oliwier | dev servers, deploys, pushes, editor's-feel judgement | — |

Order: run [L] **before** deploying the Studio, so the deploy ships a verified bundle. Then [D] + [S].

This inverts M26 (analytics), where "only production is real". **Drafts only exist off production.**

### 3.4 Failure classes (map each audiofast surface onto these)

From LW/research.md §2.2. Format: class: mechanism → what to do in Presentation → what you observe when it is broken.

- **A. Stega in a machine-read value.** A leaf name is missing from the filter but feeds `===`, `switch`, `href`, `#anchor`, `data-*`, a map key, a regex, `JSON.parse`, `alt`/`aria`/`title`, a sort or `new Date()`. → Run the marker regex over every attribute and over JSON-LD. → Invisible characters in an attribute, wrong branch, `Invalid Date`, a dead anchor.
- **B. Emptiness check never fires.** Stega appends markers even to `""`, so a cleared string is truthy in draft. → Clear a field the UI hides when empty. → The element still renders in draft.
- **C. Drag hover stolen.** Stega text filling an annotated item registers its own overlay. → Drag one row of each array archetype. → A handle appears but the drag never starts.
- **D. Accent cascade** (lsse-specific `data-accent=""`). Probably N/A for audiofast.
- **E. No overlay / wrong field.** `_id` missing from a query, a block ignoring `dataAttribute`, or a raw factory object crossing into a client island. → Click every section. → No highlight, or the wrong document/field opens.
- **F. Edit does not reflect.** SanityLive unmounted or browser token missing; a plain `client.fetch`; a hardcoded published perspective; CORS without credentials; Safari without CHIPS. → Type in a field. → Nothing changes, or every draft renders as published.
- **G. Unpublished document.** href `null` (no slug), a `mainDocuments` miss, or a bare `notFound()` instead of `notFoundUnlessDraft()`. → Create a document, type a slug, "Otwórz w podglądzie". → Toast, or an iframe 404.
- **H. Reference resolves published.** A fetch doesn't thread the perspective, or the listen filter misses the draft id. → Edit a referenced document. → The embedding page stays published, or the "used on" panel is empty.
- **I. Hotspot/crop.** A consumer bypasses the image helper. → Move a hotspot. → The crop doesn't move.
- **J. Reorder snaps back / blocks vanish.** Index-suffixed keys, the wrong `useOptimistic` import, or `ssr:false` on the wrapper. → Drag a block. → Snap-back, or blocks disappear.
- **K. Locale identity.** N/A for audiofast (single locale).
- **L. Slug rename.** Preview stays on the old path. lsse run-1 E9 FAILed on this and needed a custom slug-follow component, which audiofast should **not** build; record the behaviour instead.
- **M. 404 surfaces.** `notFound` is published-pinned; data-dependent `notFound()` fires on a draft listing.
- **N. Framing / origin.** Stale `allowOrigins`, `frame-ancestors`, the inlined preview URL, Vercel SSO. → Point the Studio at an unlisted preview. → Blank iframe. In lsse it was actually rejected *before* navigation (`preview-location-input.error`).
- **O. Trailing slash.** The slashless enable route takes a 308. A slashless POST loses its body.
- **P. Transport timing.** A mutation refresh fires twice (+1000 ms). The iframe is inert until the comlink handshake (up to 15 s load + 3 s overlay). → Poll for 3 s or more.

Boundaries a tester must know (LW/walkthrough-brief §5, "expected behaviours that look like bugs"):
- Content Source Maps do **not** trace `coalesce()`, string concatenation or most `select()` results. Those values have no overlay and no stega, by design.
- Metadata, sitemap, `llms.txt`, the 404 document and JSON-LD stay **published** in draft.
- `useOptimistic` is inert outside the iframe. Touch drag is unsupported.
- The Studio caches the schema per page load; reload after a schema change.
- `PreviewBar` renders only outside the iframe; test exit in a plain tab.
- The plain "Otwórz podgląd" URL in a new tab does **not** carry drafts; only the share link does.
- Clicks and links inside annotated elements are suppressed in Presentation (accordions don't open).
- Analytics and consent are unmounted in draft.
- The first draft render on the dev server compiles on demand (10–20 s).

### 3.5 Fixtures and content safety

- **Seed one QA page**: lsse used `page.qa-presentation`, `doNotIndex: true`, **published** so the drafts ↔ published switch is testable.
  - One block per nesting archetype (flat block; one nested array; referenced items; two-level nesting; client-island-held array; listing/derived; horizontal row), about 15 blocks rather than all 89.
  - Stable, readable `_key`s (`qa-<block>-<n>`).
  - Seeded via `apply-seed.ts` (dry run first; the human runs `--execute`).
- **Name one real document per family**, frozen by `_id` + `_rev` at freeze-facts. **A pre-existing draft is a hard stop**: the document becomes read-only for the run.
- **Rules:**
  - Every write is a draft; the run never publishes.
  - Real documents revert with `client.patch(id).set(baseline).ifRevisionID(rev)`.
  - No seeds or migrations during a run.
- **Cleanup is an assertion.** A raw-perspective GROQ shows `drafts: []` for every touched id and each published `_rev` equal to its baseline. Delete drafts with `client.delete({query:'*[_id in $ids]'})` or the Studio's discard action. Ignore `sanity.previewUrlSecret` docs; they are Sanity's own short-lived session records.
- **Lesson from the BLOCKED rows:** 7 of 9 final BLOCKED rows were missing fixtures (null captions, a one-item list, a missing optional field, auto-mode with no overrides). Put **≥2 items in every array and every optional field filled** in the QA seed.

### 3.6 Scenario catalogue (65 rows in lsse; ✅ = keep for audiofast, ✂ = drop/adapt)

Row format: ID · lane · literal PASS observable. Every row also carries Preconditions, Numbered steps, an Evidence path (`evidence/<ID>-….txt|json`) and the standard BLOCKED clause: *stop on a missing fixture, a pre-existing draft, an unavailable authenticated surface, inconclusive evidence or budget exhaustion; record the exact unmet precondition; never substitute a different document.*

**P — published negative**

| ID | Lane | PASS observable | Keep? |
| --- | --- | --- | --- |
| P1 | [D] | `for p in / /<page> /<qa>; do curl -sL "$PROD$p" \| grep -c 'data-sanity'; done` prints `0` three times | ✅ |
| P2 | [D] | `check:stega-leaks --base $PROD --mode published` exits 0; findings 0, `data-sanity` 0 | ✅ |

**A — session and transport**

| ID | Lane | PASS observable | Keep? |
| --- | --- | --- | --- |
| A1 | [L] | `GET /api/draft-mode/enable/?sanity-preview-secret=…&sanity-preview-perspective=drafts&sanity-preview-pathname=/` (trailing slash) → **307**; exactly 3 `Set-Cookie` headers (`__prerender_bypass`, `sanity-preview-perspective`, a deletion for `sanity-preview-variant`); `sanity-preview-partitioned` **absent** on localhost | ✅ |
| A2 | [L] | in `/presentation?preview=/<qa>/` the iframe has `querySelectorAll('[data-sanity]').length > 0` and the body contains a unique draft string typed in the pane (within 15 s + 3 s) | ✅ |
| A3 | [L] | perspective drafts → published → drafts: edit present → absent → present; `sanity-preview-perspective` cookie `drafts → published → drafts` | ✅ |
| A4 | [D] | the share URL in a fresh tab shows the draft edit; the plain preview URL does **not** (expected) | ✅ only if `shareAccess: true` |
| A5 | [L] | plain draft tab: PreviewBar exit → `__prerender_bypass` gone, bar absent, reload has `[data-sanity]` count 0 | ✅ |
| A6 | [D] | in the deployed Studio, a dataset request from the iframe origin returns `200` with `access-control-allow-credentials: true`; no CORS console error | ✅ (capture it from the **web iframe**: lsse only had an HTTP probe and left it BLOCKED) |
| A7 | [S] | Safari: iframe body shows the draft edit; `sanity-preview-partitioned` has `Partitioned; Secure; SameSite=None` | ✅ (enable Safari Develop menu first: lsse stayed BLOCKED on this) |

**B — overlay and click-to-edit**

| ID | PASS observable | Keep? |
| --- | --- | --- |
| B1 | clicking the block wrapper opens the pane at `pageBuilder[_key=="qa-cta-1"]`; the wrapper's `data-sanity` decodes to the same path | ✅ |
| B2 | clicking a nested item opens `pageBuilder[_key==…].cards[_key==…]` | ✂ only if nested items are annotated (simple target: no) |
| B3 | referenced document: inner content opens the **referenced doc** (`faq.<id>`), outer wrapper opens the page's `items[_key]` | ✅ if any block embeds referenced docs (audiofast: FAQ? products? brands?) |
| B4 | chrome: header nav opens `navigation`, footer opens `footer` | ✅ (adapt to audiofast's settings/navbar/footer singletons) |
| B5 | inherited sections open the **owner** doc | ✂ (lsse-specific) |
| B6 | `coalesce()` values have no overlay and 0 markers in `alt` | ✅ |
| B7 | fields excluded from stega by design have no overlay (recorded as expected) | ✅ |

**C — drag-to-reorder.** Every PASS is a raw draft GROQ `*[_id=="drafts.<id>"][0].pageBuilder[]._key` matching the DOM order, an unchanged `[data-sanity]` count, and no snap-back after the second refresh.

| ID | Check | Keep? |
| --- | --- | --- |
| C1 | pageBuilder block drag (swap two blocks) | ✅ |
| C2–C5 | nested items, referenced items, two-level nesting, client-island arrays | ✂ unless nested annotation is added |
| C6–C7 | horizontal footer columns; header nav vs mobile drawer (only one DOM copy may be annotated) | ✂ (skip chrome annotation) |
| C8 | classify each unannotated array as deliberate (file-header note) or FAIL | ✅ as a doc-only row: list what is deliberately not draggable |
| C9 | drag hover not stolen by stega text | ✅ for C1 (block wrappers whose whole content is one string) |

**D — stega regressions.** One row per prior finding. For audiofast, write the rows from the audit in §6.4.

| ID | Check | Keep? |
| --- | --- | --- |
| D1–D4 | accent / height ramps | ✂ (lsse) |
| D5 | embedded video title: `<iframe title>` and play-button `aria-label` have 0 markers | ✅ |
| D6–D9 | clear a field → element disappears (topbar notice, list items, table column, FAQ fallback twins) | ✅ pattern, adapt the targets |
| D10 | `alt` attributes have 0 markers | ✅ |

**E — routing and identity**

| ID | Check | Keep? |
| --- | --- | --- |
| E1 | first-match: a route that could match two patterns opens the more specific doc | ✅ (e.g. `/produkty/:slug` vs `/:slug`, `/blog/kategoria/:slug` vs `/blog/:slug`) |
| E2 | locale twins | ✂ |
| E3 | paginated page 2 opens the index doc | ✅ if listings paginate with `/strona/:n` or a query param |
| E4 | page-1 redirect inside the iframe; the location highlight matches the final URL | ✅ if such a redirect exists |
| E5 | deleted singleton with a live pattern | ✂ |
| E6 | unrouted type: **no** "Otwórz w podglądzie" action | ✅ |
| E7 | new doc without slug → no navigation + Polish toast (lsse: „Brak adresu strony” / „Uzupełnij adres URL dokumentu, aby otworzyć podgląd.”) | ✅ |
| E8 | never-published draft with a fresh slug opens and renders (needs `notFoundUnlessDraft()`) | ✅ |
| E9 | slug rename re-navigates | ✅ but **record** the behaviour; lsse built a slug-follow component for this, which is not simple |

**F — custom inputs.** One row per patch-emitting custom input (lsse had 8). Audiofast: enumerate its custom inputs. Each row: patch shape lands in the draft and the render follows.

**G — live refresh**

| ID | PASS observable | Keep? |
| --- | --- | --- |
| G1 | editing a chrome singleton updates the open page without manual reload (assert after ≥3 s) | ✅ |
| G2 | a referenced doc's draft shows in the embedding page | ✅ |
| G3 | next-sanity's `console.debug` for `source:'mutation'` is present and harmless | ✅ |

**H — "used on" panel**

| ID | PASS observable | Keep? |
| --- | --- | --- |
| H1 | every referenced-only type shows ≥1 page, the Polish "unused" message, or the site-wide message; **never an absent panel** | ✅ |
| H2 | static-message types show their message | ✅ |
| H3 | parent-listing rows link to a page that actually shows the doc (lsse FAILed: always page 1 although the item lived on page 9) | ✅ only if `PARENT_LOCATIONS` is kept; simple target says keep parents un-paginated or omit them |
| H4 | an unused doc shows exactly „Nieużywany na żadnej stronie” | ✅ |
| H5 | resolver unit tests pass + E1 cross-check | ✅ if a completeness test exists |

**I — suppression and fail-closed**

| ID | PASS observable | Keep? |
| --- | --- | --- |
| I1 | in draft (iframe and plain tab), the consent dialog is null and there are zero GTM/Facebook resources | ✅ (audiofast has analytics + consent) |
| I2 | a draft `seo.title` edit leaves `<title>` and every `ld+json` at the **published** value with 0 markers | ✅ |
| I3 | `window.__stegaReports` is `[]` / undefined after a full scroll of `/` and the QA page (dev) | ✅ if the reporter is added |
| I4 | [D] pointing the Studio at an unlisted preview origin fails closed; restore immediately | ✅ |

**J — orderable list**

| ID | Check | Keep? |
| --- | --- | --- |
| J1 | `@sanity/orderable-document-list` drag | ✂. Note: plugin 2.0.23 writes **published** `orderRank` even when a draft exists (`run-1/evidence/J1-orderable-resume.txt`), so it violates a draft-only run. Does audiofast use orderable lists? Check before including. |

**Audiofast-only suite to add (my suggestion, not in lsse).** "B2C isolation", in draft mode on `/koszyk/`, `/koszyk/twoje-dane/`, `/konto-klienta/`, the product page "Dodaj do koszyka" path and the P24 flow:
- prices still come from Supabase;
- no stega in cart/checkout attributes or in `<input value>`;
- draft mode never changes cart/checkout server-action payloads (product names and slugs posted to the server must be `stegaClean`ed).

### 3.7 Probes (paste output into `evidence/`)

DOM (LW/walkthrough-brief.md §8.1):
```js
const STEGA = /[​‌‍﻿⁠-⁣\u{1D173}-\u{1D17A}]{4,}/gu;
// 1. markers where a machine reads them (all attributes except data-sanity*)
[...document.querySelectorAll('*')].flatMap(el => [...el.attributes]
  .filter(a => !a.name.startsWith('data-sanity') && STEGA.test(a.value))
  .map(a => ({ tag: el.tagName, attr: a.name, value: a.value.replace(STEGA, '⟨stega⟩') })));
// 2. head + JSON-LD
[document.title, ...[...document.querySelectorAll('meta[content], link[href]')].map(e => e.getAttribute('content') ?? e.getAttribute('href')),
 ...[...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent)].filter(v => v && STEGA.test(v));
// 3. overlay path of a block
document.querySelector('[data-sanity]')?.getAttribute('data-sanity');
// 4. dev runtime audit
JSON.stringify(window.__stegaReports ?? []);
// 5. cookie names (top-level tab only)
document.cookie.split('; ').map(c => c.split('=')[0]);
```
GROQ (`bun -e` with the auth token, `perspective: 'raw'`):
```groq
*[_id == "drafts.<qa-id>"][0].pageBuilder[]._key           // C rows
*[_id == $id][0]._rev                                       // baseline / revert
*[_id in $draftIds]._id                                     // pre-existing-draft hard stop (must be [])
{ "drafts": *[_id in $draftIds]._id, "revs": *[_id in $ids]{_id, _rev} }   // cleanup: drafts [] + revs == baseline
```
lsse preflight note: the generic skill query helper does **not** add `perspective=raw`, so pass it explicitly when counting drafts.

### 3.8 Rig table, baseline, pre-run checklist

- **Rig table** (one row per item, each with a **Verified** column; an unfilled cell makes the dependent rows BLOCKED):
  - local Studio URL + SHA;
  - deployed Studio app id (and whether it predates the change);
  - previewed origin + SHA (`vercel inspect`);
  - `PRESENTATION_ORIGINS`;
  - CORS-with-credentials status (`sanity cors list`);
  - share-access document existence;
  - token presence (never values);
  - dev servers up (`curl -sI`);
  - browser + engine versions;
  - `next-sanity` / `@sanity/visual-editing` / `next` versions;
  - pending-draft count at freeze.
- **Baseline table**: `_id`, `_rev` at freeze, draft existed?, restoration target. The freeze-facts read is the baseline, not a snapshot taken earlier.
- **Pre-run checklist for Oliwier** (LW/walkthrough-brief §7):
  - dev servers `:3000`/`:3333` up on the right commit;
  - QA seed executed;
  - share access enabled once from Presentation (afterwards `*[_id=="sanity-preview-url-secret.share-access"]` is non-empty);
  - Studio login in the browser profile;
  - macOS Screen Recording + Accessibility for the executor;
  - browser shields down for localhost and the prod origin;
  - tokens present in `.env.local`;
  - no migration scripts run during the window;
  - Mac on power + `caffeinate` for long unattended runs (the lsse preflight did this).

### 3.9 Run contract and loop (LW/walkthrough/README.md, loop.md)

- **One browser owner.** The main executor task owns the browser, Studio pane, Lake reads/writes, verdicts, commits and deploys. Subagents only do bounded, non-overlapping repository fixes or read-only reviews: never the browser, the Lake or a commit.
- **Immutable `run-<n>/`.**
  - `results.md`: one `Environment:` paragraph (lane, Studio origin + build SHA/app id, previewed origin + SHA, browser + engine, instrumentation, ISO start/end), then exactly one table `| ID | Result | Evidence | Notes |`. Results are only PASS/FAIL/BLOCKED. FAIL Notes start with `Cause:`. PASS Notes quote the literal decisive value.
  - `fixes.md`: only when there are FAILs. FAILs grouped by Cause, with assignment, files, gates, commit, lane confirmation and plausible-regression ids.
  - `needs-human.md`: only for a missing credential, approval or product decision.
  - `done.md`: only after the summariser exits 0 and cleanup is proven.
  - Never edit an earlier run.
- **Three anti-false-success rules** (from agent-reliability research: write-task agents complete about 47% of tasks, and 45–75% of failed runs claim success):
  1. Phases of 5–8 scenarios, each re-anchored to a named URL + `_id`. Budget exhaustion is BLOCKED, never a retry from memory.
  2. PASS only with a pasted artifact (a literal DOM/GROQ/cookie value). A PASS without one is rewritten as BLOCKED before summarising.
  3. INCONCLUSIVE is recorded as BLOCKED.
- **Loop**:
  1. Freeze facts; run the scenarios.
  2. `bun scripts/walkthrough/summarize-results.ts run-<n>/results.md`.
  3. If FAIL = 0: run the cleanup GROQ, then `done.md`.
  4. Otherwise group by Cause; bounded fixers.
  5. BLOCKED never spawns a fixer.
  6. Gates: `lint && check-types && test && check:stega-leaks` (one full crawl per run; `--limit`/`--probe` for retests).
  7. Commit `fix(<change>): <cause> (run n)`, then by lane: on [L] confirm the dev server recompiled; on [D] push + `sanity deploy` + Vercel READY + SHA check.
  8. Re-run the FAILs plus plausible regressions in a new folder.
  9. Stop after 5 iterations.
- **Prompt template** (paste per phase):

  > Run scenarios <IDs> — phase k. Re-anchor: open <URL> in the Studio pane, confirm the pane shows <_id>, quote its `_rev` from a raw GROQ read. Perform the reset, then the steps exactly. Capture a fresh DOM/GROQ/cookie/CLI artifact for every PASS observable into evidence/. PASS only if every observable matches; otherwise FAIL with "Cause: …" or BLOCKED with the exact reason (INCONCLUSIVE is BLOCKED). Every write is a draft; never publish; revert real documents with ifRevisionID. If the step budget runs out, BLOCKED for the rest of the phase.

- **Surfaces**:
  - clean draft tab: PreviewBar, DOM probes, cookies, `__stegaReports`;
  - Studio pane: edits, perspective switch, actions, locations, drag;
  - OS-level computer use: the cross-origin iframe, Safari;
  - CLI + GROQ: `_key` order, `_rev`, cleanup, tests, the crawler.

### 3.10 Gated execution order (lsse test-plan §5)

1. Freeze facts + deterministic gates; start the one full crawler in the background.
2. P1–P2, A1–A5.
3. B1–B7.
4. C1–C6.
5. C7–C9, D1–D5.
6. D6–D10, E1–E3.
7. E4–E9, F1–F2.
8. F3–F8, G1–G2.
9. G3, H1–H5, I1–I2.
10. I3–I4, J1, cleanup, summariser.

Run 1 attempts every [L] row and marks [D]/[S] rows as deferred. Run 2 confirms the fixes locally. Run 3 covers the deployed pair and Safari after the one Studio deploy.

### 3.11 What lsse actually found (calibration for audiofast)

- **Pre-fixed from research (phase 1):**
  - L1: `videoEmbed.title` reached `<iframe title>` + `aria-label` uncleaned. Fix: `stegaClean` at the render site. Never add `title` to the filter set: it is name-wide and `landingPage.title` is display copy.
  - L2–L5: emptiness predicates (`notice.text?.trim()`, amenities, table cells, `faq.question ||`) were truthy in draft. Fix: a shared `hasText()`.
  - R1: `calculatorCopy` had no resolver entry, so the panel was silently absent.
  - F8: incomplete `PARENT_LOCATIONS`.
- **First crawl (phase 2):**
  - `/szukaj/` in draft called a loader outside `'use cache'`, so `cacheTag()` threw and React silently switched to client rendering. This created the `ssr-error` class.
  - The `aria-label` leak „Go to the call⟨stega⟩ (opens in a new tab)” on `/en/about-us/re-action/`, fixed in `CsrInitiativeHero/index.tsx` with `stegaClean(cta.label)` (commit `9187e82b`).
- **Run 1, 5 FAILs:**
  - B5: inherited sections annotated with the wrong field path.
  - C1 regression: a context provider wrapped the optimistic reorder children, hiding the keyed blocks.
  - D5: draft video waited forever for consent init, which is suppressed in draft.
  - E3: news locations omitted page 2.
  - E9: preview did not follow a saved slug rename.
  - H3: parent locations always advertised page 1.
- **Lessons recorded** (`lsse:context/foundation/lessons.md:49-66`, "Presentation needs authored paths and real keyed children"):
  - Carry the authored field name into every annotation.
  - Pass keyed items directly to the optimistic component; providers go outside it.
  - Verify both the Studio pane path and the saved draft `_key` order after the second refresh.
  - "A pipeline that only fails in draft mode needs draft-runtime evidence."
- **Ops lessons:**
  - Shared dev servers broke mid-crawl (another task's edits caused HTTP 500, and the prerender manifest was corrupted). The final full crawl ran on a **byte-identical isolated production build on :3108**.
  - A full both-mode crawl of 744 URLs took about an hour on the dev server.
  - Budget the run for parallel-task interference.

---

## 4. Stega in production: leak findings and how they were prevented

**The result was zero production leaks in both repos.**
- lsse: 711 URLs (2026-09-04), then 744 URLs (2026-09-15), 0 findings, 0 `data-sanity` (`LW/stega-leaks-production.md`, `run-3/evidence/P2-production-crawler.md`).
- Najbar: a manual `curl` audit, `6.5 Stega/data-sanity audit on production HTML clean`.

**Why production stays clean (the mechanisms, in order of importance):**

1. **Stega is off at the client level and only switched on per request in draft mode**: `stega: { enabled: false, studioUrl, filter }` on the base client; `getDynamicFetchOptions()` returns `stega: true` only when `draftMode().isEnabled`. The published branch of every page passes `stega={false}` literally.
2. **`data-sanity` is draft-gated at one source.** `getDataAttribute()` returns `null` unless `isDraft && id && type`, and `PageBuilder` renders a bare `Fragment` when it is null. No other code path creates attributes.
3. **Visual-editing JS is not shipped to anonymous visitors.**
   - `<VisualEditing>`, `<SanityLive>` and `<PreviewBar>` are mounted only inside `{isDraft && …}`.
   - `PreviewBar` and `OptimisticBlocks` are `next/dynamic` split boundaries, because `next-sanity/hooks` pulls the overlay bundle (~106 KB) into any chunk that imports it statically.
   - SanityLive never mounts publicly; Sanity's Next 16 advisory documents a 4–10× request overage from always-on SanityLive.
4. **Metadata, JSON-LD, sitemap and static params are hard-pinned to published + stega off, even in draft mode:**
   - `sanityFetchMetadata` / `sanityFetchStaticParams` (`najbar:live.ts:106-127`);
   - `OrganizationSchema` with `perspective: 'published'`;
   - one escaped JSON-LD emitter;
   - lsse I2 verified that `<title>` and JSON-LD keep the published value in a draft session.
5. **Prerender is untouched.** Reading `draftMode()` in an uncached dispatcher resolves to `false` at build, so routes stay static. Najbar's plan required checking the `next build` route table after every phase.

**Draft-mode leak classes (they don't reach production, but they break preview, a11y and logic):**

| Leak | Where found | Fix pattern |
| --- | --- | --- |
| Enum/logic strings compared with `===`, used as map keys, CSS selectors, `#anchors`, `data-*` | both repos | add the **leaf name** to `STEGA_LOGIC_ONLY_FIELDS` (filter matches `sourcePath.at(-1)`, so it applies to that name everywhere) + enum-coverage test |
| Strings in `alt` / `aria-label` / `title` attributes | lsse L1, the re-action CTA; Najbar lists `alt`, `altText`, `caption` | `stegaClean()` at the render site; add to the set only if the name is never display copy. Under `coalesce(alt, asset->altText, caption)` **all three** leaf names must be listed (Najbar `client.ts:42-45`) |
| Emptiness checks (`?.trim()`, `x \|\|`, `Boolean(x)`) | lsse L2–L5 | one `hasText()` that strips the **correct** alphabet (U+200B/C/D, U+FEFF, U+2060–2063, U+1D173–1D17A), never the TAG block U+E0000–E007F |
| Primitive array members (`sizes[0]`) | lsse `client.ts` filter | check the parent segment `sourcePath.at(-2)` when the last segment is a number |
| Text inside a draggable item steals drag hover | both | `stegaClean` the item's filling strings, or leave grabbable padding |
| Values used inside client islands / server actions | lsse C5, Najbar forms | pass pre-computed `String(dataAttribute)` strings across the RSC boundary; `stegaClean` anything posted back to the server |
| Dataset contamination from copy-paste of stega'd text (pre-`@sanity/visual-editing` 5.5 / Studio 6.6) | lsse 0.9 | one read-only scan of all strings for `{4,}` stega runs (lsse: 0 of 100k) |

---

## 5. Decisions, and what was intentionally kept out

**Najbar M135 (decisions 2026-07-23):**
- Single domain with a cookie-scoped draft.
- The Studio stays cross-origin (`*.sanity.studio`). Embedding it at `/studio` was rejected. The three cross-origin requirements are: CORS **with credentials**, `allowOrigins`, and no `X-Frame-Options`/`frame-ancestors` on the site.
- `createDataAttribute` on every page-builder block, applied once in the renderer.
- Live Content API skipped for v1 (reversed a day later in LIVE).
- Dev identical to prod.
- Classic GROQ webhook for v1.
- No per-slug tags.
- No test framework.

**Najbar DND, out of scope:**
- the optimistic layer (later added for PageBuilder only);
- annotations on animated arrays (marquee with duplicated DOM, embla loop, rAF reveal timelines), because drop targets resolve by exact rect equality polled every 150 ms;
- query-ordered listings;
- Portable Text bodies;
- select options;
- primitive arrays;
- preserving interactivity in preview (no `data-sanity-drag-disable`).

**Najbar LIVE, out of scope:** public-visitor SanityLive (rejected permanently), draft caching, and **nested-array optimistic wrappers**.

**lsse walkthrough, out of scope:**
- Tier 2 deterministic Playwright replay (reopen at the next `sanity`/`next-sanity`/`next` major or at the domain flip). Its ingredients:
  - auth: `localStorage __studio_auth_token_<projectId>`;
  - the route `/presentation?preview=<path>&perspective=drafts`;
  - readiness: the comlink handshake;
  - `frameLocator` across ports;
  - Studio testids `field-<name>`, `pane-footer-document-status-pulse`;
  - `expect.poll` with a 3 s budget.
- A throwaway dataset; any publish during a run; Content Releases rows; pre-emptive annotation of every nested array.

**lsse studio-workshop-fixes:**
- `reactActivityMode` not enabled (not production-ready).
- No custom Polish „Edytuj w Treści” action.
- The `toolMenu` wrapper *was* built, on a `@beta @hidden` API that must be re-checked after every bump. Not simple; don't copy it.

---

## 6. Recommended "simple" target for audiofast

Principle: **Najbar's skeleton, block-level only, hand-written resolvers, one crawler gate, then the lsse audit trimmed.** Everything below already exists, line for line, in one of the two repos.

### 6.1 Keep (copy)

1. **Studio**:
   - `presentationTool({ title: 'Podgląd', previewUrl: { initial: getPresentationUrl, previewMode: { enable: '/api/draft-mode/enable' } }, allowOrigins: PRESENTATION_ORIGINS, resolve: { locations, mainDocuments } })`, with lazy `getPresentationUrl()` and `SANITY_STUDIO_PRESENTATION_URL` (add it to `turbo.json` `globalEnv`). Copy Najbar `sanity.config.ts:24-72`.
   - Decide `shareAccess: true` explicitly. It costs one line and enables A4 plus the crawler's draft session without minting secrets.
2. **`apps/studio/presentation/routes.ts` + `locations.ts`, Najbar-sized (~380 lines):**
   - hand-written `HREF_EXPRESSIONS`;
   - `STATIC_LOCATIONS` (settings/navbar/footer/404/redirect);
   - `REFERENCED_ONLY_TYPES` with `references($id)` + `listenQuery` (perspective = `params.perspectiveStack || 'drafts'`);
   - a hand-ordered `defineDocuments([...])` list (literal segments first, catch-all last).
   - Add **one** small completeness unit test (every document type ∈ routed ∪ static ∪ referenced). It is the cheapest guard against the "silently absent panel" bug that bit lsse.
3. **Optional "Otwórz w podglądzie" action**: copy Najbar's 89-line version, but navigate with `router.navigateIntent('edit', { id, type, mode: 'presentation', preview: href })` (the lsse fix: it keeps the perspective and adds one history entry).
4. **Web**:
   - the 1-line `defineEnableDraftMode` route;
   - a `disableDraftMode` server action + a `PreviewBar` (dynamic import, hidden inside Presentation);
   - root-layout `{isDraft && <PreviewBar/><VisualEditing basePath="" trailingSlash/><SanityLive includeDrafts/>}`;
   - analytics and consent mounted only when `!isDraft`.
5. **Fetch layer**:
   - `defineLive({ client, serverToken, browserToken /* Viewer */, strict: true })` + `getDynamicFetchOptions()`;
   - the three-layer dispatcher on routed CMS pages;
   - `sanityFetchMetadata`/`StaticParams` pinned published + stega off;
   - JSON-LD via published fetches only.
6. **Stega**:
   - base client `stega: { enabled: false, studioUrl, filter }` with a **short** `STEGA_LOGIC_ONLY_FIELDS` (aim for about 10, like Najbar), plus the documented rule from Najbar `client.ts:24-45`;
   - one `stega-text.ts` (`stripStega`/`hasText`) with the **vendor alphabet**;
   - `stegaClean` only where a CMS string reaches an attribute, a comparison or a server action.
7. **Overlays**: `getDataAttribute()` + **block-level** `data-sanity` wrappers in `PageBuilder` only (Najbar `PageBuilder/index.tsx:156-201` minus `OptimisticBlocks`). Text overlays come free via stega.
8. **One gate**: port `check-stega-leaks.ts`, or start smaller. The minimum viable version is the published-mode `curl | grep -c data-sanity` plus a zero-width regex over a sitemap walk, with a draft-mode pass using the share-access secret.

### 6.2 Deliberately skip (unless editors ask)

- Nested-array `data-sanity` (Najbar DND, lsse C2–C8, 22 drag-surface helpers). Editors reorder nested arrays in the form pane.
- `useOptimistic` / `OptimisticBlocks` (snap-back is acceptable without it; Najbar ran a full week without it).
- `contextual-tool-menu`, `preview-target` resolver, slug-follow navigation, paginated parent locations, news pagination locations (all lsse).
- Generated `mainDocuments` from a slug-config registry (lsse). Audiofast has one locale and a handful of route families, so a hand-written list is clearer.
- `onSuspiciousStega` reporter. Optional; it is about 40 lines and cheap if the I3 row is wanted.
- The six lsse `presentation-gates` tests. Port only the enum-coverage one, and only if audiofast has many `options.list` fields.
- Sanity Functions, auto-redirect, Bulk Redirects: out of scope for a Presentation change. Audiofast already has its own revalidate route.
- An orderable-document-list drag in Presentation (writes published `orderRank`).

### 6.3 Audiofast-specific notes (verify in the audiofast research track; not researched deeply here)

- The current `client.ts` env switch (`IS_PRODUCTION_DEPLOYMENT` / `VERCEL_ENV` perspective, token only off-production) must be **removed**, not reworked. This is Najbar Decision 4: one code path, drafts only via draft mode. Consequence: preview deployments and localhost stop showing drafts by default.
- The token env name `NEXT_PUBLIC_SANITY_API_READ_TOKEN` (`af:apps/web/src/global/sanity/client.ts:30-33`) has a `NEXT_PUBLIC_` prefix. Next.js inlines such values into any client bundle that imports them. Audit whether it reaches client code, then move to a server-only `SANITY_API_READ_TOKEN` plus a separate **Viewer** `browserToken` that `defineLive` delivers only in draft sessions.
- `af:apps/web/src/app/podglad/` is email/newsletter previews, not CMS preview. Don't confuse the two.
- The audiofast revalidate route (Bearer `!==` compare, a type→tag map, denormalization writes) is orthogonal to Presentation. Draft renders bypass the cache, so revalidation stays published-only.
- B2C pages (`/koszyk`, `/konto-klienta`, checkout, P24) should get draft-mode isolation rows (§3.6, suggested suite), and their server actions must never receive stega'd strings.
- Audiofast's CLAUDE.md says products carry **denormalized fields** (`denormBrandSlug`, `denormCategorySlugs`, `denormFilterKeys`). These are logic values. Their leaf names belong in the stega filter if they reach the web draft fetch, and they are a likely class-A leak source in filters and URLs.
- `@sanity/client` is already 7.26.2, `next-sanity` ^13.3.3, `next` 16.3.2, Studio `sanity` ^6.10.1. That is within next-sanity 13 peer ranges; LW notes that `next-sanity` ≥13.3.4 forwards `onSuspiciousStega`.

### 6.4 Audit for audiofast, compressed

Re-run the lsse audit (§3) with:
- lanes [L]/[D]/[S];
- one seeded `page.qa-presentation` (≥2 items per array, every optional field filled);
- the trimmed catalogue: P1–2, A1–A7, B1/B3/B4/B6/B7, C1 (+C9 for C1), D5–D10 adapted, E1/E3/E4/E6–E9, F (audiofast's custom inputs), G1–G3, H1/H2/H4 (+H5 if a test exists), I1–I4, and the B2C isolation suite;
- the same run contract, summariser, probes and cleanup assertion.

Port `scripts/walkthrough/summarize-results.ts` and its fixtures as-is (nothing in it is lsse-specific).

---

## 7. Open questions

1. **Executor.** lsse used the Codex desktop app (GPT) driving a logged-in Brave via computer use, with a later Claude-in-Chrome/extension path (the preflight shows Brave "connected through the browser extension"). Which executor for audiofast? Claude Code + Playwright MCP or Claude in Chrome would also work. The rig needs a logged-in Studio session and cross-origin iframe access.
2. **`shareAccess: true`?** Needed for A4 and the simplest crawler draft session. Enabling it once creates a no-TTL secret document; is that acceptable?
3. **SanityLive in v1, or VisualEditing's default refresh only?** Najbar's v1 without it led to editor complaints and a custom polling loop within days. Recommendation: include draft-only SanityLive from the start. It needs a new Viewer token.
4. **Optimistic PageBuilder reorder?** It is the one "extra" that editors felt in Najbar. About 85 lines, but it carries two sharp edges: no `ssr:false`, and bare `_key` React keys after a duplicate-key audit.
5. **Studio deployment and origins.** Where is the audiofast Studio deployed (`*.sanity.studio`)? Which origins go in `allowOrigins` + CORS-with-credentials (`localhost:3000`, `audiofast.pl`, `www.`?, the Vercel production URL)? Is Vercel Deployment Protection on? If so, Presentation on previews needs `@sanity/vercel-protection-bypass`.
6. **Route families.** Do product/brand/blog listings paginate (E3/E4)? Is there any route ambiguity for `mainDocuments` first-match (E1)? Are there referenced-only types (FAQ, reviews, stores, awards) that need the "used on" panel?
7. **Content safety.** Does the audiofast dataset have pre-existing drafts (hard-stop fixtures) and any running automation (denormalization recompute on publish, the CPO Excel sync) that could race walkthrough drafts? The lsse rule was no seeds or migrations during a run.
8. **Orderable lists.** Does audiofast use `@sanity/orderable-document-list`? If so, J1 stays BLOCKED in a draft-only run.
