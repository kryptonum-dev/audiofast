# Presentation walkthrough — executable test plan

## 1. Ground truth and frozen rig

This plan executes [walkthrough-brief.md](walkthrough-brief.md) under [walkthrough/README.md](walkthrough/README.md) and [walkthrough/loop.md](walkthrough/loop.md). The main Claude Code session owns the browser (Claude in Chrome), Content Lake reads and draft writes, verdicts, commits, pushes, deploys and retests. Subagents may only implement bounded, non-overlapping repository fixes or do read-only reviews.

Each run freezes, before its first edit, into `run-<n>/evidence/freeze.json`: HEAD and server origins; Studio/web/browser versions; token presence (never values); CORS probe; share-access existence; every fixture `_id`, `_rev`, URL and draft state (brief §1.2); the full pre-existing draft list. A fixture with a pre-existing draft is read-only.

Restoration target for every touched published document: no `drafts.<id>` and the frozen published `_rev`. Never-published E-suite documents are deleted at cleanup. No run publishes, seeds, migrates, restarts a server it did not start, or deletes `.next`.

## 2. Execution and evidence model

Lanes: `[L]` local Studio `http://localhost:3333` previewing `http://localhost:3000`; `[D]` deployed Studio `https://audiofast.sanity.studio` previewing `https://audiofast.pl`. `[S]` is deferred (D8).

Every scenario is re-anchored to its named URL and `_id`. PASS requires the literal DOM, GROQ, cookie, HTTP, console or CLI value in a fresh evidence file, quoted in `results.md`. Screenshots never decide a verdict. A missing precondition, exhausted budget, inconclusive read or missing fixture is BLOCKED with the exact reason. A behavioural mismatch is FAIL with `Cause:`.

**Standard BLOCKED clause** (every row): stop on a missing fixture, a pre-existing draft, an unavailable authenticated surface, inconclusive evidence or budget exhaustion; record the exact unmet precondition; never substitute a different document.

## 3. Expected behaviours that are not defects

See brief §5. In short: no overlay on `coalesce()`/`select()`/concatenated values; head, JSON-LD, sitemap and 404 stay published; draft listings show published denorm data; purchase disabled in draft (P10); no map in draft `StoreLocations`; consent/analytics only on production outside draft; refresh twice, poll ≥3 s; PreviewBar only in a top-level tab; plain preview URL carries no drafts; optimistic reorder inert outside the iframe.

## 4. Scenario catalogue

Evidence paths are relative to the current run. QA = `qa-presentation` at `/qa-presentation/`.

### P — published negative

| ID  | Lane | Preconditions                       | Steps                                                                        | Literal PASS observable                                                                 | Evidence                             |
| --- | ---- | ----------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| P1  | [D]  | production READY at the audited SHA | 1. `curl -sL` `/`, `/o-nas/`, `/qa-presentation/`. 2. `grep -c data-sanity`. | `0`, `0`, `0`; QA robots meta contains `noindex`; `sitemap.xml` has 0 `qa-presentation` | `evidence/P1-production-html.txt`    |
| P2  | [D]  | sitemap reachable                   | `bun run check:stega-leaks --base https://audiofast.pl --mode published`     | exit `0`; `published: 0 page(s) with findings`                                          | `evidence/P2-production-crawler.txt` |

### A — session and transport

| ID  | Lane | Preconditions                         | Steps                                                                                                                                             | Literal PASS observable                                                                                                                                                     | Evidence                      |
| --- | ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A1  | [L]  | share secret readable (never printed) | GET `/api/draft-mode/enable/?sanity-preview-secret=…&sanity-preview-perspective=drafts&sanity-preview-pathname=/` with `redirect:'manual'`        | HTTP `307`; `Set-Cookie` names `__prerender_bypass`, `sanity-preview-perspective`, and a deletion of `sanity-preview-variant`; no `sanity-preview-partitioned` on localhost | `evidence/A1-enable.txt`      |
| A2  | [L]  | QA draft-safe                         | 1. Studio `/presentation?preview=/qa-presentation/`. 2. Type a unique token into `qa-phone-image-cta-1` primary heading. 3. Poll the iframe ≥3 s. | iframe `[data-sanity]` count `>0`; body contains the token                                                                                                                  | `evidence/A2-iframe.txt`      |
| A3  | [L]  | A2 draft exists                       | Switch perspective drafts → published → drafts                                                                                                    | token present → absent → present; `sanity-preview-perspective` cookie `drafts` → `published` → `drafts` (or the perspective in the iframe URL/cookie as recorded)           | `evidence/A3-perspective.txt` |
| A4  | [D]  | share access on; QA draft edit        | 1. Open the share URL in a fresh tab. 2. Open the plain preview URL in another tab.                                                               | share tab body contains the token; plain tab does not                                                                                                                       | `evidence/A4-share.txt`       |
| A5  | [L]  | top-level draft tab                   | 1. Record cookies. 2. Click „Wyjdź z podglądu”. 3. Reload.                                                                                        | `__prerender_bypass` gone; PreviewBar absent; `[data-sanity]` count `0`                                                                                                     | `evidence/A5-exit.txt`        |
| A6  | [D]  | deployed iframe loaded                | Read the iframe origin's dataset/live request headers and console                                                                                 | status `200`; `access-control-allow-credentials: true`; 0 CORS console errors                                                                                               | `evidence/A6-cors.txt`        |

### B — overlays and click-to-edit

| ID  | Lane | Preconditions         | Steps                                                                                       | Literal PASS observable                                                                                                                                   | Evidence                    |
| --- | ---- | --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| B1  | [L]  | QA                    | Click the `qa-step-list-1` block wrapper                                                    | pane path and wrapper `data-sanity` both resolve `pageBuilder[_key=="qa-step-list-1"]`                                                                    | `evidence/B1-block.txt`     |
| B3  | [L]  | QA `qa-faq-section-1` | 1. Click a FAQ question text. 2. Read the item wrapper attribute.                           | inner opens `faq` document `0c2ca645-…` (or the clicked faq id); wrapper path `pageBuilder[_key=="qa-faq-section-1"].faqList[_key=="qa-faq-section-1-1"]` | `evidence/B3-reference.txt` |
| B4  | [L]  | any page              | Click a header nav button and a footer link                                                 | pane documents `navbar` then `footer`                                                                                                                     | `evidence/B4-chrome.txt`    |
| B6  | [L]  | QA                    | Scan every `img[alt]` and `a[href]`                                                         | 0 marker matches in `alt` and `href`                                                                                                                      | `evidence/B6-alt-href.txt`  |
| B7  | [L]  | product fixture       | Inspect a filter-only field rendered as text (e.g. CPO `availabilityStatus`, product price) | no overlay on it; recorded as expected                                                                                                                    | `evidence/B7-filtered.txt`  |

### C — drag and optimistic reorder

Every C PASS also needs a raw draft GROQ `_key[]` read matching the DOM order, an unchanged `[data-sanity]` count and no snap-back after the second refresh.

| ID  | Lane | Preconditions                                       | Steps                                                                        | Literal PASS observable                                                               | Evidence                         |
| --- | ---- | --------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| C1  | [L]  | QA draft-safe                                       | Drag `qa-phone-image-cta-1` below `qa-step-list-1`                           | the two keys swap in `drafts.qa-presentation` `pageBuilder[]._key`; DOM order matches | `evidence/C1-builder-drag.txt`   |
| C2  | [L]  | QA                                                  | Drag one `stepList.steps` item (`qa-step-list-1-*`)                          | the steps `_key[]` order changes in the draft                                         | `evidence/C2-nested-drag.txt`    |
| C3  | [L]  | QA; freeze faq `_rev`s                              | Drag one `faqList` reference                                                 | `faqList[]._key` order changes; every faq `_rev` unchanged                            | `evidence/C3-reference-drag.txt` |
| C4  | [L]  | QA                                                  | Drag one `contactForm.contactPeople.contactPersons` item (two-level nesting) | nested `_key[]` order changes                                                         | `evidence/C4-two-level.txt`      |
| C5  | [L]  | QA                                                  | Drag one `gallerySection.images` item (client island)                        | items carry `data-sanity`; images `_key[]` order changes                              | `evidence/C5-island.txt`         |
| C6  | [L]  | `footer` draft-safe                                 | Drag one footer link                                                         | `footer` draft `links[]._key` order changes; exactly one annotated copy               | `evidence/C6-footer.txt`         |
| C7  | [L]  | `navbar` draft-safe                                 | At 1280 px drag a nav button; at 390 px inspect the drawer                   | one annotated copy per width; navbar draft order changes once                         | `evidence/C7-nav.txt`            |
| C8  | —    | [presentation-arrays.md](../presentation-arrays.md) | Compare the 31 non-draggable arrays to their component file-header notes     | every listed array has a reason and its component notes it                            | `evidence/C8-classification.txt` |
| C9  | [L]  | QA `qa-image-with-text-boxes-1`                     | Press a box over its text and drag                                           | drag starts (hover not stolen by stega text); boxes order changes                     | `evidence/C9-hover.txt`          |

### D — stega regressions

| ID  | Lane | Preconditions                  | Steps                                                    | Literal PASS observable                                       | Evidence                      |
| --- | ---- | ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------- |
| D5  | [L]  | QA `qa-image-with-video-1`     | Scan the video `iframe[title]`, play button `aria-label` | 0 markers in both                                             | `evidence/D5-video.txt`       |
| D6  | [L]  | QA draft-safe                  | Clear `qa-hero-static-1` description; probe; restore     | element absent while cleared, present after restore           | `evidence/D6-clear.txt`       |
| D7  | [L]  | QA draft-safe                  | Clear the heading of `qa-step-list-1-1`; probe           | the step renders without an empty heading element (`hasText`) | `evidence/D7-list-item.txt`   |
| D10 | [L]  | QA + product + blog draft tabs | Probe 8.1 #1 over the whole DOM                          | 0 attribute findings (all `alt`, `aria-*`, `title`, `href`)   | `evidence/D10-attributes.txt` |

### E — routing and identity

| ID  | Lane | Preconditions                 | Steps                                                          | Literal PASS observable                                                                            | Evidence                      |
| --- | ---- | ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| E1  | [L]  | category fixture              | Navigate the iframe to `/produkty/kategoria/przetworniki-dac/` | selected document `1e0f5761-…` (`productCategorySub`), not a product                               | `evidence/E1-first-match.txt` |
| E3  | [L]  | —                             | Navigate the iframe to `/blog/?page=2`                         | main document `blog`; its locations list includes the page URL                                     | `evidence/E3-pagination.txt`  |
| E4  | [L]  | —                             | Navigate the iframe to `/produkty/?page=1`                     | final URL and highlighted location are recorded; no 404                                            | `evidence/E4-page1.txt`       |
| E6  | [L]  | `faq` document                | Open the document actions menu                                 | no „Otwórz w podglądzie” item                                                                      | `evidence/E6-unrouted.txt`    |
| E7  | [L]  | new `page` draft without slug | Use „Otwórz w podglądzie”                                      | no navigation; toast „Brak adresu strony” / „Uzupełnij adres URL dokumentu, aby otworzyć podgląd.” | `evidence/E7-no-slug.txt`     |
| E8  | [L]  | E7 draft                      | Type slug `/qa-e8-<run>/`; open in preview                     | iframe URL contains the slug; body renders the draft (HTTP 200 in draft)                           | `evidence/E8-unpublished.txt` |
| E9  | [L]  | E8 draft                      | Rename the slug; observe                                       | record whether the preview re-navigates after the save (behaviour recorded, PASS when it follows)  | `evidence/E9-rename.txt`      |

### F — custom inputs

| ID  | Lane | Preconditions         | Steps                                                                                       | Literal PASS observable                                                 | Evidence                         |
| --- | ---- | --------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| F1  | [L]  | QA                    | Type a token into a PT field (`CustomInput`)                                                | token in iframe text node; 0 attribute markers                          | `evidence/F1-pt.txt`             |
| F2  | [L]  | product fixture       | Edit `headingOverride` (`ProductHeadingInput`)                                              | draft value and product hero heading match                              | `evidence/F2-heading.txt`        |
| F3  | [L]  | E8 draft              | Type in the slug field (`PathnameFieldComponent`)                                           | `slug.current` follows typing; the URL preview line has no double slash | `evidence/F3-slug.txt`           |
| F6  | [L]  | product fixture       | Edit one cell in `TechnicalDataView`                                                        | `drafts.<id>.technicalData` changes; the product page specs show it     | `evidence/F6-technical.txt`      |
| F7  | [L]  | product fixture       | Change a value in `ProductFiltersView`                                                      | `drafts.<id>.customFilterValues` changes; published unchanged           | `evidence/F7-filters.txt`        |
| F8  | [L]  | category fixture      | Edit in `CustomFiltersConfigView`                                                           | writes `drafts.<category id>`; published `_rev` unchanged               | `evidence/F8-filters-config.txt` |
| F10 | [L]  | review author fixture | Open `ReviewAuthorManager`; inspect a reassignment write without saving, or save and revert | writes target `drafts.*` ids only                                       | `evidence/F10-review-author.txt` |

F4 (YouTube import uploads assets), F5 (redirects, no visual), F11 (comparator tool, server-action page), F12 (bulk publish) and F13 (publish wrapper) need a publish or an asset upload, which a draft-only run forbids; they are out of the catalogue.

### G — live refresh

| ID  | Lane | Preconditions                | Steps                              | Literal PASS observable                                      | Evidence                    |
| --- | ---- | ---------------------------- | ---------------------------------- | ------------------------------------------------------------ | --------------------------- |
| G1  | [L]  | `navbar` draft-safe; QA open | Edit a nav button label; wait ≥3 s | header shows the exact new label without reload              | `evidence/G1-navbar.txt`    |
| G2  | [L]  | faq `0c2ca645-…` draft-safe  | Edit its question                  | QA page FAQ shows the exact draft question                   | `evidence/G2-reference.txt` |
| G3  | [L]  | G1/G2                        | Read the iframe console            | a next-sanity mutation `console.debug` line exists; no error | `evidence/G3-console.txt`   |

### H — „Używany na” panel

| ID  | Lane | Preconditions                                                                                                           | Steps                                        | Literal PASS observable                                                                   | Evidence                     |
| --- | ---- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| H1  | [L]  | one doc of each referenced-only type (store, award, teamMember, faq, reviewAuthor, youtubeVideo, productCategoryParent) | Open each in Presentation                    | each shows ≥1 page, the unused message or the site-wide message; none has an absent panel | `evidence/H1-referenced.txt` |
| H2  | [L]  | settings, navbar, footer, notFound, redirects, comparatorConfig, socialMedia                                            | Open each                                    | the exact `STATIC_LOCATIONS` message                                                      | `evidence/H2-static.txt`     |
| H3  | [L]  | one product, one blog article                                                                                           | Compare each parent-location URL to the page | every listed URL renders that document                                                    | `evidence/H3-parents.txt`    |
| H4  | [L]  | unused store `2e39534e-…`                                                                                               | Open it                                      | unused message; no fabricated URL                                                         | `evidence/H4-unused.txt`     |
| H5  | CLI  | —                                                                                                                       | `cd apps/studio && bun run test` + E1        | tests pass; E1 selected the category                                                      | `evidence/H5-tests.txt`      |

### I — suppression and fail-closed

| ID  | Lane | Preconditions                              | Steps                                                                                                                  | Literal PASS observable                                        | Evidence                      |
| --- | ---- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------- |
| I1  | [D]  | iframe and a plain draft tab on production | Query `[role="dialog"][aria-label="Ustawienia cookie"]` and GTM/Facebook resources                                     | dialog null; 0 `googletagmanager`/`facebook` resources in both | `evidence/I1-suppression.txt` |
| I2  | [L]  | blog fixture draft-safe                    | Edit `seo.title` in draft; read `<title>` and every `ld+json`                                                          | both keep the published value; 0 markers                       | `evidence/I2-head.txt`        |
| I3  | [L]  | dev server                                 | Scroll `/` and QA in draft tabs; read `window.__stegaReports`                                                          | `[]` or undefined                                              | `evidence/I3-reporter.txt`    |
| I4  | [D]  | deployed Studio                            | Enter an unlisted origin (e.g. `https://example.com`) in the Presentation URL bar; then restore `https://audiofast.pl` | the unlisted origin is rejected; production restored           | `evidence/I4-origin.txt`      |

### K — B2C isolation (audiofast)

| ID  | Lane | Preconditions                  | Steps                                                                                                | Literal PASS observable                                                 | Evidence                       |
| --- | ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| K1  | [L]  | product fixture in a draft tab | Inspect the add-to-cart control                                                                      | button `disabled`; note „Zakup niedostępny w podglądzie” present        | `evidence/K1-buy-disabled.txt` |
| K2  | [L]  | `/produkty/` in a draft tab    | Inspect product-card quick-add                                                                       | quick-add disabled; 0 markers in its `aria-label`                       | `evidence/K2-quick-add.txt`    |
| K3  | [L]  | draft tab                      | `/koszyk/`, `/koszyk/twoje-dane/`, `/konto-klienta/`                                                 | `main [data-sanity]` `0` (the root-layout header/footer stay annotated, as on every page; amended in run 2); 0 attribute/`input[value]` markers on each | `evidence/K3-b2c-routes.txt`   |
| K4  | [L]  | product fixture                | Compare the price in draft and published HTML                                                        | identical price string (Supabase source)                                | `evidence/K4-price.txt`        |
| K5  | CLI  | —                              | Gate tests + source grep: cart/checkout server actions take ids/slugs only, never draft-mode strings | gate tests pass; no `stega`/`draftMode` read in `global/b2c/**` actions | `evidence/K5-actions.txt`      |

## 5. Gated execution order

Phases of at most eight scenarios, each re-anchored:

1. Freeze facts + deterministic gates (`bunx vitest run scripts/presentation-gates` in `apps/web`, Studio tests).
2. A1, A2, A3, A5, B1, B3, B4, B6.
3. B7, C1, C2, C3, C4, C5.
4. C6, C7, C8, C9, D5, D6, D7, D10.
5. E1, E3, E4, E6, E7, E8, E9.
6. F1, F2, F3, F6, F7, F8, F10.
7. G1, G2, G3, H1, H2, H3, H4, H5.
8. I2, I3, K1, K2, K3, K4, K5; cleanup + summariser.
9. [D] after the deploy: P1, P2, A4, A6, I1, I4 (+ a re-check of A2 on [D]).

Run 1 attempts every row on its lane. A later run attempts the preceding FAIL ids plus the plausible regressions in its `fixes.md`. [D] rows run once the [L] run is clean and the phase-end deploy is READY.

## 6. Results convention

Each immutable `walkthrough/run-<n>/results.md` has one `Environment:` paragraph and one `| ID | Result | Evidence | Notes |` table. Results are PASS, FAIL or BLOCKED only. FAIL Notes contain `Cause:`. PASS Notes quote the literal decisive value. Evidence never contains a token or preview secret. `done.md` exists only after the summariser exits 0 and cleanup is proven.

## 7. Closeout

- Cleanup GROQ (brief §8.2) shows `drafts: []` and baseline `_rev`s for every touched id; never-published E-suite documents are deleted.
- The QA page stays published and hidden as a standing fixture for the next audit (P9). Removing it later: `client.delete('qa-presentation')`.
- Stop after five fix iterations with the remaining cause groups.
