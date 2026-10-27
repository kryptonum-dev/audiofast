# 09 — Audiofast: drag arrays, stega filter, emptiness predicates, patch-emitting inputs

Repo: `/Users/oliwiersellig/Kryptonum/audiofast` at `main` @ `533d857` (2026-10-26). Read-only research; no files changed except this report.
Builds on `05-audiofast-presentation.md` (§3 stega surfaces, §4 route map, §4.3 blocks) and `03-presentation-reference.md` (§3.4 failure classes A–P, §4 leaks, §6 target). Paths are repo-relative. `q:` = `apps/web/src/global/sanity/query.ts`, `pb/` = `apps/web/src/components/pageBuilder/`, `sch/` = `apps/studio/schemaTypes/`.

## 0. Summary

- **54 inventory rows** (some rows group nested sub-arrays) across the 22 blocks, shared objects, documents, chrome and portable-text custom blocks:
  - **DRAGGABLE as projected: 12.** PageBuilder ×2 (`pageBuilder`, `cpoPageBuilder`), `heroStatic.blocks`, `imageWithTextBoxes.boxes`, `stepList.steps`, `navbar.buttons`, `footer.links`, `notFound.buttons`, `product.downloadablePdfs`, PT `ptArrowList.items`, `ptCircleNumberedList.items`, `ptTwoColumnTable.rows`. These already project `_key`.
  - **DRAGGABLE-NEEDS-KEY-REPROJECTION: 11.** Either a bare `refs[]->{…}` (drops `_key`) or an object projection without `_key`.
  - **NOT-DRAGGABLE: 31.** Each is listed in §1.8 with its reason. The reasons are embla carousels with `loop:true` and/or duplicated DOM, CSS marquees, a query-imposed order, `select()`-wrapped (no Content Source Map), a hidden field edited in a custom pane, a primitive array, or no visual list.
- **The biggest structural blocker for overlays is `select()`.** Several arrays come out of a GROQ `select()` and are untraced by Content Source Maps, so they get **no stega and no auto-overlay**: `featuredProducts.newProducts`, `featuredPublications.publications`, `brandsList.brands`, `latestPublication.publication`, CPO `details`/`technicalData`, and review `gallery`. Product names inside the "new products" carousel and the manual publications carousel will therefore not be click-to-edit.
- **Most routed queries already project `_id`.** `queryProductBySlug`, `queryBrandBySlug` and the `categoryContent` branch of `queryProductsPageContent` do **not** project `_type`, which `createDataAttribute` needs. Hardcode the type per route or add `_type`.
- **Stega:** the vendor `filterDefault` already skips a lot (`*type*` paths, `variant`, `layout`, `href`, `email`, `website`, `link`, `url`, `unit`, `icon`, `*Id`, `_*`, `slug.current`, URLs/dates, `seo`/`openGraph`). A **~30-name** `STEGA_LOGIC_ONLY_FIELDS` plus **3 parent-name subtrees** covers the rest (§2.5). Collisions on `name` and `title` need `stegaClean` at about 14 render sites (§2.6).
  - Fetching the product/CPO **filter-metadata** queries with `stega: false` avoids a whole class-A bug family: filter names flow into GROQ params and `Map` keys.
- **Correction to 05 §3:** `customId` values are **hardcoded literals** in `app/**/page.tsx`, not CMS values. `sch/shared/section-id.ts` defines `sectionId`, but it is never registered on any type, never queried and never rendered. There are **no CMS-driven `id` attributes**.
- **Patch-emitting Studio surfaces: 13.** Two of them **write to published directly** (`CustomFiltersConfigView` ×2 code paths, `ReviewAuthorManager`), and the bulk-publish path bypasses the denorm wrapper (§4).
- **Orderable lists:** `orderableDocumentListDeskItem` is used for `brand` and `blog-category` only. `orderRankField` sits on 8 types (§5).
- **Image helper bypass:** HeroCarousel, HeroStatic, BrandsMarquee (background) and NotFound build `urlFor()` URLs by hand. All four **do forward hotspot/crop**, so the class-I risk is low. They are still four sites to annotate with `data-sanity` manually (§6).

---

## 1. Array inventory for drag-and-drop

### 1.1 Classification rules used

- **DRAGGABLE**: keyed object items (`_key` survives the GROQ projection), rendered as siblings in one DOM container, no clones, no library-managed transforms. Annotate each item with `data-sanity={dataAttribute(\`<path>[_key=="${_key}"]\`)}`.
- **DRAGGABLE-NEEDS-KEY-REPROJECTION** ("NEEDS-KEY"): renderable as above, but the projection loses `_key`. There are two shapes:
  - `refs[]->{…}` (the deref replaces the reference object). Fix: `refs[]{ _key, ...@->{…} }`, or `"items": refs[]{_key, "doc": @->{…}}`.
  - `arr[]{ field, … }` with no `_key` and no `...`. Fix: add `_key`.
- **NOT-DRAGGABLE**: see §1.8 for the reasons. Overlay-only (click-to-edit on an item without drag) is still possible for some of them, and is noted where cheap.
- "`select()` → untraced" means CSM returns no source for values produced by a `select()` branch. There is no stega and no auto-overlay for anything inside it. Explicit `data-sanity` still works, provided the `_key` is projected.

### 1.2 PageBuilder root

| Array (schema) | Items | GROQ | Render | Class |
|---|---|---|---|---|
| `pageBuilder` (`sch/definitions/pagebuilder.ts:24-42`) on `homePage`, `page`, `blog`, `brands`, `products`, `product`, `productCategorySub`, `review`, `blog-article` | 21 block objects, `_key` | `q:940` `pageBuilder[]{ ..., … }` (keeps `_key`) | `apps/web/src/components/shared/PageBuilder.tsx:77` (`key={block._key}` on every case, :83–:246) | **DRAGGABLE**, plus optimistic reorder (Najbar `OptimisticBlocks`/`OptimisticReorder`). Server component. Needs new props `documentId`/`documentType`. `indexOffset`/`effectiveIndex` (H1 selection) re-derives correctly after reorder. |
| `cpoPageBuilder` (`pagebuilder.ts:45-65`) on `cpoPage` | 22 blocks | same fragment (`q:1116` `queryCpoPage`) | same | **DRAGGABLE** |

Callers that must pass the document identity:
- `app/page.tsx`, `app/[slug]/page.tsx`, `app/certyfikowany-sprzet-uzywany/page.tsx`, `app/produkty/(listing)/page.tsx` + `kategoria/[category]/page.tsx` (two docs: `products` default vs `productCategorySub`; **no `_type` in `categoryContent`**, `q:1737`), `app/marki/page.tsx`, `app/blog/(listing)/page.tsx` (+ `kategoria`), `app/produkty/[slug]/page.tsx` (**no `_type`**, `q:2408`), `app/blog/[slug]/page.tsx`, `app/recenzje/[slug]/page.tsx`, `app/not-found.tsx`.

### 1.3 The 22 page-builder blocks

| # | Block | Authored array (schema file:line) | Items | GROQ projection (`q:` line) | Render (file:line) | Client island? | Class |
|---|---|---|---|---|---|---|---|
| 1 | `heroCarousel` | `slides` (`sch/blocks/heroCarousel.ts:15-17`) | `heroSlide` objects | `q:478` `slides[]{ image, button, title, description }`: **no `_key`** | `pb/HeroCarousel/HeroCarousel.tsx:338` (`key={i}`) | yes (`'use client'`) | **NOT** (custom autoplay cross-fade carousel; only the active slide is visible, the others are `aria-hidden`; the background `<picture>` layer is decoupled from the slide DOM). Overlay-only per slide is possible after adding `_key`. |
| | | `brands` (`heroCarousel.ts:94-97`) | refs → `brand` | `q:484` `brands[]->{…}` (drops `_key`) | `pb/HeroCarousel/BrandMarquee.tsx:21` (`[...brands, ...brands]`) | no | **NOT** (CSS marquee, duplicated DOM) |
| 2 | `heroStatic` | `blocks` (`sch/blocks/heroStatic.ts:65-68`) | `heroBlock` objects | `q:501` `blocks[]{ _key, … }` | `pb/HeroStatic/index.tsx:125` (`key={block._key}`) | no (async server) | **DRAGGABLE** |
| 3 | `latestPublication` | none (single `publication` ref) | — | `q:510-514` `select()` → untraced | — | — | n/a |
| 4 | `imageTextColumns` | none | — | — | — | — | n/a |
| 5 | `blurLinesTextImage` | none | — | — | — | — | n/a |
| 6 | `imageWithVideo` | none | — | — | — | — | n/a |
| 7 | `imageWithTextBoxes` | `boxes` (`sch/blocks/image-with-text-boxes.ts:29-32`) | `textBox` objects | `q:581` `boxes[]{ _key, … }` | `pb/ImageWithTextBoxes/index.tsx:45` | no | **DRAGGABLE** |
| 8 | `featuredPublications` | `publications` (`sch/blocks/featured-publications.ts:50-53`) | refs → 4 types | `q:613` `select(selectionMode=="manual" => publications[]->[filter]{…})`: drops `_key`, filtered, **untraced** | `pb/FeaturedPublications/PublicationsCarousel.tsx:112` (doubled at `:35` when 4–5 items) | yes | **NOT** (embla `loop:true` + clone-by-duplication + `select()` + `.filter` at `:111`) |
| 9 | `featuredProducts` | `newProducts` (`sch/blocks/featured-products.ts:57-60`) | refs → `product` | `q:694` `select(newProductsMode=="manual" => newProducts[]->{…}, *[…])`: drops `_key`, **untraced** | `pb/FeaturedProducts/ProductsCarousel.tsx:39` via `Carousels.tsx:124` | yes | **NOT** (embla `loop:true`; tabbed, so the inactive tab is unmounted; `select()`) |
| | | `bestsellers` (`featured-products.ts:110-113`) | refs → `product` | `q:706` `productFragment('bestsellers[]->')` (drops `_key`) | same, `Carousels.tsx:132` | yes | **NOT** (embla loop, tabbed) |
| 10 | `productsCarousel` | `products` (`sch/blocks/products-carousel.ts:22-25`) | refs → `product` | `q:714` `products[]->` (drops `_key`) | `pb/ProductsCarousel/ProductsCarouselWrapper.tsx:108` (doubled at `:33`) | yes | **NOT** (embla loop + duplication) |
| 11 | `brandsMarquee` | `topBrands` (`sch/blocks/brands-marquee.ts:55-58`) | refs → `brand` | `q:725` `topBrands[]->{…}` | `pb/BrandsMarquee/BrandMarqueeList.tsx:37` (`[...brands, ...brands]` at `:31`) | yes (rendered under `BrandSelector.tsx`, `'use client'`) | **NOT** (marquee, duplicated DOM, hover-driven header swap) |
| | | `bottomBrands` (`brands-marquee.ts:89-92`) | refs → `brand` | `q:733` | same | yes | **NOT** (same) |
| 12 | `brandsList` | `selectedBrands` (`sch/blocks/brands-list.ts:55-58`) | refs → `brand` | `q:752` `select(… "manual" => selectedBrands[]->[]{…} \| order(orderRank))` | `pb/BrandsList/index.tsx:40` | no | **NOT** (query re-sorts by `orderRank`, so authored order is ignored; `select()` → untraced). Order is controlled by the orderable `brand` list (§5). |
| 13 | `productsListing` | none (query-driven listing) | — | `q:765` | — | — | n/a (query-derived) |
| 14 | `cpoProductsListing` | none | — | `q:798` | `pb/CpoProductsListing/CpoProductsListingInner.tsx:112` | — | n/a (query-derived) |
| 15 | `brandsByCategoriesSection` | none (`categoriesWithBrands` is a query) | — | `q:810` | `pb/BrandsByCategoriesSection/index.tsx:67`, `CategoryAccordion.tsx:103` | yes | n/a (query-derived) |
| 16 | `faqSection` | `faqList` (`sch/blocks/faq-section.ts:75-78`) | refs → `faq` | `q:838` `faqFragment('faqList[]->')` (drops `_key`) | `pb/FaqSection/FaqList.tsx:32` + `:42` (split by `idx % 2` into two columns) | yes | **NEEDS-KEY**. Caveat: interleaved two-column DOM, so a drop position across columns is not 1:1 with array order. Consider a single flow container in draft, or accept it. The same data feeds `FaqSchema` JSON-LD (`FaqSection/index.tsx:36`). |
| | | `contactPeople.contactPersons` (`sch/shared/contact-people.ts:101-104`) | refs → `teamMember` | `q:841` `teamMemberFragment('contactPersons[]->')` | `pb/FaqSection/index.tsx:67` | no | **NEEDS-KEY** |
| 17 | `contactForm` | `contactPeople.contactPersons` | refs → `teamMember` | `q:865` | `pb/ContactForm/index.tsx:65` | no | **NEEDS-KEY** |
| | | `accountList` (`sch/blocks/contact-form.ts:35-38`) | `account` objects | `q:867` `accountList[]{ heading, accountDetails }`: **no `_key`** | `pb/ContactForm/index.tsx:78` (`key={idx}`) | no | **NEEDS-KEY** |
| | | `accountList[].accountDetails` (`contact-form.ts:53-56`) | **primitive** `string[]` | `q:869` | `pb/ContactForm/index.tsx:86` | no | **NOT** (primitive array: no `_key`, and Presentation drag needs keyed items) |
| 18 | `contactMap` | none | — | — | — | — | n/a |
| 19 | `teamSection` | `teamMembers` (`sch/blocks/team-section.ts:61-64`) | refs → `teamMember` | `q:907` `teamMemberFragment('teamMembers[]->')` | item 0 → `GrayImageCtaCard` at `pb/TeamSection/index.tsx:36-45`; items 1..n → `:48` (`slice(1)`) | no | **NEEDS-KEY**. Caveat: item 0 renders in a different component and container, so dragging into or out of slot 0 crosses parents. Annotate both. |
| 20 | `gallerySection` | `images` (`sch/blocks/gallery-section.ts:32-35`) | `image` objects | `q:572` `imageFragment('images[]')` = `images[]{ "id": asset._ref, … }`: **no `_key`** | `pb/GallerySection/index.tsx:32` (CSS grid) | no | **NEEDS-KEY** |
| 21 | `phoneImageCta` | none | — | — | — | — | n/a |
| 22 | `stepList` | `steps` (`sch/blocks/step-list.ts:31-34`) | `step` objects | `q:932` `steps[]{ _key, … }` | `pb/StepList/Steps.tsx:89` | **yes** | **DRAGGABLE**. Pass a pre-computed `data-sanity` per step. Scroll-line effect (`Steps.tsx:18`, `[]` deps) queries `<li>`s once; React moves keyed nodes, so it should survive reorder. Verify in the walkthrough. |

### 1.4 Document page sections (outside PageBuilder)

| Doc / array (schema file:line) | Items | GROQ (`q:`) | Render (file:line) | Island | Class |
|---|---|---|---|---|---|
| `product.downloadablePdfs` (`sch/documents/collections/product.ts:235-237`) | `pdfItem` objects | `q:2474` `downloadablePdfs[]{ _key, … }` | `apps/web/src/components/products/DownloadSection/index.tsx:43` | no | **DRAGGABLE** |
| `product.availableInStores` (`product.ts:366-368`) | refs → `store` | `q:2453` `availableInStores[]->{…}` | `apps/web/src/components/ui/StoreLocations/index.tsx:258`; markers in `StoreMap.tsx` (client) | list: no; map: yes | **NEEDS-KEY**. Caveats: deduped by `_id` (`:175-182`), geocode-filtered for the map. When empty, the page falls back to the **brand's** `stores` (`queryBrandStoresById`, `q:2393`), and the `data-sanity` must then point at the brand document. |
| `brand.stores` (`sch/documents/collections/brand.ts:198-200`) | refs → `store` | `q:2356` `stores[]->{…}` | `ui/StoreLocations/index.tsx:258` (brand page `app/marki/[slug]/page.tsx:365`) | no | **NEEDS-KEY** (same caveats) |
| `product.imageGallery` (`product.ts:293-295`) | `image` | `q:2420` `imageFragment('imageGallery[]')` (no `_key`) | `apps/web/src/components/ui/ProductGallery/index.tsx:155` via `TwoColumnContent` | yes | **NOT** (embla thumbs `loop:true` `:31-32`; main image is a single swapped slot) |
| `brand.imageGallery` (`brand.ts:177-179`) | `image` | `q:2354` | same | yes | **NOT** (same) |
| `review.imageGallery` (`sch/documents/collections/review.tsx:269-271`) | `image` | `q:1442` inside `select()` (`gallery`) → untraced | `app/recenzje/[slug]/page.tsx:99` → `ProductGallery` | yes | **NOT** (carousel + `select()`) |
| `cpoProduct.imageGallery` (`sch/documents/collections/cpo-product.tsx:566-568`) | `image` | `q:1259` | `apps/web/src/components/cpo/CpoProductGallerySection/index.tsx:25` → `ProductGallery` | yes | **NOT** (carousel; page falls back to `internalProduct` gallery, `app/certyfikowany-sprzet-uzywany/[slug]/page.tsx:150-153`) |
| `product.reviews` (`product.ts:306-308`) | refs → `review` | `q:2470` `reviews[]->{…}` | `app/produkty/[slug]/page.tsx:292` → `FeaturedPublications` carousel | yes | **NOT** (embla loop/duplication) |
| `product.relatedProducts` (`product.ts:334-336`) | refs → `product` | `q:2473` | `app/produkty/[slug]/page.tsx:320` → `ProductsCarousel` | yes | **NOT** (embla loop/duplication) |
| `brand.featuredReviews` (`brand.ts:223-225`) | refs → `review` | `q:2355` `publicationFragment('featuredReviews[]->')` | `app/marki/[slug]/page.tsx:319` → `FeaturedPublications` | yes | **NOT** (carousel) |
| `product.categories` (`product.ts:46-48`) | refs → `productCategorySub` | `q:2465` | no visual list (comparison button, analytics categories, breadcrumbs use slugs) | — | **NOT** (no visual list; `[0]` has logic meaning in denorm) |
| `product.technicalData.variants` (`product.ts:632-634`) | primitive `string[]` | `q:2438` | `apps/web/src/components/products/TechnicalData/index.tsx:99`, `:153` | yes | **NOT** (primitive; hidden field) |
| `product.technicalData.groups[].rows[].values[]` (`product.ts:640-679`) | objects, `_key` | `q:2438-2450` (keys kept) | `products/TechnicalData/index.tsx:217`, `:109`, `:115` (and mobile `:161`, `:181`) | yes | **NOT** (field is `hidden: true`, `product.ts:629`; edited only in the `TechnicalDataView` pane, so click-to-edit would open a hidden field. Responsive layout switches via JS (`isMobile`). Optional overlay-only later.) |
| `cpoProduct.technicalData.*` (`cpo-product.tsx:14-74`) | same | `q:1299` inside `select()` → untraced | same component | yes | **NOT** (hidden + `select()`) |
| `product.details.content` / `brand.brandContentBlocks` (`product.ts:179-182`, `brand.ts:80-82`) | legacy content blocks | `q:227` `brandContentBlocksFragment` (`_key` kept) | `apps/web/src/components/ui/ContentBlocks/index.tsx:176` | YT/Vimeo children client | **NOT** (`hidden: true` legacy, superseded by `productDetailContent`/`brandDetailContent` PT) |
| `product.customFilterValues` (`product.ts:556-558`) | objects | `q:1794` (filter metadata) | none (data only) | — | **NOT** (hidden; edited in `ProductFiltersView`) |
| `productCategorySub.customFilters` (`sch/documents/collections/product-category-sub.ts:79-81`) | `customFilterDefinition` | `q:1746` | `apps/web/src/components/products/CustomFiltersBar/index.tsx:418` (filter controls) | yes | **NOT** (hidden; edited in `CustomFiltersConfigView`, which auto-publishes, §4) |
| `blog-article.keywords` (`sch/documents/collections/blog-article.ts:181-183`) | primitive `string[]` | `q:1393` | JSON-LD only (`components/schema/BlogPostSchema.tsx:122`) | — | **NOT** (primitive; not rendered visibly) |
| `award.products` (`sch/documents/collections/award.ts:29-31`) | refs → `product` | reverse lookup `*[_type=="award" && references(^._id)]` (`q:2428`) | `products/ProductHero/index.tsx:199` (marquee doubles at ≥8, `:79`) | yes | **NOT** (query-derived; order not authored per product) |
| `comparatorConfig.categoryConfigs[].enabledParameters` (`sch/documents/singletons/comparator-config.ts:13-36`) | objects | `q:2602` via server action `app/actions/comparison.ts` | `/porownaj/` client UI | yes | **NOT** (cookie-driven page fed by a server action, not a CMS route) |
| PT fields (`productDetailContent`, `brandDetailContent`, blog/review `content`, …), top-level blocks | PT blocks | `portableTextFragmentExtended` | `apps/web/src/components/ui/UnifiedContentBlocks/index.tsx:36` (split into sections by `ptPageBreak`/`ptTwoColumnLine`) | no | **NOT** (PT block order is the PT editor's job; spans get stega overlays automatically) |

### 1.5 Chrome (Header / Footer / 404 / settings)

| Array (schema) | Items | GROQ | Render | Island | Class |
|---|---|---|---|---|---|
| `navbar.buttons` (`sch/documents/singletons/navbar.ts:12-15`) | `buttonWithNoVariant` | `q:1012` `buttonFragment('buttons[]')` (includes `_key`) | `apps/web/src/components/ui/Header/HeaderLinks.tsx:20` | **yes** | **DRAGGABLE**. `Header/index.tsx:8` is itself `'use cache'`, so it needs the draft-threading work from 05 §2.1. Pass `Record<_key, string>` of `data-sanity` strings into `HeaderShell` → `HeaderLinks`. |
| `footer.links` (`sch/documents/singletons/footer.ts:43-44`) | `buttonWithNoVariant` | `q:1021` (includes `_key`) | `apps/web/src/components/ui/Footer/index.tsx:37` (`slice(0,3)`) + `:44` (`slice(3)`) | no | **DRAGGABLE**. Caveat: two columns split at index 3, so crossing columns is a valid reorder but looks like a jump. `key={link.text}` (stega'd text as React key; harmless). |
| `footer.highlightedSocialMedia` (`footer.ts:12-13`) | refs → `socialMedia` | `q:1016` `highlightedSocialMedia[]->{…}` (drops `_key`) | `ui/Footer/index.tsx:24` | no | **NEEDS-KEY** (also a class-A leak: `iconString` SVG, §2) |
| `notFound.buttons` (`sch/documents/singletons/not-found.ts:56-60`) | `button` | `q:1080` (includes `_key`) | `pb/NotFound/index.tsx:57` | no | **DRAGGABLE**, but the 404 is published-pinned in draft (03 §3.4 M), so it is only verifiable if the 404 path threads draft. |
| `settings.contactSettings.supportEmails`, `settings.b2cTransactionalEmailCopyRecipients` (`sch/documents/singletons/settings.ts:183-184`, `:275-276`) | primitive | API / B2C only | — | — | **NOT** (primitive, not rendered) |
| `redirects.redirects` (`sch/documents/singletons/redirects.tsx:129`) | objects | build-time generator | — | — | **NOT** (no visual) |

### 1.6 Portable-text custom blocks (nested arrays)

The renderer (`apps/web/src/components/portableText/index.tsx`) doesn't know the document id or the field path. To annotate nested PT arrays it needs an optional `dataAttribute` prop scoped to the PT field. Custom type components then build `field[_key=="<blockKey>"].items[_key=="<itemKey>"]` from `value._key`. That is one new prop threaded through about 40 `PortableText` call sites; only the PT fields that allow custom components need it.

| PT type (schema) | Array | GROQ (`q:`) | Render | Class |
|---|---|---|---|---|
| `ptArrowList` (`sch/portableText/arrow-list.ts:13-16`) | `items[]` objects | `q:113` `items[]{ _key, … }` | `portableText/ArrowList/index.tsx:18` | **DRAGGABLE** (needs PT path context) |
| `ptCircleNumberedList` (`circle-numbered-list.ts:13-16`) | `items[]` | `q:120` (`_key`) | `portableText/CircleNumberedList/index.tsx:18` (`data-number={index+1}` re-numbers itself) | **DRAGGABLE** (PT context) |
| `ptTwoColumnTable` (`two-column-table.ts:13-16`) | `rows[]` | `q:140` (`_key`) | `portableText/TwoColumnTable/index.tsx:20` (`<tr>`) | **DRAGGABLE** (PT context) |
| `ptFeaturedProducts` (`featured-products.ts:10-18`) | refs → `product` | `q:148` `productFragment('products[]->')` | `portableText/FeaturedProducts/index.tsx:18` (grid) | **NEEDS-KEY** (+ PT context) |
| `ptCtaSection` (`cta-section.ts:31-39`) | refs → `product` | `q:136` `productFragment('products[]->')` | `portableText/CtaSection/index.tsx:22` | **NEEDS-KEY** (+ PT context) |
| `ptImageSlider` (`image-slider.ts:10-17`) | `image[]` | `q:184` `imageFragment('images[]')` (no `_key`) | `portableText/ImageSlider/Slider.tsx:206` (`'use client'`, doubled 4–5 at `:29-34`, embla loop `:37-38`) | **NOT** (carousel + clones) |
| `ptImage`, `ptMinimalImage`, `ptInlineImage`, `ptQuote`, `ptButton`, `ptHeading`, `ptYoutubeVideo`, `ptVimeoVideo`, `ptReviewEmbed`, `ptPageBreak`, `ptTwoColumnLine`, `ptHorizontalLine` | — | — | — | n/a (no arrays) |
| technical-data cell PT (`product.ts:691`) | blocks | — | — | n/a (hidden field) |

### 1.7 Client islands that render annotatable arrays (pass strings, not the factory)

`createDataAttribute()` returns a callable with `.scope()`, which is not serializable across the RSC boundary (03 §3.4 E). For each island, compute strings on the server, e.g. `items.map(i => ({...i, _dataSanity: attr(\`steps[_key=="${i._key}"]\`)}))` or a `Record<_key,string>`.

| Island | Arrays | Server parent that must compute strings |
|---|---|---|
| `pb/StepList/Steps.tsx` | `stepList.steps` | `pb/StepList/index.tsx:29` |
| `apps/web/src/components/ui/Header/HeaderLinks.tsx` (via `HeaderShell.tsx:41`, also client) | `navbar.buttons` | `ui/Header/index.tsx:14` |
| `pb/FaqSection/FaqList.tsx` (+ `ui/Accordion`) | `faqSection.faqList` | `pb/FaqSection/index.tsx:49` |
| `pb/HeroCarousel/HeroCarousel.tsx` | `heroCarousel.slides` (overlay-only) | `pb/HeroCarousel/index.tsx:14` |
| `products/TechnicalData/index.tsx` | `technicalData` (only if overlay-only is adopted later) | product/CPO pages |
| Block-level wrappers | none: PageBuilder wraps each block in a server `<div data-sanity>` (Najbar pattern), so no block needs the factory itself | — |

All carousel/marquee islands (`PublicationsCarousel`, `ProductsCarouselWrapper`, `FeaturedProducts/*`, `BrandSelector`/`BrandMarqueeList`, `ProductGallery`, `ImageSlider/Slider`, `CategoryAccordion`) get **no** item annotations. Text inside them still gets stega overlays where CSM traces it.

### 1.8 NOT-DRAGGABLE list with reasons (the exclusion register for the `data-attribute-coverage` gate)

| Array | Reason class | Detail |
|---|---|---|
| `heroCarousel.slides` | carousel (custom, autoplay) | one visible slide; background layer separate; overlay-only possible after `_key` |
| `heroCarousel.brands` | marquee, duplicated DOM | `BrandMarquee.tsx:15` |
| `brandsMarquee.topBrands`, `.bottomBrands` | marquee, duplicated DOM | `BrandMarqueeList.tsx:31` |
| `featuredProducts.newProducts` | carousel lib + `select()` + automatic mode is query-driven | embla `loop:true` |
| `featuredProducts.bestsellers` | carousel lib, tabbed | embla `loop:true` |
| `featuredPublications.publications` | carousel lib + clones + `select()` + filter | |
| `productsCarousel.products` | carousel lib + clones | |
| `brandsList.selectedBrands` | query-imposed order (`order(orderRank)`) + `select()` | edit order in the orderable brand list |
| `contactForm.accountList[].accountDetails` | primitive array | |
| `product/brand/review/cpoProduct.imageGallery` | carousel lib (thumbs `loop:true`) | review/CPO also via `select()`/fallback |
| `product.reviews`, `product.relatedProducts`, `brand.featuredReviews` | carousel lib + clones | |
| `product.categories` | no visual list | |
| `product.technicalData.*`, `cpoProduct.technicalData.*` | hidden field, custom-pane editor (+ `select()` on CPO) | |
| `product.details.content`, `brand.brandContentBlocks` | hidden legacy field | |
| `product.customFilterValues`, `productCategorySub.customFilters` | hidden, custom-pane editor; feeds query-driven listing | |
| `blog-article.keywords`, `settings.*Emails`, `redirects.redirects` | primitive / not rendered | |
| `award.products` | reverse-reference, query-derived | |
| `comparatorConfig.*` | server-action-fed page, not a CMS route | |
| `ptImageSlider.images` | carousel lib + clones | |
| PT top-level blocks | PT editor owns order | |
| `productsListing`, `cpoProductsListing`, `brandsByCategoriesSection`, `latestPublication` | query-derived / single ref | no authored array |

### 1.9 GROQ re-projection worklist (NEEDS-KEY rows plus the lint target)

Every bare `[]->` in `q:` (03 §3.2 gate 0.5 would flag all of them):
- 136 `ptCtaSection.products`
- 148 `ptFeaturedProducts.products`
- 390 `productFragment.categories`
- 484 `heroCarousel.brands`
- 613 `publications`
- 672 `productProjection.categories`
- 694 `newProducts`
- 706 `bestsellers`
- 714 `productsCarousel.products`
- 725 / 733 `topBrands` / `bottomBrands`
- 752 `selectedBrands`
- 838 `faqList`
- 841 / 865 `contactPersons`
- 907 `teamMembers`
- 1016 `highlightedSocialMedia`
- 2202 / 2465 / 2552 / 2595 `categories`
- 2355 `featuredReviews`
- 2356 `stores`
- 2393 `queryBrandStoresById` (`.stores[]->`)
- 2453 `availableInStores`
- 2470 `reviews`
- 2473 `relatedProducts`

Re-project only the NEEDS-KEY ones:
- 148, 136
- 838, 841, 865
- 907
- 1016
- 2356, 2393, 2453

Allow-list the rest in the lint with "not draggable" as the reason. Object projections missing `_key`: `q:478` (slides, only if overlay-only is wanted), `q:572` (gallery images), `q:867` (accountList).

---

## 2. Stega filter

### 2.1 What the vendor default already skips (`@sanity/client@7.26.2`, `node_modules/@sanity/client/src/stega/filterDefault.ts`)

- URL- and date-shaped values.
- `slug.current`.
- Leaf starting with `_` or ending in **`Id`**. This is case-sensitive, so `gtm_id` is *not* skipped.
- Any path segment `meta|metadata|openGraph|seo`.
- **Any path or result segment matching `/type/i`**.
- Denylist leaves: `color colour currency email format gid hex href hsl hsla icon id index key language layout link linkAction locale lqip page path ref rgb rgba route secret slug status tag template theme type textTheme unit url username variant website`.
- PT internals (`style`, `listItem`, `marks`) are never visited; only `span.text` is encoded.

Free for Audiofast as a result:
- `button.variant`, `customUrl.type`/`href`/`external` (URL), `ptImage.layout`
- `review.destinationType`, `cpoProduct.productType`, `customFilterDefinition.filterType`, `blog-article.authorType` (all `/type/i`)
- `unit`, `email`, `website`, `socialMedia.link`, `externalUrl`, `videoUrl`
- `youtubeId`, `vimeoId`, `metadataVideoId`, `metaPixelId`, `mailchimpAudienceId`
- `icon.asset->url` (`url`), `lqip`, `asset._ref`, `seo.*`, `openGraph.*`

**Also free:** anything produced by `select()`/`coalesce()`/concatenation/functions is untraced, so it carries no stega. This covers all `href`s built by `buttonFragment`/`markDefsFragment` (`q:51-68`, `q:210-222`), `publicationBlock.slug`/`destinationType`/`publicationType`, and CPO `lower(brandName)`.

### 2.2 `options.list` enum fields (gate 0.2 input)

| Field (schema file:line) | Values | Vendor-skipped? | Web consumer | Action |
|---|---|---|---|---|
| `faqSection.displayMode` (`sch/blocks/faq-section.ts:20-28`) | both/faqOnly/contactOnly | no | `pb/FaqSection/index.tsx:25,27,29` (`===`) **and `:34` `data-display-mode` + SCSS attribute selectors** | **list** (live class-A bug) |
| `ptInlineImage.float` (`sch/portableText/inline-image.ts:25-33`) | left/right | no | `portableText/InlineImage/index.tsx:37` className compare | **list** |
| `cpoProduct.availabilityStatus` (`sch/documents/collections/cpo-product.tsx:408-433`) | available/on_hold/sold_out/manually_unavailable | no (`status` is exact-match only) | `app/certyfikowany-sprzet-uzywany/[slug]/page.tsx:142` → `getCpoProductBuyability` | **list** (B2C buyability) |
| `brandsList.brandsDisplayMode` (`sch/blocks/brands-list.ts:41-54`) | all/manual | no | GROQ-side only; spread into result via `...` | list (gate parity, cheap) |
| `featuredPublications.selectionMode` / `latestPublication.selectionMode` (`featured-publications.ts:24-48`, `latest-publication.ts:23-37`) | latest/secondLatest/manual | no | GROQ-side only (product page passes the literal `"latest"`) | list (parity) |
| `featuredProducts.newProductsMode` (`featured-products.ts:41-55`) | automatic/manual | no | GROQ-side only | list (parity) |
| `settings.structuredData.priceRange` (`sch/documents/singletons/settings.ts:526-540`) | `$`…`$$$$` | no | Organization JSON-LD | list (JSON-LD should be published anyway) |
| `button.variant` (`sch/definitions/button.ts:17-26`) | primary/secondary | **yes** (`variant`) | `ui/Button/Button.tsx:48` | none |
| `customUrl.type` (`sch/definitions/custom-url.ts:30-41`) | internal/external | **yes** | GROQ `select()` | none |
| `ptImage.layout` (`sch/portableText/image.ts:14-25`) | single/double | **yes** (`layout`) | `portableText/Image/index.tsx:19` | none |
| `review.destinationType` (`review.tsx:44-58`) | page/pdf/external | **yes** (`/type/i`) | GROQ `select()` | none |
| `cpoProduct.productType` (`cpo-product.tsx:215-240`) | internal/external | **yes** | `ui/CpoProductCard/index.tsx:157` | none |
| `customFilterDefinition.filterType` (`sch/definitions/custom-filter-definition.ts:18-31`) | dropdown/range | **yes** | `products/CustomFiltersBar/index.tsx:131,136,331,339,418,493`; `global/utils.ts:745` | none |
| `blog-article.authorType` (`blog-article.ts:128-143`) | internal/external | **yes** | GROQ `select()` | none |
| hidden constants: `ptHeading.level` (`sch/portableText/heading.ts:16-24`), `style` on `ptTwoColumnLine` / `ptHorizontalLine` / `ptPageBreak` / `contentBlockHorizontalLine` (`two-column-line.ts:12`, `horizontal-line.ts:17`, `page-break.ts:13`, `sch/definitions/content-blocks.ts:187`) | h3 / fixed | no | not read by web (dispatch is on `_type`) | list `level`, `style` (zero display use; `style` on PT blocks is never encoded anyway) |

16 enum-ish fields: 7 vendor-covered, 9 to list (`level` and `style` included).

### 2.3 Logic strings (href / attribute / markup / map key / query param)

| Leaf | Source (schema) | Where it becomes logic (file:line) | Class |
|---|---|---|---|
| `tel` | `settings.tel` (`settings.ts:73`) | `pb/ContactMap/index.tsx:74` `href="tel:…"` | A |
| `customPhone` | `contactMap` (`sch/blocks/contact-map.ts:48`) | same `:74` | A |
| `customEmail` | `contactMap` (`contact-map.ts:56`) | `pb/ContactMap/index.tsx:85` `mailto:` | A |
| `phoneNumber` | `teamMember` (`team-member.ts:44`), `phoneImageCta` (`phone-image-cta.ts:67`), `settings.cartSupportCard` (`settings.ts:439`) | `ui/PhoneLink/index.tsx:6`, `ui/ContactPerson/index.tsx:21`, `b2c/shared/SupportCard.tsx:26,34` (also `aria-label`) | A |
| `phone` | `store` (`store.ts:56`) | `ui/StoreLocations/index.tsx:270`, `StoreMap.tsx:142` `tel:` | A |
| `iconString` | `socialMedia` (`social-media.ts:46`) | `ui/Footer/index.tsx:30` `dangerouslySetInnerHTML` (inline SVG markup) | A |
| `gtm_id`, `ga4_id`, `googleAds_id` | `settings.analytics` (`settings.ts:334-358`) | `app/layout.tsx:58`, `components/shared/CookieConsent/CookieConsent.tsx:84-86` (script config). Not skipped because `_id` ≠ `Id` | A (analytics should not mount in draft, but list anyway) |
| `metaConversionToken` | `settings.analytics` (`settings.ts:377`) | server CAPI | A (defensive) |
| `altText` | `sanity.imageAsset` via `"alt": asset->altText` (`q:11`, `q:35`, `q:1267`) | `components/shared/Image.tsx:172` `alt` | A |
| `alt` | `ptInlineImage.alt` (`inline-image.ts:40`), `youtubeVideo.image.alt` (`youtube-video.ts:53`) | `portableText/InlineImage/index.tsx:41` | A |
| `filterName`, `value` | `product.customFilterValues[]` (`product.ts:570,579`) | `q:1794` → `global/filters/computeFilters.ts` (Map keys / matching) and GROQ `$customFilters` params | A |
| `name` **under `customFilters[]`** | `customFilterDefinition.name` (`custom-filter-definition.ts:11`) | `global/utils.ts:747,753` (`filterName: filter.name` → `computedBounds.get(rf.filterName)` at `:771`); `products/ProductsListing/index.tsx:116,135` → GROQ params | A, but the leaf `name` collides → subtree rule (§2.5) |
| `denormBrandSlug`, `denormBrandName`, `denormCategorySlugs`, `denormParentCategorySlugs`, `denormFilterKeys` | `product.ts:490-538` (hidden, readOnly) | `q:1788-1792` (filter metadata): `brandSlug`/`categorySlug`/`allCategorySlugs` drive brand/category filter matching and `?brands=` params. `denormLastSync` is a datetime (vendor skip). Primitive-array members have the index as leaf, so match `sourcePath.at(-2)`. | A |
| `brandName` (CPO) | `cpoProduct.brandName` (`cpo-product.tsx:197`) | cart-line snapshot `components/cpo/CpoProductHero/CpoProductInquirySection.tsx:84,107`; `alt` in `ProductInquiryModal/ProductSummary.tsx:50,85` | A (B2C), **collision** (display) → `stegaClean` at the snapshot |
| `keywords` (members) | `blog-article.keywords` | `components/schema/BlogPostSchema.tsx:122` JSON-LD | A (defensive; parent-name match) |
| `supportEmails`, `b2cTransactionalEmailCopyRecipients` (members) | settings | server email routing (`app/api/contact/route.ts:114,416`) | A (defensive; these paths should never be stega-on) |

Not CMS (no action): every `customId`/`id=` (hardcoded in `app/produkty/[slug]/page.tsx:271-342`, `app/marki/[slug]/page.tsx:313-366`, `app/certyfikowany-sprzet-uzywany/[slug]/page.tsx:236-248`), `PillsStickyNav` ids, `HeaderUtilityLinks`/`HeaderQuickActions` ids. Heading anchor ids (`portableText/index.tsx:135-200`, `addHeadingIds`) go through `convertToSlug` (`global/utils.ts:46-55`, `remove: /[^a-zA-Z0-9 ]/g`), which strips stega characters. Safe by construction; worth one unit test.

### 2.4 Fetches better switched to `stega: false` wholesale (no overlay value, logic-heavy)

Each of these is query-derived data where overlays are meaningless and where stega would break matching. Run them with the draft perspective but `stega: false`, rather than relying on leaf names:
- `queryAllProductsFilterMetadata` (`q:1776`; callers `app/produkty/(listing)/page.tsx`, `kategoria/[category]/page.tsx`, `app/marki/[slug]/page.tsx`, `pb/ProductsListing/index.tsx`, `products/ProductsListing/index.tsx`)
- `queryCpoProductsFilterMetadata` (`q:1194`)
- `queryCategoryMetadata` (`q:2314`)
- the products/CPO listing queries (`getProductsListingQuery`, `getCpoProductsListingQuery`)
- `querySettings` when consumed by `CookieConsent`/`layout` analytics
- every B2C/cart/quick-add/checkout read (`app/actions/product-quick-add.ts`, `global/b2c/**`)

The leaf entries in §2.5 stay as defence in depth.

### 2.5 Proposed filter

```ts
// apps/web/src/global/sanity/client.ts — draft-only; base client keeps stega.enabled=false
// Rule (Najbar client.ts:37-40): any options.list field, any string that reaches an href,
// a data-*/class/id attribute, inline markup, a Map key, a GROQ param or assistive tech.
// The filter matches the SOURCE path; a primitive-array member is matched by its parent name.
export const STEGA_LOGIC_ONLY_FIELDS = new Set([
  // enums not covered by the vendor default
  'displayMode', 'float', 'availabilityStatus', 'brandsDisplayMode',
  'selectionMode', 'newProductsMode', 'priceRange', 'level', 'style',
  // contact → tel:/mailto: hrefs
  'tel', 'phone', 'phoneNumber', 'customPhone', 'customEmail',
  // markup / scripts / a11y attributes
  'iconString', 'gtm_id', 'ga4_id', 'googleAds_id', 'metaConversionToken',
  'alt', 'altText',
  // filters + denormalized logic values
  'filterName', 'value',
  'denormBrandSlug', 'denormBrandName', 'denormCategorySlugs',
  'denormParentCategorySlugs', 'denormFilterKeys',
  // primitive arrays (matched via sourcePath.at(-2))
  'keywords', 'supportEmails', 'b2cTransactionalEmailCopyRecipients',
]);
// Subtrees where EVERY string is logic (checked with sourcePath.includes(...)):
export const STEGA_LOGIC_ONLY_PARENTS = new Set([
  'customFilters',       // productCategorySub filter definitions: name → URL slug, Map key, GROQ param
  'customFilterValues',  // product filter values
  'analytics',           // settings.analytics ids/tokens
]);
```

That is 31 leaf names plus 3 parents, a little over Najbar's 10 and well under lsse's ~104. Justifications are in §2.2–2.3. Notes:
- `'value'` and `'style'` are generic. Today they occur only in `customFilterValues[].value` and the hidden style constants, and are never display copy. Re-check when a schema adds either name.
- `phone`/`phoneNumber`/`tel` are also **displayed** (`ui/ContactPerson/index.tsx:27`, `ui/PhoneLink/index.tsx:12`, team cards). Listing them costs click-to-edit on phone text. The alternative is `stegaClean` at the 6 `tel:` sites (§2.3). Recommendation: list them; low editor value, fewer call sites.
- `alt` is matched as a leaf, so the `alt` text of `youtubeVideo.image` loses its overlay too. Fine.

### 2.6 Leaf-name collisions: `stegaClean` at the render site instead of the filter

`name` and `title` are display copy almost everywhere (products, brands, team, filters, awards). They cannot be filtered, so clean them where they reach an attribute, logic or the B2C boundary:

| File:line | Expression | Why |
|---|---|---|
| `pb/BrandsList/index.tsx:44`, `:49` | `aria-label={\`Przejdź do marki ${brand?.name}\`}`, `alt={brand?.name}` | attribute (but `select()` → untraced today; clean anyway, the manual branch may change) |
| `pb/BrandsMarquee/BrandMarqueeList.tsx:47`, `:69` | aria-label / alt from `brand.name` | attribute |
| `pb/HeroCarousel/BrandMarquee.tsx:35`, `:40` | same | attribute |
| `ui/Footer/index.tsx:31` | `aria-label={\`Odwiedź nasz ${socialMedia.name}\`}` | attribute |
| `products/ProductHero/AwardItem.tsx:128` | `alt={award.name \|\| …}` | attribute |
| `ui/ProductCard/ProductCardAddToCart.tsx:183-200` | `aria-label` + confirmation product `name`/`brandName` | attribute + cart UI |
| `ui/ProductCard/AddToComparisonButton.tsx:96-99` | aria-label from product name; categories → comparison cookie (`global/comparison/cookie-manager.ts:39-55` persists `categoryNames`) | attribute + persisted cookie |
| `products/RangeFilter/index.tsx:204,216,232,246`; `CustomFiltersBar/index.tsx:599` | `aria-label={\`${name} …\`}`, `name={def.name}` | attribute (covered if the `customFilters` parent rule is adopted) |
| `products/ProductHero/PricingSection.tsx:132-133,160-161,222-223` | cart line `name`/`brandName` from page props | **B2C**: cart → checkout → Supabase order |
| `components/cpo/CpoProductHero/CpoProductInquirySection.tsx:83-84,107,164-165` | CPO cart line / inquiry payload | **B2C** |
| `products/ProductInquiryModal/ProductSummary.tsx:50,85` | `alt={\`${brandName} ${name}\`}` | attribute |
| `components/shared/analytics/ProductViewTracker.tsx:33,51` (+ props at `app/produkty/[slug]/page.tsx:224-232`) | `productName`, `brand.name`, category slugs → dataLayer | analytics payload. Better: don't mount the tracker in draft |
| `pb/FaqSection/index.tsx:36` → `components/schema/FaqSchema.tsx:24` | FAQ question/answer from **block data** into JSON-LD | JSON-LD in draft. `ArticleSchema` (`app/recenzje/[slug]/page.tsx:95`), `BlogPostSchema` (`app/blog/[slug]/page.tsx:102`), `BrandSchema` (`app/marki/[slug]/page.tsx:230`) and `BreadcrumbsSchema` (`ui/Breadcrumbs/index.tsx:34`, product/brand names) are also fed from the **page's draft fetch**, not a published one. Fix centrally: `stegaClean()` the JSON-LD object in one emitter. |

React `key`s built from stega'd text (`ui/Footer/index.tsx:26,38,45`, `pb/ContactForm/index.tsx:97`) are harmless (stable per render) and need no change.

---

## 3. Emptiness predicates on CMS strings (class B)

Stega only encodes **non-empty-looking stored strings**. A field cleared in the Studio is usually *unset* (→ `undefined`, no stega), so class B bites mainly on values stored as `""` or whitespace. Those come from imports: the CPO Excel import, the YouTube importer, and migrations. Zero-width characters are not `\s`, so `.trim()` doesn't remove them. `PortableText` array checks (`?.length`, `value &&`) are safe: empty PT stays `[]`.

| File:line | Predicate | Field | Notes / fix |
|---|---|---|---|
| `apps/web/src/components/products/ProductHero/index.tsx:75` | `headingOverride?.upper?.trim() \|\| brand?.name?.trim()` | `headingOverride.upper` | whitespace-only override wins over the brand name in draft → `hasText()` |
| `products/ProductHero/index.tsx:76` | `headingOverride?.lower?.trim() \|\| name.trim()` | `headingOverride.lower` | same |
| `products/ProductHero/index.tsx:113` | `{subtitle && …}` | `product.subtitle` | `hasText` |
| `components/cpo/CpoProductHero/index.tsx:43` | `name?.trim() \|\| ''` | `cpoProduct.name` | Excel-imported |
| `components/cpo/CpoProductHero/index.tsx:97` | `brand?.name ? … :` | brand name | |
| `ui/ProductCard/index.tsx:64` | `{brandName && \`${brandName} \`}` | `brand.name` | |
| `ui/CpoProductCard/index.tsx:182` | `brandName ? … : null` | `cpoProduct.brandName` | Excel-imported, likely `""` |
| `products/ProductInquiryModal/ProductSummary.tsx:55` | `product.brandName &&` | CPO `brandName` | |
| `ui/StoreLocations/index.tsx:278`; `StoreMap.tsx:149` | `store.website &&` | `store.website` | vendor skips `website`, so **safe** |
| `ui/StoreLocations/StoreMap.tsx:139` | `store.phone &&` | `store.phone` | safe once `phone` is listed |
| `pb/ContactMap/index.tsx:72`, `:83` | `displayPhone &&`, `displayEmail &&` | `customPhone`/`tel`, `customEmail` | safe once listed (`settings.email` is vendor-skipped) |
| `ui/Button/Button.tsx:117` | `text \|\| children` | `button.text` | `""` text → empty-looking button in draft |
| `ui/ContentBlocks/YoutubeBlock.tsx:51`, `:60` | `title \|\| null`, `if (!title)` → oEmbed fetch | `contentBlockYoutube.title` | stega'd `""` suppresses the oEmbed title fallback |
| `ui/ContentBlocks/VimeoBlock.tsx:36`, `:49` | same | `contentBlockVimeo.title` | same |
| `portableText/YouTubeVideo/index.tsx:97` | `title \|\| (await fetchYouTubeTitle(…))` | `ptYoutubeVideo.title` | same |
| `portableText/VimeoVideo/index.tsx` (`fetchVimeoTitle` fallback, `:34`) | same pattern | `ptVimeoVideo.title` | same |
| `products/ProductHero/AwardItem.tsx:109`, `:128` | `award.name &&`, `award.name \|\| 'Nagroda produktu'` | `award.name` | |
| `products/TechnicalData/index.tsx:219` | `hasMultipleGroups && group.title &&` | `technicalDataGroup.title` | |
| `products/DownloadSection/index.tsx:56` | `pdf.description &&` | `pdfItem.description` | |
| `pb/BrandsMarquee/BrandSelector.tsx:98` | `!brand?.name \|\| …` | `brand.name` | |
| `pb/HeroCarousel/BrandMarquee.tsx:40`; `pb/BrandsMarquee/BrandMarqueeList.tsx:69`; `pb/BrandsList/index.tsx:49` | `alt={brand.name \|\| …}` | `brand.name` | fallback never fires; also an attribute leak (§2.6) |
| `components/schema/FaqSchema.tsx:24` | `.filter(faq => faq.question && faq.answer)` | `faq.question` | JSON-LD (§2.6) |
| `components/schema/ArticleSchema.tsx:67,83,87`; `BlogPostSchema.tsx:119` | `description &&`, `product?.name &&`, `category?.name &&` | various | JSON-LD |
| `components/shared/analytics/ProductViewTracker.tsx:33,51` | `brand?.name ? {brand} : {}` | `brand.name` | analytics |
| `products/CustomFiltersBar/index.tsx:514,563`; `RangeFilter/index.tsx:175,179,234,248` | `def.unit &&` / `unit &&` | `unit` | vendor-skipped → **safe** |
| `pb/ImageWithVideo/index.tsx:30` | `youtubeId &&` | `youtubeId` | `*Id` → **safe** |
| `portableText/ReviewEmbed/index.tsx:32` | `review.slug?.trim()` | `select()` result | untraced → **safe** |
| `app/produkty/[slug]/page.tsx:115-118`; `app/certyfikowany-sprzet-uzywany/[slug]/page.tsx:96-100` | `?.trim()` on SEO / brand / name | metadata | must use the published `sanityFetchMetadata` path (03 §6.1-5) → safe if done |

Recommendation: port lsse `utils/stega-text.ts` (`stripStega`, `hasText`). Apply it to the ~20 unsafe rows above and add the `emptiness-predicates.test.ts` gate with the safe rows allow-listed.

---

## 4. Custom Studio inputs and other patch emitters (audit suite F rows)

| # | Component (file:line) | Mounted on (doc type / field) | How it writes | Presentation-relevant behaviour to verify |
|---|---|---|---|---|
| F1 | `CustomInput` (`apps/studio/components/custom-input.tsx:16-25`) | `components.input` of **every** `customPortableText` field (`sch/portableText/index.ts:273-276`): all PT fields on all types | `renderDefault` (standard form patches); styling plus `initialActive: true` | Typing in a PT field refreshes the iframe; overlay click focuses the PT editor |
| F2 | `ProductHeadingInput` (`apps/studio/components/product-heading-input.tsx:11-71`) | `product.headingOverride` (`sch/documents/collections/product.ts:99`) | `renderDefault` + read-only preview (fetches brand with `perspective:'drafts'`) | `upper`/`lower` edits reflect live; preview matches the web `ProductHero:75-76` |
| F3 | `PathnameFieldComponent` (`apps/studio/components/slug-field-component.tsx:57`; `set`/`unset` at `:142-168`) | `components.field` via `defineSlugForDocument` (`apps/studio/components/define-slug-for-document.tsx:43-45`) on `page`, `homePage`, `blog`, `brands`, `products`, `privacyPolicy`, `termsAndConditions`, `cpoPage`, `product`, `productCategorySub`, `blog-category`, `brand`, `blog-article`; plus `review.slug`/`pdfSlug` (`review.tsx:94-101`, `:162-169`) and `cpoProduct.slug` (`cpo-product.tsx:269-272`) | `onChange(set({current,_type:'slug'}))` | class L (slug rename: preview stays on the old path), class G (unsaved slug → location null). `readOnly` in production once set, so the rename row is local-lane only |
| F4 | `YouTubeDocumentInput` (`apps/studio/components/youtube-document-input.tsx:86-110`) | document-level `components.input` of `youtubeVideo` (`sch/documents/collections/youtube-video.ts:13`) | async `PatchEvent` after oEmbed + `client.assets.upload`: sets `metadataVideoId`, `name`, `importedTitle`, `image{alt}`, `importedImageRef` | Paste a URL: title/thumbnail appear on publication blocks (`latestPublication`/`featuredPublications`; note the `select()`-untraced items) |
| F5 | `ProcessJsonButton` (`sch/documents/singletons/redirects.tsx:31-56`, mounted at `:222-235`) | `redirects.redirects` | `client.patch('drafts.redirects').set(...)` | no visual; out of scope (static location "Przekierowania") |
| F6 | `TechnicalDataView` (`apps/studio/components/technical-data-table/technical-data-view.tsx:645-674`) | view pane on `product` (`apps/studio/structure.ts:733`) and `cpoProduct` (`structure.ts:746`), field `technicalData` (hidden) | `client.transaction().patch('drafts.<id>').set({technicalData})` | edits must reflect in the `TechnicalData` table on the product page in Presentation (draft) |
| F7 | `ProductFiltersView` (`apps/studio/components/product-filters-view/product-filters-view.tsx:155-205`) | view pane on `product` (`structure.ts:737`), `customFilterValues` | `createIfNotExists(draft)` + `patch(draft).set` | listing filter values change in a draft listing (expect denorm staleness, 05 §8) |
| F8 | `CustomFiltersConfigView` → `saveToSanity` (`apps/studio/components/custom-filters-config/custom-filters-config-view.tsx:114-176`) | view pane on `productCategorySub` (`structure.ts:759`), `customFilters` | **patches the PUBLISHED doc directly** ("AUTO-PUBLISH", `:148-151`), plus the draft if present | expected behaviour, looks like a bug: changes go live immediately, even outside Presentation. Record as "by design" |
| F9 | `CustomFiltersConfigView` → `handleSaveProductValue` (`custom-filters-config-view.tsx:354-455`) | same pane, writes `product.customFilterValues` | **published** patch (`:440-443`) + draft sync | same as F8 |
| F10 | `ReviewAuthorManager` (`apps/studio/components/review-author-manager/index.tsx:199-203`, `:461-474`) | structure pane (`structure.ts:536`): `reviewAuthor.reviewCount`, `review.author` reassignment | `client.transaction` on ids from published-only queries (`!(_id in path("drafts.**"))`), `visibility:'sync'` | review pages show the new author live (published write); drafts of the same review are not updated |
| F11 | Comparator tool (`apps/studio/tools/comparator/index.tsx:692-732`, `:1074-1098`) | `comparatorConfig` create/patch; bulk `product.technicalData` param edits | `client.create` / `client.patch` / transaction on the ids it listed | `/porownaj/` is server-action-fed, so out of the Presentation lane |
| F12 | Bulk actions table (`apps/studio/plugins/bulk-actions-table/BulkActionsMenu/index.tsx:113-270`) | `product`, `brand`, `review`, `reviewAuthor` tables (`structure.ts:174,426,452,459`) | discard (delete drafts), unpublish, **publish via `createOrReplace` + delete draft** (`:215-220`), delete | bulk publish **bypasses** `wrapPublishWithDenorm`, so denorm fields stay stale for bulk-published products/reviews. Pre-existing; affects draft-vs-published listing parity |
| F13 | Publish wrapper `wrapPublishWithDenorm` (`apps/studio/actions/wrap-publish-with-denorm.ts:18-25`, `:103-105`; applied to `product`, `review` at `:143`) | document action | patches `drafts.<id>` with denorm fields (`visibility:'sync'`), then publishes | Publish from the Presentation document pane must still run the wrapper; listings update after publish |
| — | `CustomFilterValueInput` (`apps/studio/components/custom-filter-value-input.tsx:29`) | **dead**: imported nowhere (only a comment at `product.ts:594`) | `set`/`unset` | no row; candidate for deletion |

---

## 5. Orderable document lists (audit J stays out / blocked)

- `@sanity/orderable-document-list` desk lists, via `createCollection({ orderable: true })` → `orderableDocumentListDeskItem` (`apps/studio/structure.ts:139`):
  - **`brand`** (`structure.ts:434-441`, "Lista marek")
  - **`blog-category`** (`structure.ts:622-629`, "Kategorie bloga")
- `orderRankField` present (rank written at create, no drag UI except the two above):
  - `product` (`product.ts:484`), `productCategorySub` (`product-category-sub.ts:23`), `brand` (`brand.ts:24`), `blog-category` (`blog-category.ts:23`), `blog-article` (`blog-article.ts:25`), `review` (`review.tsx:35`), `reviewAuthor` (`review-author.ts:32`), `teamMember` (`team-member.ts:19`).
  - `award` and `productCategoryParent` have `orderRankOrdering` only (no field; `award.ts:10`, `product-category-parent.ts:13`).
- Web consumers of `orderRank` (16 occurrences in `q:`):
  - `brandsList` manual + all branch (`q:752-760`)
  - products listing `orderRank asc` (`getProductsListingQuery('orderRank')`)
  - category ordering in filter metadata (`q:1800`)
  - brands by parent category (`q:816`)
  - blog categories (`queryBlogPageContent` `order(orderRank)`)
- The orderable list writes `orderRank` straight to **published** documents. Reordering brands therefore changes `brandsList` and `/marki/` order live, outside draft. Keep J out of scope (03 §6.2).

## 6. Image helper consumers (audit class I)

The shared helper is `apps/web/src/components/shared/Image.tsx` (49 importers). It forwards `crop` and `hotspot` into `urlFor().fit('crop')` (`:140-158`). Bypasses:

| File:line | What it does | Hotspot/crop forwarded? | Notes |
|---|---|---|---|
| `pb/HeroCarousel/HeroCarousel.tsx:170-262` (`urlFor` at `:183,191,233,241`; `<img>` `:293,317`) | art-directed desktop 2120×823 / mobile crops for current and previous slide | **yes** (`:176-180`) | `'use client'`. The `<img>` has `alt=""` and needs an explicit `data-sanity` for `slides[_key==…].image` (after the `_key` reprojection) |
| `pb/HeroStatic/index.tsx:23-73` (`urlFor` `:38,46`; `<img>` `:110`) | same art direction | **yes** (`:27-35`) | explicit `data-sanity` → `image` |
| `pb/BrandsMarquee/index.tsx:20-67` (`urlFor` `:34,42`; `<img>` `:79`) | background art direction | **yes** (`:23-31`) | |
| `pb/NotFound/index.tsx:16-26` | CSS background URL 500×282 | **yes** (`:18-19`) | rendered as a background (no `<img>`), so the overlay goes on the wrapper; 404 is published-pinned |
| `ui/ContentBlocks/YoutubeBlock.tsx:3`, `VimeoBlock.tsx:3`; `portableText/YouTubeVideo/index.tsx:120`, `VimeoVideo/index.tsx:110` | `next/image` for **external** YouTube/Vimeo thumbnails only (CMS `thumbnail` goes through the helper) | n/a | not Sanity assets |
| `components/shared/PublicationImage.tsx:24` | `next/image` static fallback | n/a | not a Sanity asset |
| SVG icons via `icon.asset->url` (`q:503`, `q:583`, `q:161`) inlined by `svgToInlineString` (`pb/HeroStatic/index.tsx:80`, `pb/ImageWithTextBoxes/index.tsx:24`, `portableText/Heading`) | raw SVG markup | n/a (SVG, no crop) | the inline `<svg>` carries no stega (`url` vendor-skipped); needs explicit `data-sanity` if click-to-edit on icons is wanted |

The class-I risk is low: all four bypasses forward hotspot/crop. The real gap is overlays. Stega never reaches images, so every image that should be click-to-edit needs an explicit `data-sanity` (helper or bypass). Adding an optional `dataSanity` prop to `shared/Image.tsx` covers 49 importers at once.

## 7. Other findings worth carrying into the plan

- `faqSection` and `contactForm` project `*[_type == "newsletterSettings"][0]` (`q:848`, `q:880`). That type does not exist (it is `settings.contactSettings`), so the projection is always `null`. It is dead, but it adds noise to "used on" panels if anyone builds them from queries.
- `teamSection` projects `variant` (`q:906`), which is not in the schema. Harmless.
- Product, brand and category-content queries lack `_type` (§0). `blog-category` `categoryContent` lacks it too.
- The PageBuilder wrapper must stay a server component. `OptimisticBlocks` should not use `next/dynamic({ssr:false})` (03 §2.2). Reorder affects `effectiveIndex` (H1 vs H2) correctly, because the index is recomputed per render.
