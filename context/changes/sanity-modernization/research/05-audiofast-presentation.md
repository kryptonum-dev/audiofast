# Audiofast: Presentation / preview / visual editing audit

Repo: `/Users/oliwiersellig/Kryptonum/audiofast` at `main` @ `533d857` (2026-10-26). Read-only audit; no files changed.

## Summary

- **There is no Presentation tool in the current codebase.** `presentationTool` is not imported or configured anywhere in `apps/studio` (`sanity.config.ts` plugins are `assist`, `structureTool`, `visionTool`, `media`). There is no draft mode, no `defineLive`/`<SanityLive>`, no `<VisualEditing>`, no stega, no `data-sanity`, and no `@sanity/preview-url-secret` usage in `apps/web`. No branch (local or remote) contains any of these either.
- It **existed once**, inherited from the Roboto Studio "turbo-start-sanity" template in the initial commit `f5c6e3c` (2025-08-15), and was **deleted wholesale in `a73f098` (2025-09-21, "feat: add custom Image, PageBuilder, PortableText")**. Removed: `apps/studio/location.ts`, `apps/studio/plugins/presentation-url.ts`, `getPresentationUrl()` in `apps/studio/utils/helper.ts`, `apps/web/src/app/api/presentation-draft/route.ts`, `apps/web/src/app/api/disable-draft/route.ts`, `apps/web/src/global/sanity/live.ts`, `<SanityLive/>` in the root layout, and the `stega` block in `client.ts`.
- The "simple version" is therefore a **greenfield add, not a simplification of existing code**. What's left today is a handful of dead leftovers (an env var, an unused `studioUrl` export, a stale comment) plus a "copy page URL" line under slug fields, which has bugs.
- **Biggest constraint on the design:** the web app is fully `cacheComponents` + `'use cache'` (14 cache scopes, 39 `sanityFetch` callers, including Header/Footer/listing components that fetch independently). Any draft preview has to thread `perspective`/`stega` from outside the cache boundary into every fetch site, or use a separate dynamic render path. That is where the work is, not in the Studio config.
- **Security finding, separate from preview but it blocks a safe preview design:** `NEXT_PUBLIC_SANITY_API_READ_TOKEN` is shipped to the browser. `client.ts` evaluates it at module top level, and a `'use client'` component (`HeroCarousel`) imports `urlFor` from that module. The token string is present in the local build's client chunk `.next/static/chunks/3xod-t24joxxp.js` (180-char `sk…` token; value not reproduced here). Because `assertValue` throws when the var is undefined, it must be set on every deployment, so production is very likely affected too. A preview setup needs a server-only viewer token, so this should be fixed (and the token rotated) first.

## 1. Current Studio preview/presentation setup

### 1.1 `apps/studio/sanity.config.ts` (114 lines)

- L28–36 plugins: `assist()`, `structureTool({ structure, defaultDocumentNode })`, `visionTool()`, `media()`. **No `presentationTool`, no `previewUrl`, no `resolve.locations`, no `mainDocuments`, no `allowOrigins`.**
- L37–51 custom tools: `newsletter` (`tools/newsletter`), `comparator` (`tools/comparator`). Neither is a site preview.
- L53–109 `document.actions` / `newDocumentOptions`: singleton action allowlist (`publish`, `discardChanges`, `restore`), a socialMedia restriction, a denorm publish wrapper (`actions/wrap-publish-with-denorm.ts`, 155 lines), and a custom `UnpublishAction` for `product`/`brand`/`blog-category`. **No "open in site" or preview action. No `document.productionUrl`.**
- `sanity.cli.ts`: `studioHost: 'audiofast'` (so the deployed Studio is `https://audiofast.sanity.studio`), `deployment.appId: 'dlwt2zhgkk7rjx6dj8rdyjfz'`.
- Sanity installed: `sanity@6.10.1`. `sanity/presentation` is available unchanged in v6, per `.ai/dependency-upgrade-plan.md`.

### 1.2 `apps/studio/structure.ts` (767 lines)

- L102 `createSingleTon`: `S.document().schemaType(type).documentId(type).views([S.view.form()])`, with the comment "Only content view, no preview". All singletons are pinned to the form view only.
- L119 `createCollection` doc comment: "Only shows content view (no preview)". Collections use `S.documentTypeListItem` or `orderableDocumentListDeskItem`.
- L720–767 `defaultDocumentNode`: extra **non-preview** views only:
  - `product`: Zawartość (form), Dane techniczne (`TechnicalDataView`), Filtry (`ProductFiltersView`)
  - `cpoProduct`: Zawartość, Dane techniczne
  - `productCategorySub`: Zawartość, Konfiguracja filtrów (`CustomFiltersConfigView`)
  - everything else: `S.document()` (default)
- No iframe/preview pane anywhere. `sanity-plugin-iframe-pane` is not installed.

### 1.3 `plugins/`, `tools/`, `components/`, `actions/`, `config/`

| Path | Preview relevance |
|---|---|
| `plugins/bulk-actions-table/` | Product bulk table; `.preview-*` CSS classes are list-row previews, not site preview |
| `tools/newsletter/index.tsx` | Has an `<iframe srcDoc>` for **newsletter HTML** preview (L927–936). Resolves the web origin via `utils/studio-api.ts` (`https://audiofast.pl/…` in production, `http://localhost:3000/…` when the Studio runs on localhost) |
| `tools/comparator/` | "TransformPreview" is a data preview, unrelated |
| `components/slug-field-component.tsx` (508 lines) | **The only "link to site" feature.** L177 `localizedPathname = \`${WEB_BASE_URL}${value?.current \|\| '/'}\``, rendered as muted text plus a "Kopiuj link" copy button (L435–461). Not clickable, no draft awareness |
| `components/define-slug-for-document.tsx` | Slug-field factory (prefix / fixed-slug modes). Used by most routable types |
| `utils/constant.ts:58–60` | `WEB_BASE_URL = isProduction() ? 'https://www.audiofast.pl/' : 'https://audiofast-git-dev-kryptonum.vercel.app/'` (hardcoded; `isProduction()` = `NODE_ENV === 'production'`, i.e. built/deployed Studio) |
| `actions/` | `unpublish-action.tsx` (26), `wrap-publish-with-denorm.ts` (155), `index.ts`. No preview actions |
| `config/dataset-embeddings.json` | Unrelated |

**Bugs in the existing "site URL" line:**
1. Double slash: `WEB_BASE_URL` ends in `/` and every slug starts with `/`, giving `https://www.audiofast.pl//produkty/x/`.
2. `productCategorySub` slugs are stored as `/kategoria/<x>/`, but the public route is `/produkty/kategoria/<x>/`, so the copied URL 404s.
3. `review` with `destinationType: 'pdf'` uses `pdfSlug`, not `slug`. External reviews have no URL.
4. The production host is `www.audiofast.pl` here but `audiofast.pl` in `utils/studio-api.ts`. They are inconsistent, which is harmless if one redirects to the other.

### 1.4 Complexity inventory (today)

Moving parts related to preview: **zero functional ones.** Leftovers:
- `apps/studio/.env.example:4` `SANITY_STUDIO_PRESENTATION_URL=` (dead; nothing reads it since `a73f098`)
- `apps/studio/.env.example:3` `SANITY_STUDIO_TITLE="Turbo Studio"` (template leftover)
- `apps/web/src/global/sanity/client.ts:42–46` `export const studioUrl` with a comment about "Presentation Mode". **Exported but imported nowhere.**
- `structure.ts:102,119` "no preview" comments / forced form-only views on singletons
- Slug field URL line (above)

### 1.5 What the deleted template version looked like (for reference)

- `presentationTool({ resolve: { locations }, previewUrl: { origin: getPresentationUrl(), previewMode: { enable: '/api/presentation-draft' } } })`
- `location.ts`: `defineLocations` for `blog`, `home`, `page` only (template types that no longer exist in that shape), with a leftover `console.log(doc)`
- `plugins/presentation-url.ts`: an `unstable_fieldActions` "Open in Presentation" button that navigated to `/presentation?preview=<slug>`
- web: `defineEnableDraftMode({ client: client.withConfig({ token }) })` at `/api/presentation-draft`, a `/api/disable-draft` route with a 1 s sleep and an open `?slug=` redirect, `defineLive({ client, serverToken: token, browserToken: token })`, `<SanityLive/>` in the root layout, and `stega: { studioUrl, enabled: NEXT_PUBLIC_VERCEL_ENV === 'preview' }`
- It never had `mainDocuments`, `allowOrigins`, `<VisualEditing>`, or per-page draft branching. It was the stock template wiring and was never adapted to Audiofast's types.

## 2. Web-side preview / draft / visual editing (apps/web)

| Item | Status | Where |
|---|---|---|
| `app/api/draft-mode/*`, `presentation-draft`, `disable-draft` | **absent** | deleted in `a73f098` |
| `@sanity/preview-url-secret` / `defineEnableDraftMode` | **not used** (available transitively via `next-sanity@13.3.3` → `./draft-mode` export) | — |
| `<VisualEditing>` | **absent** (`@sanity/visual-editing` dep explicitly removed in `b826420`; next-sanity 13 re-exports it via `next-sanity/visual-editing`) | — |
| `defineLive` / `<SanityLive>` / `next-sanity/live` | **absent** | — |
| stega | **absent / disabled** (no `stega` key on any client) | `global/sanity/client.ts:48–55` |
| `createDataAttribute` / `data-sanity` | **absent** | — |
| `useOptimistic` | only `components/comparison/FloatingComparisonBox/index.tsx:32`, comparison UI, unrelated to Sanity | — |
| `draftMode()` | **never called** anywhere in `src` | — |
| `/podglad/*` routes | **Not Sanity preview.** `podglad/email/*` = transactional email template previews; `podglad/newsletter/route.ts` = newsletter HTML preview (reads with `perspective: 'published'`) | `app/podglad/` |

### 2.1 Sanity client and fetch wrappers

`apps/web/src/global/sanity/client.ts`
- L30–33 `readToken = assertValue(process.env.NEXT_PUBLIC_SANITY_API_READ_TOKEN, …)`. **Public-prefixed, evaluated at module scope, throws if unset.**
- L48–55 shared `client`: `useCdn: IS_PRODUCTION_DEPLOYMENT`, **`perspective: process.env.VERCEL_ENV ? 'published' : 'drafts'`**, token only when not production.
  - Local `next dev` (no `VERCEL_ENV`) already renders **drafts** with the token. This is the only "preview" that works today, and only on a developer's machine.
  - Vercel preview deployments: `published` + token + no CDN. Editors cannot see drafts anywhere deployed.
  - The same shared client is used by `/api/revalidate`, `/api/newsletter/generate`, and B2C server code, so locally those also read drafts.

`apps/web/src/global/sanity/fetch.ts`
- L9–16 `freshClient`: token, no CDN, `published` (checkout CPO availability).
- L65–92 `sanityFetch`: `'use cache'` + `cacheTag(...tags)` + `cacheLife` (`seconds` in dev, `minutes` on Vercel preview, `weeks` in prod, which `next.config.ts` redefines to 30 days). **No perspective/stega parameter**, so every call is locked to the client's static perspective.
- L101–111 `sanityFetchDynamic` (4 callers: `app/actions/comparison.ts`, b2c coupon/legal-document helpers).
- L117–126 `sanityFetchFresh`.

Rendering model (from `next.config.ts` and `.ai/rendering-revalidation-research-2026-08.md`): `cacheComponents: true`, `partialPrefetching: true`, root layout is `'use cache'` (`app/layout.tsx:28`), 14 files contain `'use cache'`, and 39 files call `sanityFetch`, including `components/ui/Header`, `components/ui/Footer`, `components/pageBuilder/ProductsListing`, and `CpoProductsListing`, which fetch on their own. Under `cacheComponents`, `draftMode()`/`cookies()` cannot be read inside a cache scope. A draft path needs either the three-layer dispatcher pattern documented in `.ai/rendering-revalidation-research-2026-08.md` §5.2, or `defineLive({ strict: true })` with perspective threaded as props.

### 2.2 Other relevant infra

- `src/proxy.ts`: matcher `/((?!_next|api|.*\.[a-zA-Z0-9]+$).*)`. It handles legacy redirects and the Supabase session for `/konto-klienta*` and `/koszyk/twoje-dane`. Nothing about draft mode. Redirect map lookups apply inside an iframe too.
- **No CSP / `frame-ancestors` / `X-Frame-Options`** in `next.config.ts`, `vercel.json` (only `VERCEL_PRERENDER_METADATA_BOUNDARY`), or the proxy. The site can be iframed by the Studio today. Vercel Deployment Protection on preview URLs may still block an iframe (the `youtube-publications` plan mentions running "bez logowania do Vercel Preview").
- `app/layout.tsx:74–79`: `CookieConsent` + `Analytics` (GTM) render on production deployments. If Presentation iframes production, editors will see the cookie banner and generate GTM/Meta events unless draft mode suppresses them.
- CORS precedent: `global/sanity/operator-auth.ts:11–28` builds allowed Studio origins from `NEWSLETTER_GENERATE_ALLOWED_ORIGINS` + `NEXT_PUBLIC_SANITY_STUDIO_URL` + localhost:3333. This is the existing way the web knows the Studio origin.

## 3. Stega and leak risk

**Current:** no stega, so there is no leakage today into metadata, JSON-LD, `id`/`href` attributes, or the client.

**If stega is turned on**, these surfaces consume Sanity strings as data rather than display text and need `stegaClean` or a stega `filter`:
- Metadata: `global/seo.ts:74 getSEOMetadata` (titles, descriptions, OG) plus each route's `generateMetadata`.
- JSON-LD: `components/schema/{Organization,WebSite,Brand,Breadcrumbs,CollectionPage,Faq,Article,BlogPost}Schema.tsx` (8 files; Organization is in the root layout).
- `id` attributes from CMS `customId`/`sectionId` (11 component files, e.g. `ui/StoreLocations/index.tsx:248`, `ui/ProductGallery/index.tsx:106`, `ui/TwoColumnContent/index.tsx:69`, `cpo/CpoProductGallerySection/index.tsx:22`) are anchor targets.
- Enum-like CMS values compared in JS. There are about 35 `=== '…'` comparisons on `variant`/`layout`/`productType`/… props in `components/`, for example `ui/CpoProductCard/index.tsx:157` (`productType === 'external'`), `ui/Button/Button.tsx:48` (`variant`), and `portableText/Image/index.tsx:19` (`layout === 'double'`). Stega's default filter does **not** skip arbitrary string-option fields, so these break silently.
- Filter keys and URL params: `products/CustomFiltersBar`, `products/ProductsListing`, `pageBuilder/CpoProductsListing/CpoProductsListingInner.tsx` lowercase or slugify CMS filter names into query params (`${slug}-min`).
- Client-side search (`global/sanity/blog-search.ts`) and comparator data (`app/actions/comparison.ts`) do string matching.
- Data handed to B2C/cart/checkout (product names and prices that go into Supabase orders and emails) must never come from a stega-encoded read. B2C uses `sanityFetchDynamic`/`sanityFetchFresh`/its own clients. Keep stega off on those paths explicitly.
- Revalidation and the newsletter generator use the shared `client`. Never enable stega on that base client; enable it only per fetch in draft mode.

**Token leak (real and current):** see the Summary. `components/pageBuilder/HeroCarousel/HeroCarousel.tsx:10` (`'use client'`) imports `urlFor` from `global/sanity/client.ts`, which pulls `readToken` (a `NEXT_PUBLIC_` var, inlined at build) into the browser bundle. The repo already started moving to a server-only `SANITY_API_READ_TOKEN` (`global/sanity/blog-search-config.ts`, `turbo.json:5`), but `client.ts` was not migrated. Fix: move `urlFor`/`imageBuilder` to a token-free module, read the token from `SANITY_API_READ_TOKEN` server-only, and rotate the exposed token.

## 4. Document type → route map

Slug conventions: slugs are **full pathnames with leading and trailing slash** (`/produkty/foo/`), generated by `defineSlugForDocument` (prefix mode) or fixed for singletons (`slug` mode, read-only in production). Routes rebuild the stored slug from params, e.g. `params: { slug: \`/produkty/${slug}/\` }`. `trailingSlash: true`.

### 4.1 Routable documents (need `resolve.locations`, are candidates for `mainDocuments`)

| Type (`_type`) | Kind | Slug field / shape | Primary route (apps/web/src/app) | Also rendered on (secondary locations) |
|---|---|---|---|---|
| `homePage` | singleton (`_id: homePage`) | `slug` fixed `/` | `page.tsx` → `/` | — |
| `page` | collection | `slug` e.g. `/o-nas/` (validation bans `/blog*`, `/marki*`); **single segment only**, because the route is `[slug]` | `[slug]/page.tsx` → `/<slug>/` | — |
| `products` | singleton | fixed `/produkty/` | `produkty/(listing)/page.tsx` | default content on `produkty/(listing)/kategoria/[category]` |
| `product` | collection | `slug` `/produkty/<x>/` | `produkty/[slug]/page.tsx` | `/produkty/` and `/produkty/kategoria/<cat>/` listings, `/marki/<brand>/` (via `denormBrandSlug`), `/produkty/archiwalne/` if `isArchived`, home and pages via `featuredProducts`/`productsCarousel`/`productsListing` blocks, blog/review portable text `featuredProducts`, `/porownaj/`, `/recenzje/<x>/` (product that references the review), cart |
| `productCategorySub` | collection | `slug` `/kategoria/<x>/` (**stored without `/produkty`**) | `produkty/(listing)/kategoria/[category]/page.tsx` → `/produkty/kategoria/<x>/` | filter sidebars on all product listings and brand pages, `/porownaj/` (comparator config) |
| `productCategoryParent` | collection | none | — (grouping only) | category sidebar on `/produkty/*`, `brandsByCategoriesSection` block |
| `brands` | singleton | fixed `/marki/` | `marki/page.tsx` | — |
| `brand` | collection | `slug` `/marki/<x>/` | `marki/[slug]/page.tsx` | `/marki/`, every product page of that brand (dealer list via `brand-stores:<id>`), `brandsList`/`brandsMarquee`/`brandsByCategoriesSection` blocks, filter sidebars |
| `blog` | singleton | fixed `/blog/` | `blog/(listing)/page.tsx` | default content on `blog/(listing)/kategoria/[category]` |
| `blog-article` | collection | `slug` `/blog/<x>/` | `blog/[slug]/page.tsx` | `/blog/`, `/blog/kategoria/<cat>/`, `latestPublication`/`featuredPublications` blocks (home etc.), newsletter |
| `blog-category` | collection | `slug` `/blog/kategoria/<x>/` | `blog/(listing)/kategoria/[category]/page.tsx` | category nav on `/blog/` |
| `review` | collection | `destinationType`: `page` → `slug` `/recenzje/<x>/`; `pdf` → `pdfSlug` `/recenzje/pdf/<x>/`; `external` → none | `recenzje/[slug]/page.tsx` (page type); `recenzje/pdf/[slug]/route.ts` (PDF stream, not previewable as a page) | product pages (reviews referenced by product), brand page (`featuredReviews`), `/recenzje/archiwalne/` (orphans), publication blocks |
| `cpoPage` | singleton | fixed `/certyfikowany-sprzet-uzywany/` | `certyfikowany-sprzet-uzywany/page.tsx` | — |
| `cpoProduct` | collection | `slug` `/certyfikowany-sprzet-uzywany/<x>/`; only `productType == "internal"` and `isArchived != true` get a page | `certyfikowany-sprzet-uzywany/[slug]/page.tsx` | `cpoProductsListing` block on `cpoPage` (only `cpoPageBuilder` allows it) |
| `privacyPolicy` | singleton | fixed `/polityka-prywatnosci/` | `polityka-prywatnosci/page.tsx` | — |
| `termsAndConditions` | singleton | fixed `/regulamin/` | `regulamin/page.tsx` | — |
| `notFound` | singleton | none | `not-found.tsx` (any unknown URL) | — |
| `comparatorConfig` | singleton | none | `porownaj/page.tsx` | — |

### 4.2 Non-routable (referenced) documents: locations only, never `mainDocuments`

| Type | Appears on |
|---|---|
| `settings` | every page (root layout, Organization JSON-LD, cart support card, empty-cart state, archived-product CTA, inquiry form state, contact settings) |
| `navbar` | every page (Header) |
| `footer` | every page (Footer) |
| `socialMedia` | footer, settings JSON-LD |
| `store` | brand pages (`stores[]->`) and their products' pages |
| `award` | product pages (`award` references product) |
| `teamMember` | `teamSection` block, `contactPersons` in settings/forms |
| `faq` | `faqSection` block (`faqList[]->`) |
| `reviewAuthor` | review pages, publication cards |
| `youtubeVideo` | publication blocks (`latestPublication`, `featuredPublications`), newsletter; links out, no page |
| `redirects` | no visual (consumed by `generate:redirects` → `src/generated/redirects` → `proxy.ts`) |

Note: the revalidation webhook already encodes most of this reverse mapping (`app/api/revalidate/route.ts:380–466` `TYPE_DEPENDENCY_MAP` plus reference lookups at L123–236). It is a good source for secondary `locations`.

### 4.3 Page builder

- `pageBuilder` (`schemaTypes/definitions/pagebuilder.ts`): 21 block types, all blocks except `cpoProductsListing`. Used by `homePage`, `page`, `blog`, `brands`, `products`, `product`, `productCategorySub`, `review`, `blog-article`.
- `cpoPageBuilder`: same plus `cpoProductsListing`, used by `cpoPage`.
- Block `_type`s (22): `blurLinesTextImage`, `brandsByCategoriesSection`, `brandsList`, `brandsMarquee`, `contactForm`, `contactMap`, `cpoProductsListing`, `faqSection`, `featuredProducts`, `featuredPublications`, `gallerySection`, `heroCarousel`, `heroStatic`, `imageTextColumns`, `imageWithTextBoxes`, `imageWithVideo`, `latestPublication`, `phoneImageCta`, `productsCarousel`, `productsListing`, `stepList`, `teamSection`.
- Portable text custom types (18) in `schemaTypes/portableText/`, including `featuredProducts`, `reviewEmbed`, `youtubeVideo`, `vimeoVideo`, `imageSlider`, `twoColumnTable`.
- Insert-menu grid previews point at `/static/components/<type>.webp`, but `apps/studio/static/components/` **does not exist**, so the thumbnails are broken. Unrelated to Presentation, noted in passing.

## 5. Env vars

| Var | Where | Status |
|---|---|---|
| `SANITY_STUDIO_PRESENTATION_URL` | `apps/studio/.env.example:4` | **dead** since `a73f098`; not in turbo `globalEnv` (studio env is read by the Sanity CLI, not Turbo) |
| `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_TITLE` | studio `.env.example`, `sanity.config.ts:18–20` | live |
| `SANITY_STUDIO_NEWSLETTER_API_URL` | studio `.env.example:5` | **dead**: `utils/studio-api.ts` hardcodes the URLs |
| `NEXT_PUBLIC_SANITY_STUDIO_URL` | `turbo.json:53`, web `.env.example:9` | used only for newsletter CORS (`operator-auth.ts:15`); `client.ts` `studioUrl` export unused |
| `NEXT_PUBLIC_SANITY_API_READ_TOKEN` | `turbo.json:52`, web `.env.example:10` | **leaks to the browser** (see §3) |
| `SANITY_API_READ_TOKEN` | `turbo.json:5` | server-only; used by blog search only. The natural home for a preview/viewer token |
| `SANITY_API_WRITE_TOKEN`, `SANITY_AUTH_TOKEN`, `SANITY_WEBHOOK_SECRET`, `NEXT_REVALIDATE_TOKEN` | turbo / `.env.example` | unrelated |
| `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | turbo | drive perspective/CDN/`BASE_URL` |

No `SANITY_STUDIO_PREVIEW_*`, `NEXT_PUBLIC_SANITY_STUDIO_*` preview origin, or draft-mode secret vars exist.

`CODEBASE_OVERVIEW.md` has **no section on Presentation, preview, or draft mode** (preview hits are only "Generate HTML preview" for the newsletter, L338/L502). Relevant prior thinking lives in `.ai/rendering-revalidation-research-2026-08.md` (§5 `defineLive` + `strict: true` + three-layer dispatcher + Sanity Function sync tags, framed as "worth adopting, milestone 2"), `.ai/dependency-upgrade-plan.md` (L9, L43, L77: `@sanity/visual-editing` dropped, next-sanity 13 re-exports it "for when milestone 2 needs it"), and `.ai/caching-revalidation-plan.md:7`.

## 6. Git history

`git log --oneline --all -- apps/studio/sanity.config.ts apps/studio/plugins apps/studio/tools | head -40`: 37 commits, newest `f82d69b` (remove unused Studio dashboard), `38f8247` (youtube publications + newsletter preview), `981bc2c` (Sanity v6), …, oldest `f5c6e3c` (Initial commit from Sanity CLI). None of them touch presentation except:

- `f5c6e3c` 2025-08-15: template ships `presentationTool` + `location.ts` + `plugins/presentation-url.ts` + `/api/presentation-draft` + `live.ts` + stega
- `e0d1552` 2025-08-18: "clear out the frontend part of bootstrap" (touches `presentation-draft/route.ts`, removes template pages)
- **`a73f098` 2025-09-21: removes the whole presentation/draft/live/stega stack**
- `b826420`: deps hygiene, removes the unused `@sanity/visual-editing` dep
- `b81add7`: docs research dossier recommending `defineLive` later

Commits whose messages mention preview/visual are about email previews, newsletter preview, Vercel preview deployments (`f8f32db` "speed up preview static generation", `LIMIT_BUILD_TIME_STATIC_PARAMS`), and the product-filter Studio views. **No presentation work after September 2025.** Pickaxe searches (`-S presentationTool`, `defineLive`, `VisualEditing`, `draftMode`) confirm this.

## 7. What can be deleted / simplified now

Nothing functional to delete. Housekeeping candidates if a new preview is added:
1. `apps/studio/.env.example:4` `SANITY_STUDIO_PRESENTATION_URL` (reuse the name or remove it) and `:5` `SANITY_STUDIO_NEWSLETTER_API_URL` (dead).
2. `apps/web/src/global/sanity/client.ts:42–46` unused `studioUrl` export and stale comment (reuse for stega `studioUrl` or delete).
3. `structure.ts:102` forced `.views([S.view.form()])` on singletons and the "no preview" comments. Revisit if an iframe/preview view is wanted on singletons.
4. Replace the slug-field URL line (`slug-field-component.tsx:177`, `utils/constant.ts:58–60`) with one shared "page URL" resolver per document type (fixing the double slash, the `productCategorySub` prefix, and PDF reviews). That resolver can feed both `resolve.locations` and any "Otwórz na stronie" action.
5. `client.ts` `perspective: VERCEL_ENV ? 'published' : 'drafts'`: an implicit local-only drafts preview that also makes local revalidation/newsletter/B2C reads hit drafts. A real draft mode should replace it with explicit `published` plus a per-request override.
6. Token: move `urlFor` out of `client.ts` (or make the token import server-only) and drop the `NEXT_PUBLIC_` read token.

## 8. Risks

- **Cache Components vs draft mode:** 39 `sanityFetch` call sites and 14 `'use cache'` scopes have no perspective parameter. Draft content needs perspective (and stega) threaded through each page, plus Header/Footer/ProductsListing/CpoProductsListing, or the draft page will mix draft page bodies with published layout and listings. A partial rollout is the likeliest source of "preview shows old content" bugs.
- **Accidental cache poisoning:** if a draft read happens inside a `'use cache'` scope keyed only by query+params, draft content can be cached and served publicly. The cache key must include perspective, or draft renders must bypass `sanityFetch`.
- **Denormalized fields:** listings filter on `denorm*` fields recomputed on publish (`actions/wrap-publish-with-denorm.ts`) and by the webhook. In a draft preview a new product or brand/category change won't show up correctly in listings or brand pages until published, because the denorm fields are stale in drafts. Product-detail pages are fine.
- **`!(_id in path("drafts.**"))` filters** appear in many queries (e.g. `query.ts:751, 816, 1361, 1406, 2379, 2525, 2567, 2774`). They are harmless under perspectives (IDs are rewritten) but are noise to keep in mind. `generateStaticParams` lists only published docs, so new unpublished docs rely on on-demand rendering of unlisted params.
- **Stega silently breaking logic** (enum comparisons, ids, filter URL params, JSON-LD, metadata) if enabled broadly. See §3.
- **Iframe environment:** cookie banner and GTM/Meta Pixel fire on production; Vercel Deployment Protection may block iframing preview deployments; BotID runs in the iframe.
- **B2C pages** (`/koszyk`, `/konto-klienta`, `/podziekowania-za-zakup`) should not be preview targets. They rely on Supabase sessions and third-party cookies, which fail inside a cross-site iframe.
- **Two Studio origins** (`https://audiofast.sanity.studio`, `http://localhost:3333`) and at least three web origins (prod `www.audiofast.pl`, `audiofast-git-dev-kryptonum.vercel.app`, localhost:3000) need to be wired consistently for `previewUrl`/`allowOrigins` and Sanity CORS.
- **The exposed read token** makes any "draft preview" security model moot until it is rotated: anyone can already read drafts with it, assuming it has viewer rights.

## 9. Open questions

1. Since no Presentation tool exists, what does "simple version" mean for the team? Options, from least to most work:
   a. Studio-only "Otwórz na stronie" (document action or clickable slug link) to the **published** URL, built from a shared URL resolver. No web changes.
   b. a. plus `presentationTool` with `resolve.locations` only (the "Used on N pages" banner, no `mainDocuments`), previewing **published** content (no draft mode). This needs only `previewUrl.origin`. Verify Presentation's behaviour without a `previewMode.enable` route.
   c. Real draft preview: `defineEnableDraftMode` route + server-only viewer token + perspective threading, **without stega/overlays** (no click-to-edit).
   d. Full visual editing: c. plus stega + `<VisualEditing>`, with the stega cleanup in §3.
2. Should preview target production (`www.audiofast.pl`) or the `dev` branch deployment (`audiofast-git-dev-kryptonum.vercel.app`, which `WEB_BASE_URL` already uses for the non-prod Studio)? Is that deployment behind Vercel protection?
3. Which document types are in scope? Products, brands, blog articles, pages and home are probably enough; listings and categories pose the denorm problem.
4. Is `mainDocuments` (URL → document navigation inside Presentation) wanted, or only `locations` (document → URL)?
5. Should the token leak be fixed as a separate prerequisite PR (recommended), and who rotates the token in Sanity and Vercel?
6. Should draft-mode renders suppress `CookieConsent`/`Analytics`?
7. Is `defineLive` (`strict: true`) + Sanity Function sync tags (`.ai/rendering-revalidation-research-2026-08.md` §5, "milestone 2") planned anyway? If yes, the draft-mode plumbing should be designed together with it rather than as a separate perspective-threading layer.
