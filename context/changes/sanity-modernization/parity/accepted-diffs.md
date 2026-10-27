# Accepted parity diffs

Intentional or explained differences between a phase's crawl and `baseline/` (captured at `347555f`, built with `VERCEL_ENV=preview`). Each entry names the phase, the paths, the reason and how it was checked.

## Phase 4 — three-layer routes, layout, prerender-all

Gate run: `VERCEL_ENV=production VERCEL_PROJECT_PRODUCTION_URL=audiofast.pl P24_MODE=production E2E_DISABLE_ANALYTICS=1 bun run build --force`, then `next start -p 3107` with the same env, then `bun run check:parity --compare parity/baseline`. Result: 1,125 URLs, all 200, 39 paths differ. All 39 are explained below; none is a content loss.

### 1. Main content now server-rendered on `/`, `/marki/`, `/o-nas/` (3 paths, improvement)

- **What differs:** `words` (only additions: +1,036, +417, +737 words), `jsonLd` (page-level blocks added: `FAQPage` on `/`; `CollectionPage` + `BreadcrumbList` on `/marki/`; `BreadcrumbList` + `FAQPage` on `/o-nas/`), and `ssrErrors` (two `client-render digest=""` entries in the baseline, none now).
- **Why:** the README's "known state" item. Fully static pages that render the contact form client-rendered their whole page body: `ContactForm` (and the FAQ / product-inquiry forms) called `Date.now()` during render (`useRef(Date.now())`). Under Cache Components a Client Component reading the clock during a static prerender aborts the boundary, and React falls back to client rendering. Phase 4 made `/certyfikowany-sprzet-uzywany/` fully static too, which exposed the same failure there, so the timestamp moved to a mount effect. The page bodies, and their JSON-LD, are now in the server HTML.
- **Check:** `.next/server/app/{index,marki,certyfikowany-sprzet-uzywany}.html` contain `<main>` and zero `$RX(` fallbacks.

### 2. Word joins around inline markup on 35 product, review and blog pages (environment artifact)

- **Paths:** `/blog/dcs-bartok-i-rossini-z-firmware-30-nowe-mozliwosci-brzmienia-i-obsluga-dsdx4/`, 20 `/produkty/<slug>/` pages (`acoustic-diode`, `alexia-v`, `altaira-x`, `apex`, `black-diamond-dlc`, `diablo-300-dac`, `eos-5`, `evo-100-phono-preamplifier`, `ex-8`, `foundation-rack`, `galileo-discovery-ac`, `omega-x-ic`, `omega-x-phono`, `osiris-rack`, `ref10-nano`, `relentless-epic-1600`, `roon`, `varese`, `vibratron-sx`, `vip-ic`) and 14 `/recenzje/<slug>/` pages (full list in the run's `diff.json`).
- **What differs:** only tokenisation. The same characters split differently around inline elements, for example `. V` (baseline) against `V.` (now), or `brzmienia. Mapper` against `brzmienia.Mapper`. Every diff is +n/−2n of the same characters; no word appears or disappears.
- **Why:** the Phase 4 gate builds with `VERCEL_ENV=production` (it has to, to prerender every slug), while the baseline was built with `VERCEL_ENV=preview`. Production mode changes the base URL, so the Portable Text link and markup output around these spots differs.
- **Check:** for all 35 paths in this group, the word bag of the live `https://audiofast.pl` page (still on the Phase 3 code) equals the Phase 4 crawl exactly. It is not content drift either: the sampled documents (`apex`, `eos-5`, `roon`, the DCS blog article) were last edited between 2026-09-25 and 2026-10-19, and the dataset has no content writes after 2026-10-27T07:30Z, before the baseline crawl finished.

### 3. `/produkty/?search=wzmacniacz` — skeleton placeholder gone (1 path)

- **What differs:** `words` removed `···` ×2.
- **Why:** `···` is placeholder text inside the listing's loading skeleton (`ProductsListingSkeleton`), which the old final HTML still carried. The listing is now a pass-through Suspense slot resolved in the same render pass, so the fallback markup is no longer left in the document. The listed products and their count are unchanged.

## Phase 5 — query efficiency

Gate run: the same build and start command as Phase 4 (`next start -p 3107`), then `bun run check:parity --compare parity/baseline`. Result: 1,125 URLs, all 200, 39 paths differ. The run's `diff.json` is byte-identical to the Phase 4 gate run's (`runs/2026-10-27T08-37-38-747Z`), so every diff is one of the Phase 4 entries above and Phase 5 adds none. The keyed reference derefs, the explicit page-builder projections and the filter-metadata changes leave the published HTML unchanged.

## Phase 8 — Presentation (web): draft mode, stega, overlays, B2C isolation

Gate run: the same build and start command as Phase 4 (`next start -p 3107`), then `bun run check:parity --compare parity/baseline` (`runs/2026-10-27T10-31-17-391Z`). Result: 1,125 URLs, all 200, 40 paths differ. 39 of them are byte-identical entries to the Phase 5 gate run's `diff.json` (`runs/2026-10-27T09-11-04-140Z`), so they are the Phase 4 entries above. Phase 8's code adds none: the PageBuilder wrapper is a keyed Fragment outside draft mode, and the published HTML carries no `data-sanity` (0 on every crawled page) and no stega markers.

### 4. `/produkty/master-kio/` — editor publish during the run (content drift, 1 path)

- **What differs:** `title` (`Artesania Audio Master Kio` → `Artesania Audio Master Kio – Referencyjny stolik Hi-End`) and `description` (site default → a product-specific description).
- **Why:** an editor set the product's SEO title and description. `product-542` has `_updatedAt` 2026-10-27T10:06:48Z, after the baseline crawl and before this run.
- **Check:** the live `https://audiofast.pl/produkty/master-kio/` (still on the Phase 7 code) serves the same new `<title>`.

## Phase 9 — drag-and-drop (lsse level)

Gate run: the same build and start command as Phase 4 (`next start -p 3107`), then `bun run check:parity --compare parity/baseline` (`runs/2026-10-27T10-53-28-193Z`). Result: 1,125 URLs, all 200, 40 paths differ. The run's `diff.json` is byte-identical to the Phase 8 gate run's (`runs/2026-10-27T10-31-17-391Z`), so every diff is one of the entries above and Phase 9 adds none. Every new annotation is draft-gated and the optimistic layer mounts in draft mode only, so the published HTML is unchanged (0 `data-sanity` on `/`, `/produkty/apex/`, `/marki/`, `/o-nas/`, `/blog/` and the 404).

## Phase 11 — page query latency fix

Gate run: the same build and start command as Phase 4 (`next start -p 3107`), then `bun run check:parity --compare parity/baseline` (`runs/2026-10-27T15-37-48-947Z`). Result: 1,125 URLs, all 200, 40 paths differ. The run's `diff.json` is byte-identical to the Phase 9 gate run's (`runs/2026-10-27T10-53-28-193Z`), so the fix adds no diff. The page-builder windows return the same documents in the same order (checked directly against the old query on the live dataset), and the brands-by-categories guard only stops the subquery from running for pages that do not hold the block.
