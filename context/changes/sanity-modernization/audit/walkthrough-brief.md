# Presentation walkthrough — brief (sanity-modernization, Phase 11)

Everything the executor needs to run the audit without asking. Ported from the lsse-www walkthrough (`lsse/lsse-www/context/archive/2026-09-04-presentation-walkthrough/`), trimmed per research/03 §6.4 and decisions D4/D8/P9/P10. The executable catalogue is [test-plan.md](test-plan.md); the run contract is [walkthrough/README.md](walkthrough/README.md) and [walkthrough/loop.md](walkthrough/loop.md).

## 1. Rig

### 1.1 Rig table

Every row needs a **Verified** value at the freeze of each run. An empty cell makes the rows that depend on it BLOCKED. Preflight values (2026-10-27) are in [walkthrough/preflight-2026-10-27/](walkthrough/preflight-2026-10-27/).

| Item                     | Expected                                                                                 | Verified (preflight 2026-10-27)                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Studio             | `http://localhost:3333` (`bun run dev` in `apps/studio`), HEAD SHA                       | servers not running at preflight; the executor starts them only when the ports are free                                                              |
| Local web                | `http://localhost:3000` (`bun run dev` in `apps/web`)                                    | same                                                                                                                                                 |
| Deployed Studio          | `https://audiofast.sanity.studio`, app id `dlwt2zhgkk7rjx6dj8rdyjfz`                     | deployed in Phase 8 (`b207dfc`)                                                                                                                      |
| Previewed production     | `https://audiofast.pl`, SHA from `vercel inspect`                                        | `fe6f351` (Phase 10)                                                                                                                                 |
| `PRESENTATION_ORIGINS`   | `http://localhost:3000`, `https://audiofast.pl` (`apps/studio/presentation/settings.ts`) | yes                                                                                                                                                  |
| CORS with credentials    | `access-control-allow-credentials: true` for both origins                                | yes for `http://localhost:3000`, `https://audiofast.pl`, `http://localhost:3333`, `https://audiofast.sanity.studio` (`evidence: preflight/cors.txt`) |
| Share access             | `count(*[_id=="sanity-preview-url-secret.share-access"]) == 1`                           | 1                                                                                                                                                    |
| Tokens (presence only)   | `SANITY_AUTH_TOKEN`, `SANITY_API_READ_TOKEN` in `apps/web/.env.local`                    | present                                                                                                                                              |
| Browser                  | Chrome + Claude in Chrome, signed in to `audiofast.sanity.studio`                        | **not connected at preflight** (see §7)                                                                                                              |
| Versions                 | `next` 16.4.3, `next-sanity` ^13.4, `sanity` ^6.20                                       | yes                                                                                                                                                  |
| Pending drafts at freeze | the raw count; any draft on a fixture = read-only                                        | 133 at preflight                                                                                                                                     |

### 1.2 Baseline table

Frozen per run by the GROQ in §8.2 (the freeze read is the baseline, not this table). Preflight values:

| Fixture          | `_id`                                  | URL                                                                                                             | `_rev` at preflight      | Draft existed? |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------- |
| QA page          | `qa-presentation`                      | `/qa-presentation/`                                                                                             | seeded 2026-10-27        | no             |
| Homepage         | `homePage`                             | `/`                                                                                                             | `p5zN8tc5qJzIMnoOFEoYYu` | no             |
| Navbar           | `navbar`                               | chrome                                                                                                          | `f0Su6FTlHvSQMSplV0OB4o` | no             |
| Footer           | `footer`                               | chrome                                                                                                          | `GQ8uPE162k1OK1zMbvpMxq` | no             |
| Settings         | `settings`                             | chrome                                                                                                          | `6LbxA4c5p2VL183Rwbj4AY` | no             |
| Product          | `product-130`                          | `/produkty/triton-two/`                                                                                         | `nuGTdZLrlZy0BbgxbO6zR0` | no             |
| Brand            | `440dafbd-9f7d-4f29-a290-6fd01964378c` | `/marki/synergistic-research/`                                                                                  | `5wuN3TqTIFgKliUjbNAUsk` | no             |
| Blog article     | `1f63efc2-5759-48c9-a735-b446a956ac62` | `/blog/dcs-bartok-i-rossini-z-firmware-30-nowe-mozliwosci-brzmienia-i-obsluga-dsdx4/`                           | `runUBEz4s7d1MPyK8thBWK` | no             |
| Review           | `01618d8a-572e-4092-b897-55a6ca319d77` | `/recenzje/recenzja-wzmacniacza-monofonicznego-dan-dagostino-momentum-z-mono-amplifier-w-part-time-audiophile/` | `mP75QonLwGFvqzIo5VDTPj` | no             |
| Product category | `1e0f5761-34d3-dfc5-aff7-9547062b1742` | `/produkty/kategoria/przetworniki-dac/`                                                                         | `XNQh23oop7n7SfU9ADm7fi` | no             |
| FAQ (on QA page) | `0c2ca645-6b1e-41dc-bdeb-678b3abe78bc` | referenced                                                                                                      | `QX7MXRkJXxZXLDPNds2X4o` | no             |
| Unused store     | `2e39534e-f745-8f2f-9ed8-9c20744bfef4` | referenced-only, no referrer                                                                                    | `9VPhhnugJeDadNDy1DM0ag` | no             |

Read-only at preflight (pre-existing drafts): `brands` singleton, `product-129`, `cpo-keces-ephono-plus`, award `5291bc49-…`. No CPO product is draft-safe, so CPO rows use read-only observation only.

## 2. Lanes

| Lane    | Rig                                      | Proves                                                                                                                                                                 |
| ------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[L]** | local Studio `:3333` → `localhost:3000`  | overlays, click-to-edit, drag, optimistic reorder, stega regressions, custom inputs, locations, perspective switch, live refresh; fixes retest in seconds              |
| **[D]** | deployed Studio → `https://audiofast.pl` | the shipped Studio bundle, the inlined preview URL, CORS with credentials, the share link, consent/analytics suppression (production only: `IS_PRODUCTION_DEPLOYMENT`) |
| [S]     | Safari on [D]                            | **deferred (D8)**: the CHIPS-partitioned cookie. Row A7 is not in the catalogue.                                                                                       |

Order: [L] first, then [D]. Every [L] fix is committed; the phase-end push + `sanity deploy` ships the verified bundle, then [D] runs.

## 3. Fixtures

- **QA page** `qa-presentation` (`apps/studio/seeds/qa-presentation.json`, applied with `apps/studio/scripts/seed/apply-qa-presentation.ts`, dry run by default). Published, `doNotIndex: true` (not in `sitemap.xml`; `page` documents appear in no listing). 20 blocks — every page-builder block allowed on `page` (all except `cpoProductsListing`), copied from real published blocks and re-keyed `qa-<block>-<n>` (block) / `qa-<block>-1-<n>` (nested). `contactForm.accountList` was duplicated to reach two items; `productsCarousel` (no instance in the dataset) is authored from five bestseller references.
- **The id has no dot.** It was first seeded as `page.qa-presentation` (the lsse id). Ids containing `.` are not publicly readable, and the web's published reads go through the unauthenticated API CDN, so production rendered the page as a 404 (`s1:` sync tags returned, result `null`). The fixture was re-seeded as `qa-presentation` and the dotted document deleted (preflight evidence `qa-id-dot.txt`).
- Block keys in order: `qa-hero-static-1`, `qa-hero-carousel-1`, `qa-latest-publication-1`, `qa-image-text-columns-1`, `qa-featured-publications-1`, `qa-featured-products-1`, `qa-products-carousel-1`, `qa-brands-marquee-1`, `qa-brands-list-1`, `qa-brands-by-categories-section-1`, `qa-faq-section-1`, `qa-contact-form-1`, `qa-contact-map-1`, `qa-image-with-video-1`, `qa-image-with-text-boxes-1`, `qa-blur-lines-text-image-1`, `qa-gallery-section-1`, `qa-team-section-1`, `qa-phone-image-cta-1`, `qa-step-list-1`.
- **Known fixture gaps** (rows that depend on them are fixture-BLOCKED, not FAIL): portable-text headings are single paragraphs (PT arrays are not draggable anyway); `cpoProductsListing` is CPO-page-only; no draft-safe CPO product.
- The QA page stays as a standing fixture after the audit (decision recorded in [test-plan.md](test-plan.md) §7): it is hidden and the next audit reuses it.

## 4. Catalogue skeleton

Suites P, A, B, C, D, E, F, G, H, I (lsse) plus **K — B2C isolation** (audiofast). Dropped per D4/D8: A7 (Safari), B2 as a separate row (folded into C rows), B5 (inherited sections), C2–C7 lsse variants (rewritten for audiofast arrays), D1–D4 (accent/height), E2 (locale), E5 (deleted singleton), J1 (orderable list writes published `orderRank`; forbidden in a draft-only run).

## 5. Expected behaviours that look like bugs

- `coalesce()`, string concatenation and most `select()` results carry no source map: no overlay, no stega. Arrays fed by `select()` are not draggable ([presentation-arrays.md](../presentation-arrays.md)).
- Metadata, sitemap, JSON-LD, the 404 document and organisation schema stay **published** in draft sessions.
- Draft listings (`/produkty/`, category pages, brand product grids) show **published denorm data** (`denormBrandName`, `denormCategorySlugs`): the denorm Function runs on publish only.
- **Purchase is disabled in draft mode (P10):** „Dodaj do koszyka” is disabled with the note „Zakup niedostępny w podglądzie”; quick-add on product cards is disabled. Cart, checkout, account and thank-you routes ignore draft mode.
- `StoreLocations` renders the store list without geocoding/map in draft mode; „Ładowanie mapy...” exists only in published HTML.
- Consent banner and analytics mount only on production and only when not in draft; on localhost they never mount.
- Mutation refresh runs twice (the second ~1 s later). Poll ≥3 s after the comlink handshake; the first dev compile can take 20 s.
- `PreviewBar` renders only in a top-level draft tab, never inside the Presentation iframe. The plain „Otwórz podgląd” URL in a new tab does not carry drafts; the share link does.
- Click-to-edit from a plain draft tab opens the deployed Studio (`NEXT_PUBLIC_SANITY_STUDIO_URL`); inside Presentation it uses comlink.
- `useOptimistic` is inert outside the iframe; touch drag is unsupported.
- Clicks on links inside annotated elements are suppressed in Presentation (accordions do not open on click).
- A slug rename: preview follows only once the slug is saved in the displayed perspective (`slug-preview-navigation.tsx`). E9 records the behaviour.
- `CustomFiltersConfigView` and `ReviewAuthorManager` write drafts (Phase 7); a published listing does not change until publish.

## 6. Surfaces and prompt template

- **Clean draft tab** (`/api/draft-mode/enable/?sanity-preview-secret=…` or the share link): PreviewBar, DOM probes, cookies, `window.__stegaReports`.
- **Studio pane** (`/presentation?preview=<path>`): edits, perspective switch, document actions, locations panel, drag.
- **Iframe DOM**: the preview iframe is cross-origin to the Studio; read it from a tab opened on the previewed origin, or with `javascript_tool` on the iframe URL, never by screenshot alone.
- **CLI + GROQ** (`perspective: 'raw'`): `_key` order, `_rev`, cleanup, tests, crawler.

Prompt per phase:

> Run scenarios <IDs> — phase k. Re-anchor: open <URL> in the Studio pane, confirm the pane shows <_id>, quote its `_rev` from a raw GROQ read. Perform the reset, then the steps exactly. Capture a fresh DOM/GROQ/cookie/CLI artifact for every PASS observable into evidence/. PASS only if every observable matches; otherwise FAIL with "Cause: …" or BLOCKED with the exact reason (INCONCLUSIVE is BLOCKED). Every write is a draft; never publish; revert real documents with ifRevisionID. If the step budget runs out, BLOCKED for the rest of the phase.

## 7. Pre-run checklist

- Chrome open with **Claude in Chrome connected** and signed in to `audiofast.sanity.studio` (Oliwier; the executor never signs in).
- `:3000`/`:3333` free or running the audited HEAD (the executor starts its own servers only on free ports and never restarts a server it did not start).
- QA seed executed (done 2026-10-27; rerun of the applier reports `0 new, 0 changed`).
- Share access enabled (done; §1.1).
- No Lake-writing automation during the window: no `migrate:denormalize`, no CPO Excel sync, no newsletter send, no seed `--execute`.
- Mac on power; `caffeinate` for long runs.

## 8. Probes

### 8.1 DOM

```js
const STEGA = /[​‌‍﻿⁠-⁣\u{1D173}-\u{1D17A}]{4,}/gu;
const hit = (v) => {
  STEGA.lastIndex = 0;
  return STEGA.test(v);
};
// 1. markers where a machine reads them (every attribute except data-sanity*)
[...document.querySelectorAll('*')].flatMap((el) =>
  [...el.attributes]
    .filter((a) => !a.name.startsWith('data-sanity') && hit(a.value))
    .map((a) => ({ tag: el.tagName, attr: a.name })),
);
// 2. head + JSON-LD
[
  document.title,
  ...[...document.querySelectorAll('meta[content], link[href]')].map(
    (e) => e.getAttribute('content') ?? e.getAttribute('href'),
  ),
  ...[...document.querySelectorAll('script[type="application/ld+json"]')].map(
    (s) => s.textContent,
  ),
].filter((v) => v && hit(v)).length;
// 3. overlay paths
[...document.querySelectorAll('[data-sanity]')]
  .slice(0, 5)
  .map((e) => e.getAttribute('data-sanity'));
// 4. dev runtime audit
JSON.stringify(window.__stegaReports ?? []);
// 5. cookie names (top-level tab only)
document.cookie.split('; ').map((c) => c.split('=')[0]);
```

`data-sanity` values are encoded by `@sanity/visual-editing` (`createDataAttribute` → `id=…;type=…;path=…`); quote the decoded `path`.

### 8.2 GROQ (`perspective: 'raw'`, with `SANITY_AUTH_TOKEN`)

```groq
*[_id == "drafts.qa-presentation"][0].pageBuilder[]._key        // C rows
*[_id in $ids]{_id, _rev}                                            // freeze baseline
*[_id in $draftIds]._id                                              // pre-existing-draft hard stop (must be [])
{ "drafts": *[_id in $draftIds]._id, "revs": *[_id in $ids]{_id, _rev} }   // cleanup: drafts [] + revs == baseline
```

`$ids` = every fixture id the run touched; `$draftIds` = the same ids prefixed `drafts.` plus every never-published E-suite id. Ignore `sanity.previewUrlSecret` documents.

## 9. Gated order

See [test-plan.md](test-plan.md) §5.
