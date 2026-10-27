# 11 — lsse-www Presentation + audit tooling → audiofast: porting map

Researched 2026-10-26, read-only. Source: lsse-www at HEAD `16f9c8a8` (`/Users/oliwiersellig/Kryptonum/lsse/lsse-www/`, below `lsse:`). Target: audiofast (`/Users/oliwiersellig/Kryptonum/audiofast/`, below `af:`). Read first: `03-presentation-reference.md` (what lsse/Najbar built and why, the audit catalogue). This file maps **files**, and does not repeat the catalogue.

Scope is set by `decisions.md` D4/D5/D8:
- lsse-complete Presentation: every doc type has locations / mainDocuments / static / referenced, stega with a leaf filter, `data-sanity`, optimistic PageBuilder reorder, nested-array drag at lsse level, PreviewBar, „Otwórz w podglądzie” via `navigateIntent`, `shareAccess: true`, draft-only SanityLive;
- origins `http://localhost:3000` and `https://audiofast.pl`;
- the audit runs in Claude in Chrome, with no Safari lane;
- the QA page is seeded in the production dataset.

Verdicts:
- **COPY**: byte-for-byte, or with only import-path and test-API edits.
- **ADAPT**: the mechanism is ported and the inputs change. The table says what changes.
- **SKIP**: the problem the file solves does not exist in audiofast. A reason is given each time, and "too complex" is never the reason.

Audiofast facts the verdicts lean on (all checked in code today):
- **One locale.** No `language` field, no `_translations`, no `/en` prefix.
- **Slugs are full stored pathnames** (`/produkty/foo/`). Exceptions: `productCategorySub` is stored as `/kategoria/<x>/` but served at `/produkty/kategoria/<x>/`, and review PDFs live under `pdfSlug` (`05-audiofast-presentation.md` §4.1).
- **Listings paginate with `?page=N`**, not a `/strona/<n>` path segment (`blog/(listing)/page.tsx:20`, `produkty/(listing)/page.tsx:34`; `BLOG_ITEMS_PER_PAGE = PRODUCTS_ITEMS_PER_PAGE = CPO_ITEMS_PER_PAGE = 12`). The product default sort is `orderRank` (`constants.ts:83`).
- **Paths.** PageBuilder is `af:apps/web/src/components/shared/PageBuilder.tsx`. Blocks live in `af:apps/web/src/components/pageBuilder/<Pascal>/` (22 folders). The block registry is `af:apps/studio/schemaTypes/blocks/index.ts` `pageBuilderBlocks`.
- **No framing headers.** There is no `X-Frame-Options` and no CSP in `af:apps/web/next.config.ts` or `src/proxy.ts`, so nothing blocks the iframe today.
- **Studio host** is `audiofast` (`sanity.cli.ts:11`, appId `dlwt2zhgkk7rjx6dj8rdyjfz`).
- **Test runners.** Studio has **no test runner**. Web uses vitest 4 (`apps/web/vitest.config.ts`, `include: ['src/**/*.test.{ts,tsx}']`, jsdom).
- **`@sanity/preview-url-secret` 4.1.5** is hoisted at the root `node_modules`, next to `next-sanity` 13.3.3.
- **Orderable lists.** `@sanity/orderable-document-list` is used (`award`, `brand`, …). That is relevant to J1.
- **Gate surfaces measured today:**
  - 29 bare `[]->` in `af:apps/web/src/global/sanity/query.ts`;
  - 41 `.trim()` under `af:apps/web/src/components`;
  - 11 `list:` enums under `af:apps/studio/schemaTypes`;
  - consent lives in `components/shared/CookieConsent` plus `Analytics.tsx`, mounted unconditionally at `app/layout.tsx:76-77`;
  - no media embed waits on consent (YouTube/Vimeo blocks have no consent check).

---

## 1. Summary

1. **Studio, 17 files, ~4,000 lines in scope.**
   - **Routing tables (ADAPT).** `presentation/routes.ts` and `locations.ts` port as mechanisms. Their *derivation* from lsse's `SLUG_CONFIGS` / locale registry does not. Audiofast gets a hand-written `HREF_EXPRESSIONS`, which is mostly `slug.current`, because audiofast stores full paths. The completeness test is what keeps it honest.
   - **Pagination helpers.** `news-pagination` and `parent-pagination` port as **ADAPT** with `?page=N` hrefs, for blog (date order) and product listings (`orderRank`). Only the `/strona/:page` route twins are SKIP.
   - **Navigation (ADAPT).** `preview-target.ts`, `contextual-tool-menu.tsx` and `slug-preview-navigation.tsx` drop only their language branches. The problems they solve (tabs dropping the document, the Open action needing a target, preview not following a slug rename) are generic Sanity behaviour that audiofast shares.
2. **Web, ~30 files plus the per-block wiring.**
   - **COPY:** the draft route, the disable action, PreviewBar, LiveVisualEditing, `data-attribute.ts`, `stega-text.ts`, the optimistic trio and `notFoundUnlessDraft`.
   - **ADAPT:** `live.ts` / `client.ts`, i.e. only the stega filter and the draft branch. The rest is the fetch-layer track, `02`/`04`.
   - **SKIP:** `DraftMediaProvider`, because no audiofast embed waits on consent. Keep a D-row instead.
   - **Drag surfaces:** the 10 helper modules + 7 tests are lsse-block-specific. They port as a **pattern**, re-authored per audiofast block (§4).
3. **Gates and tooling.**
   - **ADAPT:** the crawler (drop locales; add `?page=` and B2C probes) and the six presentation-gate tests (re-point paths).
   - **COPY:** the summariser + fixtures and the walkthrough README / loop / template (only names change).
   - **ADAPT:** the QA seed. lsse's seed JSON was deleted in `87a0b2e0`; it is recoverable with `git show b37e6715:apps/studio/seeds/qa-presentation.mutation.json`, but the audiofast block set differs, so it is re-authored. lsse's 458-line `apply-seed.ts` relies on a seed library audiofast lacks, so a small dedicated applier is written instead.
4. **Test runner.** Gates and studio tests move from `bun:test` to vitest. This needs (a) a vitest setup in `apps/studio` (new) and (b) a root-level vitest project for `scripts/presentation-gates`, or placing those gates under `apps/web`. The crawler itself stays a `bun run` script: it uses `HTMLRewriter`, `Bun.resolveSync`, `Bun.write` and `import.meta.main`. Its pure helpers move to a Bun-free module so vitest can import them (§6).
5. **One-time setup (§8):**
   - `sanity cors add … --credentials` × 2;
   - enable share access once in the UI;
   - a Viewer `browserToken`;
   - `SANITY_STUDIO_PRESENTATION_URL=https://audiofast.pl` set **before** `sanity deploy`;
   - optionally a `frame-ancestors` allowlist.

---

## 2. Studio porting map

Paths relative to `lsse:apps/studio/`; target `af:apps/studio/`.

| lsse file | Lines | Purpose | Verdict | Audiofast change |
| --- | --- | --- | --- | --- |
| `sanity.config.ts` (presentation block `:297-363`; actions `:465-497`; `studio.components.toolMenu` `:344`) | — | `PRESENTATION_ORIGINS`, lazy `getPresentationUrl()`, `presentationTool({title:'Podgląd', previewUrl:{initial, previewMode:{enable:'/api/draft-mode/enable', shareAccess:true}}, allowOrigins, resolve:{locations, mainDocuments}})`, `structureTool({title:'Treść'})`, `OpenInPresentationAction` appended last | **ADAPT** | `PRESENTATION_ORIGINS = ['http://localhost:3000','https://audiofast.pl']`. Keep the title „Podgląd”; `structureTool` title is currently unset, so set „Treść” if the tool menu is ported (the menu matches tool **names**, not titles). **Audiofast's `document.actions` returns early for singletons** (`af:sanity.config.ts:54-63`). Append `OpenInPresentationAction` in **both** branches: `homePage`, `products`, `brands`, `blog`, `cpoPage`, `privacyPolicy` and `termsAndConditions` are routed singletons. Keep "append, never prepend" (Publish stays primary). Wrap the `toolMenu` line only if §2 row `contextual-tool-menu.tsx` is taken. |
| `presentation/routes.ts` | 323 | `HREF_EXPRESSIONS` (GROQ per routed type, `null` without slug), `TITLE_EXPRESSIONS` (Polish labels), `PARENT_LOCATIONS` ("also listed on"), `isRoutedType`, `hrefQuery` | **ADAPT** | Drop `localizedExpression`/`hrefExpression`/`SLUG_CONFIGS` derivation (single locale, no slug-config registry). Hand-write `HREF_EXPRESSIONS`: `slug.current` for every type whose slug is the full path (`page`, `product`, `brand`, `blog-article`, `blog-category`, `cpoProduct`, singletons' fixed slugs). Exceptions: `productCategorySub` → `"/produkty" + slug.current`. `review` → `select(destinationType == "page" => slug.current)`, so `pdf`/`external` reviews have no own page and fall to referrers. `cpoProduct` → `select(productType == "internal" && isArchived != true => slug.current)`. **Mirror the web eligibility rules** or the action opens a 404. `notFound` and `comparatorConfig` are not slug-routed: `comparatorConfig` gets the literal `"/porownaj/"`, and `notFound` goes to `STATIC_LOCATIONS`. `PARENT_LOCATIONS`: `product` → `/produkty/` and `/produkty/kategoria/<cat>/` (via `denormCategorySlugs` or the category ref), `/marki/<brand>/`; `blog-article` → `/blog/` and its category page; `brand` → `/marki/`; `cpoProduct` → `/certyfikowany-sprzet-uzywany/`; `review` (PDF, archived) → `/recenzje/archiwalne/` if the web lists it. **Every row must be true for every document of its type** (gotcha G-S3). Keep `pathParent` and `referencedParent`; drop `indexParent`'s `hrefVariants` (locale list). |
| `presentation/locations.ts` | 508 | `STATIC_LOCATIONS` (message-only types), `REFERENCED_ONLY_TYPES`, `REFERRER_HREF/TITLE` `select()`s, `routedLocationsQuery`, `referencedLocationsQuery`, the function-form `locations` resolver (`documentStore.listenQuery({fetch, listen})`, perspective = `params.perspectiveStack \|\| 'drafts'`), `PAGINATED_TYPES`, `buildMainDocuments()` (generated, sorted deepest-first), `mainDocuments` | **ADAPT** | **STATIC:** `settings`, `navbar`, `footer`, `notFound` („otwórz dowolny nieistniejący adres”), `redirects` („działają przed stroną — brak podglądu”), `comparatorConfig` if not routed, `productCategoryParent` (grouping only, no references from pages? verify), `customFilterDefinition`-type config docs, and any `sanity.*`/plugin types the registry exposes. **REFERENCED_ONLY:** `socialMedia`, `store`, `award`, `teamMember`, `faq`, `reviewAuthor`, `youtubeVideo`, `productCategoryParent` (if pages reference it via `brandsByCategoriesSection`). **SITE_WIDE_TYPES** = `['navbar','footer','settings']`. **mainDocuments:** a hand-written `defineDocuments([...])` list rather than a generated one, because there is no slug registry. Keep the **sort-by-depth/literal-prefix function** and run the list through it, so ordering stays a rule. Patterns: `/` → `homePage`; `/produkty` → `products`; `/produkty/kategoria/:slug` → `productCategorySub` with `slug.current == "/kategoria/" + $slug + "/"`; `/produkty/archiwalne`?; `/produkty/:slug` → `product` with `slug.current == "/produkty/" + $slug + "/"`; `/marki`, `/marki/:slug`; `/blog`, `/blog/kategoria/:slug`, `/blog/:slug`; `/recenzje/:slug`; `/certyfikowany-sprzet-uzywany`, `/certyfikowany-sprzet-uzywany/:slug`; `/polityka-prywatnosci`, `/regulamin`, `/porownaj`; `/:slug` → `page` (catch-all last). Patterns are path-only, so `?page=N` matches automatically (no twins). Drop `isTranslated`, the `language ==` predicates and `collisionGroup` (no two types share `/:slug` in audiofast; verify `page` vs legal singletons, which are fixed routes and so sort first anyway). B2C routes (`/koszyk`, `/konto-klienta`, `/podziekowania-za-zakup/:n`) get **no** pattern; they are not CMS documents. |
| `presentation/news-pagination.ts` | 41 | Adds „Strona N” rows to the news **index**'s locations by counting eligible posts | **ADAPT** | → `blog-pagination.ts`. The `blog` singleton lists `/blog/?page=2..N`, with N = `ceil(count(eligible blog-article)/12)`. The filter must mirror the web listing exactly (`defined(slug.current) && !hideFromList` per `query.ts:1531`, plus any date/publish predicate). Listen on `_type == "blog-article"`. The same applies to `products` (eligible products / 12) and `cpoPage` (CPO / 12) if the web paginates them identically. |
| `presentation/parent-pagination.ts` | 71 | For a listed item, rewrites its parent row to the page it actually sits on (`index / pageSize + 1`) | **ADAPT** | `blog-article` → `/blog/?page=N` in date order (mirror the web `order()`); `product` → `/produkty/?page=N` in `orderRank` order (the default sort; other sorts and filters are not representable, and that is fine because the row names the default view). Hrefs carry `?page=N`, not a `SEGMENTS[locale].pagination` segment. Page 1 stays the bare URL. Drop the `language` field and the EN titles. lsse H3 FAILed exactly here, so this row is what H3 tests. |
| `presentation/preview-target.ts` | 176 | The one resolver "which page shows doc X": own page → parent listing (referenced-only types) → first routed referrer (`order(href asc)`) → home. `resolveOwnHref` = step 1 only (for the action) | **ADAPT** | Drop `HOME_HREF` locale `select` (home is `"/"`), `narrowLocale`, the language clause in `FIRST_REFERRER_HREF`. Keep: one query, `perspective: 'drafts'`, `useCdn: false`, published id, the exported query strings (evaluated with groq-js in tests). |
| `plugins/presentation-url.ts` | 196 | „Otwórz w podglądzie”: resolves own href on every `_rev`, re-resolves at click, `navigateIntent('edit', {id, type, mode:'presentation', preview})`, toasts „Brak adresu strony” / „Nie udało się odczytać adresu strony”, returns `null` for non-routed types | **COPY** | `API_VERSION` → audiofast's web API version. Nothing else is locale-bound. Replaces the dead pre-`a73f098` template action (`05` §6). |
| `plugins/contextual-tool-menu.tsx` | 453 | `studio.components.toolMenu` wrapper (`@beta @hidden`): a plain left click on „Treść”/„Podgląd” with a doc open becomes an `edit` intent carrying that doc (capture-phase `preventDefault`) | **ADAPT** (decision point) | The problem is Sanity's (`ToolLink` clears tool state), so it applies to audiofast. Drop the `language` param on the Presentation→Treść intent and `SUPPORTED_LANGUAGES`. `openDocumentFromStructurePanes` must be re-verified against audiofast's structure (singletons opened via `S.document()` with fixed ids; product/brand panes nested under custom lists). Carries an upgrade duty: re-check both tabs (topbar, sidebar, overflow at narrow width) after every `sanity` bump. Record it in CLAUDE.md. Rollback = delete one config line. |
| `components/slug-preview-navigation.tsx` | 122 | Mounted inside the slug field: when a slug rename is **saved** in the perspective the iframe shows, `usePresentationNavigate(newPath + search + hash)` keeps the preview on the renamed page (polls up to 20×500 ms) | **ADAPT** | Mount in `af:components/slug-field-component.tsx` (`PathnameFieldComponent`, 508 lines). `pathname` is the stored `slug.current` directly. For `productCategorySub` it is `"/produkty" + slug`, so reuse the routes.ts expression in the saved-route check, as lsse does. lsse E9 FAILed before this existed. |
| `presentation/locations.test.ts` | 261 | Completeness (every registered doc type ∈ routed ∪ static ∪ referenced, exactly one), no stale names, mainDocuments order (root catch-all last, prefixed before root), PAGINATED_TYPES ↔ `next.config` redirects | **ADAPT** | Keep completeness + order. **Drop** the `PAGINATED_TYPES ↔ next.config.ts page-1 redirects` lockstep (no path pagination, no page-1 redirects) and the locale-free `bipEntry` describe. Replace with: every `PARENT_LOCATIONS`/pagination filter string equals the web listing's source expression (the lsse source-parity idea). Registry import: `af:schemaTypes/index.ts` (`schemaTypes` filtered to `type === 'document'`). |
| `presentation/presentation-url.test.ts` | 88 | Stale-revision / re-resolve-at-click / missing-href toast contract | **COPY** | `bun:test` → vitest (§6). |
| `presentation/preview-target.test.ts` | 230 | Evaluates `PREVIEW_TARGET_QUERY` with **groq-js** over a fixture dataset | **ADAPT** | Remove locale cases; add `productCategorySub` prefix, PDF review → referrer, CPO external → referrer. Needs `groq-js` devDep in studio (lsse pins `2.0.0`). |
| `presentation/slug-preview-navigation.test.ts` | 75 | `renamedPreviewUrl`, `isSavedPreviewRoute` | **ADAPT** | Drop the "locale paths" case. |
| `presentation/contextual-tool-menu.test.ts` | 202 | Pane → document extraction, click filtering, `toolForHref` | **ADAPT** | Rewrite the pane fixtures to audiofast's structure ids. Drop the translated-collection case. Lives under `presentation/` because lsse's test path did not include `plugins/`. Keep the location if the studio vitest include is `presentation/**`. |
| `presentation/news-pagination.test.ts`, `parent-pagination.test.ts` | 123, 143 | Page math, listen filters, source parity with web listing filters | **ADAPT** | Follow the two ADAPT rows above (`?page=` hrefs, single locale). |
| `structure.ts` `canHandleIntent` language-pane checker (workshop fixes Phase 4) | — | Lands `edit` intents inside the lsse language branch (`…;polski;<id>`) | **SKIP** | There are no language panes. Audiofast's default `edit` intent resolution is enough, provided singletons' structure item ids equal their `_id`. Verify once in the walkthrough (the Presentation → Treść row). |
| `plugins/accent-color-guard.ts`, `duplicate-action.ts`, `generate-alt-action.tsx` | — | Not Presentation | out of scope | — |

---

## 3. Web porting map

Paths relative to `lsse:apps/web/src/`; target `af:apps/web/src/`. The fetch-layer shape (`defineLive`, three-layer dispatcher, `sanityFetchPublished`, block-union composition, uncapped client) is ported by the fetch track (`02`, `04`). Only the Presentation-bearing parts are listed here.

| lsse file | Lines | Purpose | Verdict | Audiofast change |
| --- | --- | --- | --- | --- |
| `app/api/draft-mode/enable/route.ts` | 19 | `export const { GET } = defineEnableDraftMode({ client: sanityClient })` | **COPY** | Client import path. With `trailingSlash: true` the URL Presentation calls is `/api/draft-mode/enable/`. The slashless form costs a 308 (O-class). |
| `app/actions/draft-mode.ts` | 18 | `'use server'` `disableDraftMode()` → `(await draftMode()).disable()` | **COPY** | Audiofast already has `app/actions/`. |
| `global/components/layout/PreviewBar/index.tsx` | 31 | `dynamic(() => import('./PreviewBarImpl'), { ssr: false })` split shim | **COPY** | → `af:components/ui/PreviewBar/` or `components/shared/`. |
| `…/PreviewBar/PreviewBarImpl.tsx` | 50 | Renders only when `useIsPresentationTool() === false`; exit → `disableDraftMode()` → `router.refresh()` in a transition | **ADAPT** | Drop `useLocale`/`COPY[locale]`. Inline the Polish strings: „Podgląd wersji roboczej”, „Wychodzę…”, „Wyjdź z podglądu”. Remove the `glass-edge` class. |
| `…/PreviewBar/copy.ts`, `styles.module.scss` | 17, 37 | pl/en strings; bar styles | **ADAPT** | Drop `copy.ts` (one locale). Restyle the SCSS per `af:.cursorrules` (rem, explicit transitions, nested MQ). |
| `global/components/layout/LiveVisualEditing/index.tsx` | 88 | `'use client'` `<VisualEditing basePath="" trailingSlash onSuspiciousStega={dev ? report : undefined}/>`; dev reports → `window.__stegaReports` + one `console.warn` | **COPY** | Needed for I3. |
| `global/components/layout/DraftMediaProvider/index.tsx` | 26 | Context telling media islands they are in draft (consent suppressed), so YouTube offers a local opt-in | **SKIP** | Audiofast's `YoutubeBlock`/`VimeoBlock`/`YouTubeModal`/`VideoModal` never consult the consent store. Nothing waits on a consent init that draft suppresses, so lsse D5's failure ("draft video waited forever for consent init") cannot occur. **Keep a D-row:** in draft, every video block plays. Reopen if a media component starts reading consent. |
| `app/[locale]/layout.tsx` `:82-147` (draft branch) | — | `isDraft` from `draftMode()` in an uncached shell; `{!isDraft && <AnalyticsRoot/>}`; `{isDraft && <><PreviewBar/><LiveVisualEditing/><SanityLive includeDrafts/></>}` | **ADAPT** | `af:app/layout.tsx:76-77` mounts `<CookieConsent/>` + `<Analytics/>` unconditionally. Gate both on `!isDraft` (I1). The footer `CookieButton` (`components/ui/Footer/CookieButton.tsx`) then resets a consent cookie with no modal to reopen. Hide it in draft, or accept it and list it in "expected behaviours". Drop the `AccentPalette` and locale handling. |
| `global/sanity/live.ts` (`:54-75`, `:126-135`) | 358 | `defineLive({client, serverToken, browserToken, strict:true})`; `getDynamicFetchOptions()` reads `draftMode()` + `resolvePerspectiveFromCookies` → `{perspective ?? 'drafts', stega:true}` | **ADAPT** (fetch track owns it) | Presentation needs only: `strict: true`, the Viewer `browserToken`, `getDynamicFetchOptions` honouring the perspective cookie (A3 switch), and `SanityLive` exported. Skip `pickFetch`/the uncapped instance unless audiofast's draft query exceeds the 300 KB CDN body cap (measure; lsse's draft union is ~444 kB). |
| `global/sanity/client.ts` stega part (`:15-35`, `:509-547`) | 575 | `STEGA_LOGIC_ONLY_FIELDS` + `stega: { studioUrl, enabled: false, filter }`; filter checks `sourcePath.at(-1)`, and for primitive array members `sourcePath.at(-2)`, then falls back to `props.filterDefault(props)` | **ADAPT** | Copy the filter function and the documented rule verbatim. **Re-derive the set** from audiofast's schema: the 11 `list:` enums (`brands-list`, `featured-publications`, `latest-publication`, `featured-products`, `faq-section`, `inline-image`, `settings:531`, `cpo-product` ×2, `blog-article:136`, `custom-filter-definition`). Also add every `denorm*` leaf name that reaches a web draft fetch (`denormBrandSlug`, `denormCategorySlugs`, `denormFilterKeys`, …), every alt/`coalesce` branch, anchor/`#id` fields, and phone/email/tel values. `studioUrl` = `https://audiofast.sanity.studio`. Drop lsse's `SVG_MARKUP_FIELDS` unless audiofast inlines CMS SVG. |
| `global/sanity/data-attribute.ts` | 48 | `getDataAttribute({id,type,isDraft})` → `createDataAttribute({baseUrl: STUDIO_URL, projectId, dataset, id, type})` or `null`; `ScopedDataAttribute` | **COPY** | Constants import path. |
| `global/sanity/metadata.ts` `notFoundUnlessDraft` (`:113-128`) | 4 (+doc) | In `generateMetadata`, `notFound()` only outside draft, because metadata is published-only and would 404 a valid never-published draft | **COPY** | Put it in audiofast's metadata helper. Every `generateMetadata` that calls `notFound()` on a missing doc switches to it (lsse: 19 routes). |
| `app/[locale]/(site)/[slug]/page.tsx` draft branch (`:122-149`) | — | Dispatcher: `if (isDraft) return <DynamicCatchAll/>` **without** `<Suspense>`, so a draft-mode `notFound()` keeps a real 404 status | **ADAPT** (fetch track) | Apply to `af:app/[slug]/page.tsx` and every slug route whose leaf can `notFound()`. Pinned by gate `draft-not-found-status.test.ts`. |
| `global/components/shared/PageBuilder/index.tsx` (`:1172-1271`) | 1,271 | Builds `dataAttribute` once; per block `dataAttribute?.scope([fieldName,{_key}])`; draft → `<div key={_key} data-sanity={dataAttribute(\`${fieldName}[_key=="…"]\`)}>`, published → keyed `Fragment`; bare `_key` React keys; `<OptimisticBlocks>` only in draft, **inside** any provider's children | **ADAPT** | Into `af:components/shared/PageBuilder.tsx`. `fieldName`: `pageBuilder`, plus `cpoPageBuilder`'s field name if it differs (`AuthoredBlockField` union). Run a duplicate-`_key` audit before switching React keys to bare `_key`. Thread the scoped attribute to every block that owns an authored array (§4). |
| `…/PageBuilder/OptimisticBlocks.tsx` | 84 | `dynamic(() => import('./OptimisticReorder'))` **without** `ssr:false`, inside an error boundary and a `Suspense` whose fallback is `children` | **COPY** | — |
| `…/PageBuilder/OptimisticReorder.tsx` | 56 | `useOptimistic` from **`next-sanity/hooks`**; reducer keeps the `_key[]` order only | **COPY** | — |
| `…/PageBuilder/optimistic-order.ts` | 42 | `getOptimisticBlockOrder` (filters `action.id === documentId`), `reorderBlockChildren` (`Children.forEach` on raw `child.key`; bail if fewer matched than rendered) | **ADAPT** | `AuthoredBlockField = 'pageBuilder' \| <cpo field>`. Drop `cardSections`. |
| `…/PageBuilder/optimistic-order.test.ts` | 88 | Reducer + reorder contract | **COPY** | `bun:test` → vitest. |
| `global/utils/stega-text.ts` | 87 | `STEGA_CHARS` (vendor alphabet built from code points), `stripStega`, `hasText`, `hasPortableTextCopy` | **COPY** | → `af:global/utils/stega-text.ts`. Then route audiofast's 41 component `.trim()`s through it (gate below). |
| `global/utils/stega-text.test.ts` | 86 | Cross-checks the class against `next-sanity`'s `stegaClean` on encoded samples | **COPY** | vitest. |
| Referenced-doc / chrome / island annotation sites: `pageBuilder/FaqBlock`, `PortableText/Faq`, `shared/Form/island.tsx` (`toIslandForm`), `layout/Header`, `layout/Footer`, `downloads/FileList/FileRow.tsx`, `ContactCardsBlock`, `DocumentsBlock`, `(lp)/landing/[slug]/layout.tsx` | — | `getDataAttribute` scoped to **another** document (referenced `faq`/`form`/`person`, the `navigation`/`footer` singletons), with factories turned into **strings before crossing into a client island** | **ADAPT** (pattern) | Audiofast targets: `FaqSection` (`faqList[]->` → `faq` doc for the inner text, page `faqList[_key]` for the item), `TeamSection` (`teamMember`), `ContactForm`, brand page `stores[]`, Header (`navbar`), Footer (`footer`). Chrome gets `isDraft` threaded through its own `'use cache'` component as lsse does (`(site)/layout.tsx:48-50`); the 404 renders chrome with `perspective="published"`. |
| `global/components/shared/RollingNumber/index.tsx` | 102 | Animates digits; callers must `stegaClean` the value first | **ADAPT** (rule) | Any audiofast counter or number animation: `stegaClean` before splitting digits. |
| `OrganizationSchema.tsx` / `JsonLdScript.tsx` / `sitemap.ts` | — | Published-pinned, single escaped emitter | fetch track | Proven by I2 + the crawler. |

---

## 4. Drag-surface helpers (nested-array drag, lsse level)

**Count.** `03` says "22 drag-surface helper files". That number is `grep -l "drag-surface|dragSurface"` over `apps/web/src`, which matches 22 files: the 10 helper modules, their 7 tests and 5 consumers (`Header/index.tsx`, `MobileMenu.tsx`, `DisclosureNav/index.tsx`, `RollingNumber`, plus block `index.tsx` files). The helper files themselves:

| # | lsse helper (`global/components/…`) | Lines | Test (lines) | What it encodes |
| --- | --- | --- | --- | --- |
| 1 | `pageBuilder/CarouselStatsBlock/drag-surface.ts` | 17 | `drag-surface.test.ts` (46) | `hasText` on values; `stegaClean(row)` so nested text overlays don't sit above the sortable `rows[]` item |
| 2 | `pageBuilder/ContactFormBlock/drag-surface.ts` | 18 | test (35) | Path `['people','list',{_key}]` = the **reference item**, not the deref'd person; `stegaClean(person)` |
| 3 | `pageBuilder/ContactTabsBlock/drag-surface.ts` | 19 | test (36) | Two-level path `['areas',{_key},'people',{_key}]`; clean person |
| 4 | `pageBuilder/FeedBlock/drag-surface.ts` | 11 | test (16) | Only the authored rail shell `['rails',{_key}]` is sortable; resolved cards are not |
| 5 | `pageBuilder/HeroSliderBlock/drag-surface.ts` | 37 | (in `index.test.ts`, 92) | `data-sanity-drag-group` per slide rail and per slide's CTA row (isolates overlapping slides); clean button label; **no fixed axis** (CTA row changes direction on mobile) |
| 6 | `pageBuilder/LogoWallBlock/drag-surface.ts` | 14 | (in `index.test.ts`, 19) | `data-sanity-drag-flow="vertical"` on outer groups despite nested grids |
| 7 | `pageBuilder/ServiceRouterBlock/drag-surface.ts` | 15 | test (27) | Annotate **only when the order is authored** (`stegaClean(mode) === 'manual'`); query-ordered lists get no handle |
| 8 | `pageBuilder/TeamDirectoryBlock/drag-surface.ts` | 47 | test (59) | Group path + person path into one of two reference arrays; no axis pin (grid collapses); clean projected copy without mutating source |
| 9 | `layout/Header/drag-surface.ts` | 35 | `drag-surface.test.tsx` (127, renders DisclosureNav + MobileMenu) | Desktop `horizontal` / drawer `vertical` drag-flow; **no explicit group** (an explicit group keeps singleton items out of the drag session); `stegaClean` an accent used as a selector |
| 10 | `layout/Header/use-drag-surface.ts` | 29 | (covered by 9) | `matchMedia(DRAWER_MEDIA_QUERY)`: only the visible responsive copy claims the path (both copies stay mounted) |

(`shared/Lightbox/drag.ts` + test is touch-swipe for the lightbox, unrelated.)

**The pattern** that ports, as opposed to the files:
1. A per-block `drag-surface.ts` that holds **only** pure functions: a typed path builder taking `resolve?: ScopedDataAttribute`, `stegaClean` wrappers for strings that fill the item, and attribute objects (`data-sanity`, optional `data-sanity-drag-flow` / `data-sanity-drag-group`, always `undefined` when not in draft).
2. Each helper has a unit test asserting the exact path array and that cleaning does not mutate the source.
3. Paths address the **authored** array item (the reference item's `_key`), never the dereferenced document. That requires `refs[]{ _key, ...@->{…} }` in GROQ, never bare `refs[]->` (gate 0.5).
4. Items are annotated only where the order is authored. Listings, query-ordered and derived arrays stay unannotated and are listed with a reason (gate 0.6, `NO_ITEM_OVERLAY`).
5. Responsive duplicates: only the visible copy gets `data-sanity`. Pin `drag-flow` only when the axis never changes.
6. Animated/duplicated DOM (marquee, embla loop) gets no item annotation, because drop targets resolve by rect equality polled at 150 ms (Najbar DND).

**Verdict: ADAPT as pattern; the 10 files themselves SKIP.** They are keyed to lsse blocks (`ContactTabs`, `TeamDirectory`, `Feed`, `ServiceRouter`, …) that audiofast does not have. The plan decides per audiofast array. Candidates from the 22 blocks:

| Audiofast block / surface | Authored array(s) | Likely verdict |
| --- | --- | --- |
| `HeroCarousel` | slides + buttons | draggable; drag-group per slide (helper 5 shape); check embla loop duplication first |
| `StepList`, `ImageWithTextBoxes`, `ImageTextColumns`, `GallerySection`, `PhoneImageCta` | items/images | draggable (flat) |
| `FaqSection` | `faqList[]` (refs) | draggable via ref `_key`; inner text opens `faq` doc |
| `TeamSection` | team member refs | draggable via ref `_key` |
| `FeaturedProducts`, `ProductsCarousel`, `FeaturedPublications`, `BrandsList` | hand-picked refs **when the mode is manual**, query otherwise | conditional annotation (helper 7 shape) |
| `BrandsMarquee` | brands | **no** item annotation (duplicated animated DOM) |
| `ProductsListing`, `LatestPublication`, `CpoProductsListing`, `BrandsByCategoriesSection`, `ContactMap`, `ContactForm`, `BlurLinesTextImage`, `ImageWithVideo` | query/derived or fixed shape | `NO_ITEM_OVERLAY` with reason |
| Header (`navbar`), Footer (`footer`) | nav items, columns, socials | draggable if responsive duplication is handled (helpers 9–10 shape) |
| Product page fixed sections (tech data table, `featuredReviews`, brand `stores[]`) | per array | decide in plan |

---

## 5. Gates and tooling map

| lsse file | Lines | Purpose | Verdict | Audiofast change |
| --- | --- | --- | --- | --- |
| `apps/web/scripts/check-stega-leaks.ts` | 1,232 | Sitemap + probe crawler, published and draft modes; finding classes per §3.2 of `03`; cross-mode bag-of-words divergence; `ssr-error`; markdown report | **ADAPT** | (1) Remove locales: `--locale`, `localeOf`, `localePrefix`, `templateKey`'s locale and `SEGMENTS[locale].pagination` (template key = path with the last segment → `<slug>`; `?page=` is not in the sitemap). (2) Fixed probes: `/this-page-does-not-exist/`, `/blog/?page=2`, `/produkty/?page=2`, `/produkty/?sortBy=…`, `/porownaj/`, `/koszyk/`, `/koszyk/twoje-dane/`, `/konto-klienta/` (the B2C isolation suite's markup), and **`/qa-presentation/`** (the QA page is `doNotIndex`, so it may be out of the sitemap; verify). (3) `readAuthToken` → read `SANITY_AUTH_TOKEN` (or the write token audiofast names) from `apps/web/.env.local` → studio env, mirroring `lib/lake-cli.ts:42-91`. (4) Keep `@sanity/preview-url-secret` resolution through `next-sanity`'s tree (`Bun.resolveSync`); it is hoisted in audiofast, but keep the indirection for version lockstep. (5) Keep Bun-only APIs (`HTMLRewriter`, `Bun.write`, `import.meta.main`): it runs with `bun run`. Move `devStaticPathWarmupPaths`, `warmDevStaticPathsSerially`, `analyse`, `bagDifference` into a Bun-free `scripts/lib/stega-crawl.ts` so vitest can import them (§6). |
| `apps/web/scripts/lib/lake-cli.ts` (`envLookup`, `readAuthToken`) | 173 | Env reader independent of the web env validator | **ADAPT** (only the ~50 lines the crawler uses) | Drop `LakeConfig`/GIS imports. |
| `scripts/presentation-gates/source.ts` | 77 | `ROOT`, `walk`, `isTypeScript`, `read`, `relative`, `stripComments` | **COPY** | `ROOT` relative depth unchanged if kept at `scripts/presentation-gates/`. |
| `scripts/presentation-gates/enum-stega-coverage.test.ts` | 181 | Every string `options.list` field under `apps/studio/schemaTypes/**` ∈ `STEGA_LOGIC_ONLY_FIELDS` (read from `client.ts` source) ∪ `VENDOR_DENYLIST`; a second test checks the denylist mirror against the **installed `@sanity/client`** dist | **ADAPT** | Paths unchanged. `Bun.resolveSync('@sanity/client/…')` → `createRequire(import.meta.url).resolve`. Re-read the vendor list from audiofast's installed `@sanity/client` (7.26.x today, 8.x after D2): the dist filename `stegaEncodeSourceMap-*.js` differs between majors. Audiofast's `.tsx` schema files (`cpo-product.tsx`) must be walked too (`isTypeScript` already covers `.tsx`). |
| `scripts/presentation-gates/emptiness-predicates.test.ts` | 271 | (a) no TAG-block literal `\u{E0000}-\u{E007F}` in `apps/web/src`; (b) every `.trim()` under components is within 2 lines of `stripStega(`/`hasText(`/`stegaClean(` or is in `ALLOW` with a reason; stale ALLOW entries fail | **ADAPT** | `COMPONENTS` → `apps/web/src/components/` (audiofast keeps components outside `global/`). Rebuild `ALLOW` from scratch over the 41 current sites. Most are form/search inputs (user input, not CMS) and belong in ALLOW. |
| `scripts/presentation-gates/deref-key-lint.test.ts` | 37 | No bare `[]->` in `fragments.ts`/`queries.ts` outside comments | **ADAPT** | `FILES = ['apps/web/src/global/sanity/query.ts']` (+ any new fragment file). **29 hits today.** Fix them as part of the drag work, or add a temporary per-line allowlist that shrinks to zero. |
| `scripts/presentation-gates/data-attribute-coverage.test.ts` | 138 | Every block in the registry either has a `.tsx` mentioning `dataAttribute` in its component folder, or sits in `NO_ITEM_OVERLAY` with a reason (and then must **not** mention it) | **ADAPT** | `SCHEMA_INDEX` → `apps/studio/schemaTypes/blocks/index.ts`; parse `pageBuilderBlocks` (check how it lists blocks: imported schema objects vs names, and adapt `readRegistry`). `COMPONENT_DIR` → `apps/web/src/components/pageBuilder/`. Fill `FOLDER_OVERRIDES` (e.g. `heroCarousel` → `HeroCarousel`, kebab-case files vs `_type` names). `NO_ITEM_OVERLAY` from the §4 table. |
| `scripts/presentation-gates/draft-not-found-status.test.ts` | 33 | Source assertion: the catch-all's draft branch returns `<DynamicCatchAll/>` with no `<Suspense>` | **ADAPT** | `ROUTE` → `apps/web/src/app/[slug]/page.tsx`. Duplicate for every slug route that can `notFound()` in draft (`produkty/[slug]`, `marki/[slug]`, `blog/[slug]`, `recenzje/[slug]`, `certyfikowany-sprzet-uzywany/[slug]`, category routes), or generalise to a glob. |
| `scripts/presentation-gates/dev-static-path-warmup.test.ts` | 49 | Warm-up picks one path per route template and runs them serially (a Next 16 dev prerender-manifest race) | **ADAPT** | Import from the new Bun-free `stega-crawl.ts`. Drop the locale fixtures. |
| `scripts/walkthrough/summarize-results.ts` | 120 | Parses the single `\| ID \| Result \| Evidence \| Notes \|` table; PASS/FAIL/BLOCKED only; FAIL needs `Cause:`; unique ids; exit 0 iff no FAIL, exit 1 on FAIL or malformed | **COPY** | Fix the header comment ("M26" → this change). Node-only APIs, so it runs under `bun` or `node`. |
| `scripts/walkthrough/fixtures/results.{clean,sample,malformed}.md` | 8, 9, 7 | Expected exit 0 / 1 / 1 | **COPY** | Add a tiny vitest test running the summariser's `parseResults` on the three fixtures (lsse has none; it checked by hand). Export `parseResults` and guard `main()`. |
| `context/archive/2026-09-04-presentation-walkthrough/walkthrough/README.md` | 58 | Run contract: one browser owner, immutable `run-<n>/`, `results.md` grammar, `fixes.md`/`needs-human.md`/`done.md`, evidence rules, three anti-false-success rules | **ADAPT** | "Codex desktop task / Brave / Computer Use" → "Claude in Chrome (main session)". Drop [S] lane and Safari rows (D8: deferred, recorded). Deployed Studio app id `dlwt2zhgkk7rjx6dj8rdyjfz`. Evidence substitutions: drop `[data-accent=""]`. |
| `…/walkthrough/loop.md` | 32 | 9-step fix-and-retest loop, gate list, lane-split step 7, content-safety rules, cap 5 | **ADAPT** | Gates: `bun run lint && bun run check-types && bun run test:gates && (cd apps/web && bun run test:run) && bun run check:stega-leaks --base http://localhost:3000`. [D] step: push → Vercel READY → `vercel inspect https://audiofast.pl` SHA check → `cd apps/studio && bunx sanity deploy`. Commit prefix `fix(sanity-modernization): <cause> (run n)`. **Add to content safety:** no denormalization batch (`migrate:denormalize`), CPO Excel sync or newsletter send during a run (they write the Lake). Orderable-list drags write **published** `orderRank` (lsse J1 evidence), so they are forbidden in a draft-only run. |
| `…/walkthrough/results.template.md` | 7 | Environment paragraph fields + table header | **ADAPT** | Studio origins `http://localhost:3333` / `https://audiofast.sanity.studio`; previewed origins `http://localhost:3000` / `https://audiofast.pl`; browser = Chrome version + "Claude in Chrome"; lanes `L\|D`. |
| `walkthrough-brief.md`, `test-plan.md` (330, 237) | — | Brief → executor-authored test plan | **ADAPT** (re-author) | Same section skeleton (`03` §3.1). Catalogue trimmed per D4: all suites except E2/E5 (locale/deleted singleton), B5 (inherited sections), D1–D4 (accent), A7 (Safari); plus the B2C isolation suite. |
| `apps/studio/scripts/seed/apply-seed.ts` | 458 | Generic seed applier: per-document field diff dry run, Lake validation dry run, `--execute`, `@asset/` placeholders via manifest, `createOrReplace`/`delete`/`patch`/`draftInsert` | **ADAPT** (rewrite small) | Audiofast has no `seeds/` system and no `lib/{args,manifest,sanity}.ts`. Write `apps/studio/scripts/seed/apply-qa-presentation.ts` (~120 lines). Keep: dry run by default printing per-document field diffs, `transaction.commit({ dryRun: true })` for Lake-side validation, `--execute`, idempotency proof ("0 new, 0 changed" on rerun). Drop `@asset/` manifest (the seed lands in the **production** dataset, so reference existing asset ids directly), `draftInsert`, `patch`/`unset`. |
| `apps/studio/seeds/qa-presentation.mutation.json` (deleted; `git show b37e6715:…`, 3,482 lines) | — | `page.qa-presentation` (+ `.en`) with one block per nesting archetype, `_key`s `qa-<block>-<n>`, `doNotIndex` | **ADAPT** (re-author) | One `page` doc `_id: "page.qa-presentation"`, `slug.current: "/qa-presentation/"`, `seo.doNotIndex: true`, `seo.hideFromList: true`, **published**. One block per audiofast archetype from §4 (≈12–15 of the 21), **≥2 items in every array and every optional field filled** (lsse: 7 of 9 BLOCKED rows were missing fixtures). Reference existing `faq`/`teamMember`/products/brands by id. Run the unique-`_key` check from lsse plan 3.2. Production-dataset consequences: exclude it from the sitemap/llms/listings (`doNotIndex`/`hideFromList` honoured by `sitemap.ts`? verify), and delete it after the audit or keep it as a standing fixture (decide in plan). |
| Root `package.json` scripts | — | `check:stega-leaks`; `test` (bun test over gate + studio dirs) | **ADAPT** | Add `"check:stega-leaks": "bun run apps/web/scripts/check-stega-leaks.ts"`, `"test:gates": "vitest run --root scripts/presentation-gates"` (or a root `vitest.workspace`), `"test:studio": "cd apps/studio && bunx vitest run"`, `"walkthrough:summary": "bun scripts/walkthrough/summarize-results.ts"`. Add `apps/studio` `test` script for turbo. |
| `context/foundation/lessons.md` "Presentation needs authored paths and real keyed children" | — | Rule | **COPY** into audiofast's lessons (via `/10x-lesson`) once the audit reproduces it. | — |
| `docs/frontend-authoring.md` §6 Stega (`:320-366`) | 47 | The stega authoring rule set | **ADAPT** | Condense into audiofast `CLAUDE.md` "Conventions" (or a doc next to `CODEBASE_OVERVIEW.md`). The "new field joins the set in the same commit" rule and the drag-hover rule are the load-bearing lines. |
| `apps/web/next.config.ts` `FRAME_ANCESTORS` + CSP header (`:19-31`, `:167-221`) | — | `frame-ancestors 'self' <STUDIO_URL> https://sanity.io https://*.sanity.io [+ http://localhost:3333 unless VERCEL_ENV=production]` instead of `X-Frame-Options` | **ADAPT** (optional hardening) | Audiofast sends no framing header today, so Presentation works without it. If added: `https://audiofast.sanity.studio` named exactly (never `*.sanity.studio`), both `sanity.io` forms, and `localhost:3333` outside production builds. **Never** add `X-Frame-Options`. I4 then tests fail-closed for an unlisted origin. |

---

## 6. bun:test → vitest

lsse runs everything through the root `bun test <dirs…>`. Audiofast runs vitest per app (`apps/web` jsdom; `apps/b2c-admin`); `apps/studio` has none.

| bun API used in lsse | Where | vitest replacement |
| --- | --- | --- |
| `import { describe, expect, test } from 'bun:test'` | all 13 gate/studio tests + 9 web tests | `from 'vitest'` (or `globals: true`) |
| `mock(() => …)` | `presentation-url.test.ts`, drag-surface tests | `vi.fn(() => …)`; `toHaveBeenCalledWith` is identical |
| `mock.module(path, factory)` + top-level `await import()` | `Header/drag-surface.test.tsx` | `vi.mock(path, factory)` (hoisted; static imports work, no top-level await needed) |
| `expect(x, message)` custom failure message | gate tests | vitest supports `expect(x, message)` too |
| `Bun.resolveSync(spec, from)` | `enum-stega-coverage.test.ts`, crawler | `createRequire(import.meta.url).resolve(spec)` / `import.meta.resolve` |
| `Bun.write` | crawler | `node:fs/promises` `writeFile` (only if the crawler leaves Bun) |
| `HTMLRewriter`, `import.meta.main` | crawler | **keep under `bun run`**. Tests import only the Bun-free helper module. |
| Root-level test dirs | `scripts/presentation-gates`, `apps/studio/presentation` | `scripts/presentation-gates/vitest.config.ts` (environment `node`, `include: ['*.test.ts']`) and `apps/studio/vitest.config.ts` (environment `node` or `jsdom` for the tool-menu/action tests; `include: ['presentation/**/*.test.ts']`; add `vitest` + `groq-js` devDeps). |

Risks to check during the port:
- **`locations.test.ts` imports the whole schema registry.** Under Vite, `.tsx` schema components and `sanity`/`@sanity/ui` must transform (set `oxc.jsx.runtime: 'automatic'` as `apps/web` does). Any CSS import in a custom input needs `css: false` or a stub. lsse notes the registry "evaluates under bun in under a second"; vitest will be slower but should work.
- **`presentation-url.test.ts` imports `@sanity/ui/toast` and `sanity`.** Fine in jsdom, but consider splitting the pure `resolveAndOpenInPresentation` / `isOpenInPresentationDisabled` into their own module so the test stays node-only.
- **Web tests in `src/` need no config change**; they are already inside `include`.
- The `test` turbo task does not exist at the root of audiofast today. Add it, or keep explicit scripts.

---

## 7. Gotchas that must survive the port (as code comments)

Each item is a comment in lsse that names a real failure. Keep it next to the ported code.

**Studio**
- **G-S1 (`sanity.config.ts`).** Every `PRESENTATION_ORIGINS` entry needs a CORS entry **with credentials**. Unattended `cors add` defaults `allowCredentials: false`. Symptom: the iframe loads but every draft renders as published.
- **G-S2 (`getPresentationUrl`).** Resolve lazily, so a Studio built without `SANITY_STUDIO_PRESENTATION_URL` still boots and fails only when the tool opens. `SANITY_STUDIO_*` is inlined at **build** time, so the value is a decision made before `sanity deploy`.
- **G-S3 (`shareAccess: true`).** It is the only working "open draft preview in a tab" path. The plain „Otwórz podgląd” URL never runs `enable`, and the iframe's CHIPS-partitioned cookie is invisible to a new tab.
- **G-S4 (titles).** Tool titles are constants inside `sanity`, not i18n keys, so the pl-PL bundle cannot translate them. Name „Podgląd”/„Treść” yourself.
- **G-S5 (actions).** Append Open-in-Presentation **last**: the first action is the primary button, which stays Publish.
- **G-S6 (`routes.ts`).**
  - An href expression must evaluate to `null` without a slug. That `null` is a **contract**: `defined(href)` filters and the „Uzupełnij adres URL…” message key off it.
  - GROQ expression strings rather than TS builders, so references can be dereferenced in one round trip.
  - "Change a route in `apps/web`, change it here too."
- **G-S7 (`PARENT_LOCATIONS`).** Every row must be true for every document of its type. A row naming a page that does not show the doc is worse than a missing row. `references()` cannot see collection-query listings, which is why these rows are hand-kept.
- **G-S8 (`STATIC_LOCATIONS` / `REFERENCED_ONLY_TYPES`).** A type in no list makes the resolver return `null`, and the panel is **silently absent** (lsse `calculatorCopy`). The completeness test is the guard.
- **G-S9 (`locations` resolver).** Use the function form, not `defineLocations`, because record resolvers cannot run `references($id)`. The Listen API honours only the top-level filter, so listen broadly (`_id in [$id,$draftId] \|\| references($id)` + collection types for pagination) and refetch the projection. Perspective = `params.perspectiveStack` falling back to **`drafts`**, not published.
- **G-S10 (`mainDocuments`).** First match wins. Sort deeper patterns first, then more leading literal segments. The catch-all `/:slug` goes last.
- **G-S11 (`presentation-url.ts`).**
  - Resolve the href again at click time, not from the action menu's rendered snapshot (stale across an async slug save).
  - Re-resolve on every `_rev`.
  - Use `navigateIntent('edit', {id, type, mode:'presentation', preview})`, not `navigateUrl('/presentation?preview=…')`. The raw path drops the sticky `perspective` param and pushes about 3 history entries through Presentation's main-document push.
  - Always pass `mode`.
  - Never pass any param Presentation does not know: it becomes a URL search param.
  - A routed doc without href stays **clickable** (it shows a warning toast). A non-routed type returns `null` (no item).
- **G-S12 (`contextual-tool-menu.tsx`).** `useLink` checks `isDefaultPrevented()` **before** calling `onClick`. Only a capture-phase ancestor handler that calls `preventDefault` synchronously (before any `await`) can cancel the navigation. The API is `@beta @hidden`: re-check after every `sanity` bump.
- **G-S13 (`slug-preview-navigation.tsx`).** Navigate only once the slug is **saved** in the perspective the iframe displays. Keep `previousPath` across keystrokes. Editing a referenced document must not move its host page.

**Web**
- **G-W1 (enable route).** It is a route handler because the browser is navigated to it. Disabling is a server action because PreviewBar awaits it and then calls `router.refresh()`. The CHIPS note stays even though the Safari lane is deferred.
- **G-W2 (`live.ts`).** `strict: true` is mandatory under `cacheComponents`: non-strict silently renders published under draft. `browserToken` is Viewer-scoped and delivered only in draft sessions; without it `includeDrafts` silently degrades to `false` in production. `getDynamicFetchOptions` reads cookies, so it lives behind the dispatcher's `draftMode()` check, outside `'use cache'`.
- **G-W3 (`client.ts`).**
  - The filter matches the **source path leaf**, never the GROQ alias, so list **every `coalesce()` branch**.
  - A primitive array member reports its index, so check `sourcePath.at(-2)`.
  - A leaf name is project-wide (lsse accepted `caption` costing two visible fields their overlay). Never add `title`; `stegaClean` at the render site instead.
  - `enabled: false` on the base client keeps every direct-client consumer (revalidation, newsletter, B2C reads) stega-free.
- **G-W4 (layout).** Reading `draftMode()` in the uncached shell does not opt out of prerendering, because it resolves `false` at build. Analytics and consent mount on `!isDraft`. SanityLive mounts in exactly one place, draft-only.
- **G-W5 (`PreviewBar/index.tsx`).** `ssr: false` is correct **only** for a shim that renders nothing published. `next-sanity/hooks` statically pulls about 106 KB of overlay code into any chunk that reaches it, and a runtime gate removes zero bytes from the build graph.
- **G-W6 (`OptimisticBlocks.tsx`).**
  - **Never** `ssr: false`: a BailoutToCSR throw strips every block from the draft SSR.
  - Use a `Suspense` with `children` as the fallback, not `dynamic`'s `loading` (it cannot see `children`).
  - An error boundary with `children` as the fallback handles a failed chunk.
  - Forward `children` with no added element.
- **G-W7 (`OptimisticReorder.tsx`).**
  - `next-sanity/hooks` is the only legal import; a direct `@sanity/visual-editing` import duplicates the actor singletons and the overlay silently stops talking.
  - State is the bare `_key[]`, never ReactNodes (`toArray` re-prefixes keys on every re-reduce).
  - Match children with `Children.forEach` on raw `child.key`.
- **G-W8 (`PageBuilder`).**
  - Use the bare `_key` as React key (a suffix breaks optimistic matching).
  - Pass keyed blocks **directly** to `OptimisticBlocks`; providers go outside (lsse run-1 C1 regression).
  - Carry the **authored field name** into every annotation (lsse B5).
  - Published path = keyed `Fragment`, so the markup is byte-identical to the pre-visual-editing render.
- **G-W9 (`data-attribute.ts`).** It returns `null` outside draft, and callers gate on the result. `_id` must be projected on every routed page query.
- **G-W10 (islands, `Form/island.tsx`).** `createDataAttribute` factories are not serializable: pass **pre-built strings** across the RSC boundary. `stegaClean` every value that is **posted back** (lsse form option labels failed validation only in Presentation). For audiofast this includes the cart/checkout/inquiry server actions and product name/slug payloads (B2C isolation suite).
- **G-W11 (`stega-text.ts`).** The alphabet is U+200B/C/D, U+FEFF, U+2060–2063, U+1D173–1D17A, built from code points (an ESLint `no-misleading-character-class` workaround). The TAG block U+E0000–E007F must never come back (lsse stripped it for weeks and nothing worked). `stripStega` removes every marker, not just `{4,}` runs, because that is correct for emptiness. Detection regexes use `{4,}` to spare ZWJ emoji.
- **G-W12 (`notFoundUnlessDraft` + catch-all).** Metadata is published-only, so a bare `notFound()` in `generateMetadata` 404s a valid draft. In the dispatcher, a draft `notFound()` must not cross a `<Suspense>`: that commits a 200 and leaves a `NEXT_HTTP_ERROR_FALLBACK` template.
- **G-W13 (`LiveVisualEditing`).**
  - `'use client'` only because `onSuspiciousStega` is a function prop.
  - `next-sanity` already defers `VisualEditing`, so no shim is needed.
  - `basePath="" trailingSlash` keeps overlay hrefs aligned.
  - SanityLive, not VisualEditing, does the refresh (document-agnostic, so it covers chrome singletons).
- **G-W14 (drag).** Stega text that fills an annotated item registers its own overlay and steals the drag (only the top of the hover stack starts a drag). `stegaClean` it at the render site.

**Gates / ops**
- **G-T1 (crawler).**
  - Mint cookies per run: `__prerender_bypass` changes every `next build`.
  - Use `redirect: 'manual'` and keep **all** `Set-Cookie` headers.
  - The first request retries, because the dev server drops the socket while compiling the route.
  - The RSC flight payload (`self.__next_f.push(`) is exempt from the inline-script class.
  - `BAILOUT_TO_CLIENT_SIDE_RENDERING` templates are by design; any other `data-dgst` is an `ssr-error`.
  - Compare visible text as a **bag** of tokens (the draft `<main>` streams out of order).
  - Divergence is informational while pending drafts exist (`pendingDrafts` excludes `sanity.previewUrlSecret` / `sanity.previewUrlShareAccess`).
- **G-T2 (crawler on localhost).** Next 16 dev writes `.next/dev/prerender-manifest.json` with an unserialised read-modify-write the first time each `generateStaticParams` route is hit. With `--concurrency > 1`, warm one path per template **serially** first, or the JSON tears and every request sticks at 500. lsse's final full crawl ran on an **isolated production build** on another port, because shared dev servers broke mid-crawl.
- **G-T3 (`--limit` / `--probe`).** These are retest tools and never the gate. A full both-mode crawl of 744 URLs took about 1 h on the lsse dev server. Size audiofast's sitemap first; products dominate.
- **G-T4 (gates).** `source.ts` strips comments before matching, because every gate's forbidden pattern also appears in prose that warns against it.
- **G-T5 (`enum-stega-coverage`).** The vendor denylist is mirrored, and a test reads the installed `@sanity/client` dist to catch drift. It must be re-pointed after the `@sanity/client` 8 bump (D2).

---

## 8. One-time setup steps (Oliwier runs credentialed steps; D1)

1. **CORS with credentials.** Run from `apps/studio`.
   - List first: `bunx sanity cors list`.
   - Add the missing origins:
     ```bash
     bunx sanity cors add http://localhost:3000 --credentials
     bunx sanity cors add https://audiofast.pl --credentials
     ```
   - `localhost:3333` and `https://audiofast.sanity.studio` already serve the Studio; confirm they show credentials too.
   - If an origin already exists **without** credentials, re-adding may not flip the flag. Delete it and re-add, or toggle "Allow credentials" in sanity.io/manage → API → CORS origins. Verify there; Manage is the source of truth.
   - Add `https://www.audiofast.pl` only if the site is ever served from `www` without a redirect.
2. **Viewer token for `browserToken`.** Create it with `bunx sanity tokens add "presentation-browser" --role viewer`; check the CLI's exact subcommand with `bunx sanity tokens --help`, and always pass the role. Store it as the server-only `SANITY_API_READ_TOKEN` (`turbo.json` `globalEnv` already lists it) in Vercel Production and `.env.local`. It is delivered to the browser only in draft sessions.
3. **Studio env.** `SANITY_STUDIO_PRESENTATION_URL=https://audiofast.pl` in `apps/studio/.env` (or the deploy shell) **before** `bunx sanity deploy`. Then confirm the deployed bundle opens Presentation on `audiofast.pl` (G-S2).
4. **Share access** (needs a deployed Studio with `shareAccess: true`):
   - Open Presentation → share menu → enable "share preview access" once.
   - Verify with an authenticated raw query: `*[_id == "sanity-preview-url-secret.share-access"]{_id, _type, _updatedAt}` is non-empty. **Never print `.secret`.**
   - Also verify that an **unauthenticated** query for the same id returns nothing. Ids containing `.` are not publicly readable, which matters if the dataset is public.
   - The secret has no TTL; disabling share access deletes it.
   - The crawler falls back to `createPreviewSecret` (60-min TTL, needs a write-capable token) when the document is absent.
5. **Draft-session probe (A1).** Check the handshake by hand:
   ```text
   GET <base>/api/draft-mode/enable/?sanity-preview-secret=<secret>&sanity-preview-perspective=drafts&sanity-preview-pathname=/
   ```
   - It must answer **307** with exactly three `Set-Cookie` headers: `__prerender_bypass`, `sanity-preview-perspective`, and a deletion of `sanity-preview-variant`.
   - On `http://localhost` there must be no `sanity-preview-partitioned` cookie.
6. **Dataset hygiene (0.9).** Before the first run, do a read-only scan of all strings for `{4,}` stega runs. This catches copy-paste contamination. lsse found 0 of 100k strings; there is no named `strip-stega` migration.
7. **Pre-run state.**
   - Pending-draft count at freeze: any pre-existing draft on a fixture is a hard stop.
   - No Lake-writing automation during the window: denormalization recompute, CPO sync, newsletter.
   - Mac on power plus `caffeinate` for long runs.

---

## 9. Verdict tally

| Area | COPY | ADAPT | SKIP (justified) |
| --- | --- | --- | --- |
| Studio (17 rows) | `presentation-url.ts`, `presentation-url.test.ts` | config block, `routes.ts`, `locations.ts`, `news-pagination` → blog/products/CPO, `parent-pagination`, `preview-target`, `contextual-tool-menu`, `slug-preview-navigation`, and 6 tests | `structure.ts` language-pane `canHandleIntent` (no language panes) |
| Web | enable route, disable action, PreviewBar shim, LiveVisualEditing, `data-attribute`, `OptimisticBlocks`, `OptimisticReorder`, `optimistic-order.test`, `stega-text` + test, `notFoundUnlessDraft` | PreviewBarImpl/copy/styles, layout draft branch (+ consent gating), `live.ts`, `client.ts` stega filter, catch-all draft branch, PageBuilder, `optimistic-order.ts`, referenced/chrome/island annotation pattern, RollingNumber rule, drag-surface **pattern** | `DraftMediaProvider` (no consent-gated media); the 10 lsse drag-surface modules + 7 tests as files (lsse-only blocks; pattern ported) |
| Gates/tooling | `source.ts`, `summarize-results.ts` + 3 fixtures, lessons entry | crawler, `lake-cli` subset, 5 gate tests, walkthrough README/loop/template/brief/test-plan, seed applier + QA seed, root scripts, stega doc section, `frame-ancestors` (optional) | `/strona/:page` route twins and the `PAGINATED_TYPES ↔ next.config` redirect lockstep (audiofast paginates with `?page=`); the locale halves of every file |
