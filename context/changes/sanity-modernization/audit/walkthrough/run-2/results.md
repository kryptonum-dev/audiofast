# Presentation walkthrough — run 2

Environment: lane `L`; Studio origin `http://localhost:3333`; Studio build `local sanity dev with HMR at 62d15b438e45b0cbfe7d56080140e0817221204c, then e5bdeb2f (H3 pagination fix) for the rows after H3`; previewed origin `http://localhost:3000`; previewed SHA `62d15b438e45b0cbfe7d56080140e0817221204c (G3 fix, gates in evidence/fix-gates.txt) + uncommitted Phase 11 tree (LiveVisualEditing RSC-script filter)`; browser `Claude desktop built-in browser pane (Chromium) for the Studio + headless Playwright (repo @playwright/test) for draft-tab DOM probes` (Claude in Chrome not connected: list_connected_browsers `[]`); instrumentation `Studio pane / clean headless draft tab / CLI + GROQ (raw perspective)`; harness note: Presentation leaves its iframe at inline `opacity: 0` in this pane, so a Studio-side style `iframe{opacity:1!important;transform:none!important}` was injected after each Studio navigation (clicks reach the iframe either way); started `2026-10-28T06:31:48Z`; ended `2026-10-28T07:08:18Z`. Run 2 attempts the run-1 FAIL (G3), its plausible regressions, and every row run 1 moved here.

| ID | Result | Evidence | Notes |
| --- | --- | --- | --- |
| A2 | PASS | evidence/A2-iframe.txt | typed ` QA11R2A2` into `qa-phone-image-cta-1` primary heading in the Studio PT editor; draft tab body contains the token; `[data-sanity]` `72` |
| A3 | PASS | evidence/A3-perspective.txt | iframe src `sanity-preview-perspective=drafts` → `published` → `drafts`; token `true` → `false` → `true` with cookie `drafts` → `published` → `drafts` |
| B1 | BLOCKED | — | overlay hit-testing in the built-in pane uses stale geometry after scrolling the iframe (hover outlines the wrong element; a FAQ question click opened `pageBuilder[_key=="qa-faq-section-1"]`); Claude in Chrome not connected (`list_connected_browsers` `[]`). Needs a visible Chrome session |
| B3 | BLOCKED | — | same as B1: stale overlay geometry after iframe scroll in the built-in pane; Claude in Chrome not connected |
| B4 | PASS | evidence/B4-chrome.txt | `/kontakt/`: header „Produkty” → `/presentation/navbar/navbar/buttons[_key=="b12ed862…"]` „Nawigacja”; footer „O nas” → `/presentation/footer/footer/links[_key=="19c76b65…"]` „Stopka” |
| B7 | PASS | evidence/B7-filtered.txt | `/produkty/triton-two/` draft: `priceWrapper` and `priceDisplay` („Cena całkowita: 23 400 zł”) have `ownDataSanity` `null`, `closestDataSanity` `null`, `descDataSanity` `0`, `stega` `false` (stega active elsewhere in main): no overlay, expected |
| C1 | BLOCKED | — | `left_click_drag` in the built-in pane does not start a visual-editing drag (two attempts on footer links: `drafts.footer` `null`, keys unchanged); no mouse-down/move/up primitive; Claude in Chrome not connected |
| C2 | BLOCKED | — | same as C1 (no drag primitive in the built-in pane; Claude in Chrome not connected) |
| C3 | BLOCKED | — | same as C1 |
| C4 | BLOCKED | — | same as C1 |
| C5 | BLOCKED | — | same as C1 |
| C6 | BLOCKED | — | same as C1; footer `links[]._key` unchanged after two drags (`d74fa75e…`, `19c76b65…`, `b3efa365…`, `4ac20b72…`, `3b948282…`, `4f28247e…`) |
| C7 | BLOCKED | — | same as C1 |
| C8 | PASS | evidence/C8-classification.txt | 31 non-draggable rows: 23 with a component carry a „NOT draggable” note (14 files, `0` missing); 8 „(no component)”/renderer rows carry their reason in the table |
| C9 | BLOCKED | — | same as C1 (drag cannot be started in the built-in pane) |
| D10 | PASS | evidence/D10-attributes.txt | QA, `/produkty/triton-two/`, blog, `/kontakt/` draft tabs: `attrFindingCount` `0`, `headFindings` `0` |
| E1 | PASS | evidence/E1-first-match.txt | `/presentation/productCategorySub/1e0f5761-34d3-dfc5-aff7-9547062b1742/` „Przetworniki cyfrowo-analogowe” |
| E3 | PASS | evidence/E3-pagination.txt | `/presentation/blog/blog/`; panel „Used on one page Blog /blog/”; `/blog/?page=2` 200 |
| E4 | PASS | evidence/E4-page1.txt | final iframe URL `http://localhost:3000/produkty/?page=1&sanity-preview-perspective=drafts` (no redirect); main document `products`; 200, no error card |
| E6 | PASS | evidence/E6-unrouted.txt | faq menu `["Duplicate", "Delete"]`; control page menu adds „Otwórz w podglądzie” |
| E7 | PASS | evidence/E7-no-slug.txt | new page `8f8f9974-…` without slug: location stays `/structure/page;8f8f9974-…`; toast „Brak adresu strony” / „Uzupełnij adres URL dokumentu, aby otworzyć podgląd.” |
| E8 | PASS | evidence/E8-unpublished.txt | `/presentation/page/8f8f9974-…/?preview=http://localhost:3000/qa-e8-run2/…`; draft tab `/qa-e8-run2/` 200, main „Strona główna / QA E7 run2” (published: 404 body) |
| E9 | PASS | evidence/E9-rename.txt | after the slug save the Studio preview follows: `?preview=http://localhost:3000/qa-e9-run2qa-e9b-run2/…`, iframe shows the draft. Attempt 1 hit a transient 404 + „Could not connect to the preview” (recorded) |
| F2 | PASS | evidence/F2-heading.txt | `drafts.product-130.headingOverride.upper` `"QA11F2UP"`; draft hero h1 `QA11F2UP / Triton Two+` (published `Goldenear Technology / Triton Two+`) |
| F3 | PASS | evidence/F3-slug.txt | `slug.current` `"/qa-e8-run2/"` after typing `qa-e8-run2`; URL preview line `http://localhost:3000/qa-e8-run2/`, double slash `false` |
| F6 | PASS | evidence/F6-technical.txt | `drafts.product-130` row `Impedancja:` value `"8 ohm QA11F6"` (published `"8 ohm"`); draft page specs `8 ohm QA11F6` |
| F7 | PASS | evidence/F7-filters.txt | on `product-816` (product-130's category has no filters): `drafts.product-816` Phono MM/MC `2`; published `_rev` `olGAgOM7pKeK5Hk1SoXoeq`, Phono `0` |
| F8 | PASS | evidence/F8-filters-config.txt | `drafts.1e0f5761-….customFilters` `[{"name":"QA11F8 filtr","filterType":"dropdown"}]`; published `_rev` `XNQh23oop7n7SfU9ADm7fi` unchanged; 41 category products' `_rev` unchanged |
| F10 | BLOCKED | evidence/F10-review-author.txt | not opened: the pane patches `reviewCount` on every PUBLISHED author on mount (`index.tsx:262-267`; dry run on `427e2d0b-…` returns a new `_rev`), and merge/assign re-point published review ids by a Phase 7 design note. Product decision for Oliwier in needs-human.md |
| G1 | PASS | evidence/G1-navbar.txt | `/kontakt/` header shows `ProduktyR2G1` without reload; navigation entries `1` |
| G2 | PASS | evidence/G2-reference.txt | `/kontakt/` FAQ shows the `R2G2` draft question of faq `0c2ca645-…` without reload; navigation entries `1` |
| G3 | PASS | evidence/G3-console.txt | iframe console: `<VisualEditing /> refresh called with source "mutation"`; `pageerror` `[]` on draft loads (the run-1 `$RS` TypeError is gone) |
| H3 | FAIL | evidence/H3-parents.txt | product-130 panel listed `/produkty/?page=7` (product is on page 23) and `/marki/goldenear/` (product is on page 4). Cause: Studio pagination paged `/produkty/` by `orderRank` while the page sorts `priceAsc`, and category/brand grids were never paged |
| K3 | PASS | evidence/K3-b2c-routes.txt | `/koszyk/`, `/koszyk/twoje-dane/`, `/konto-klienta/`: `main [data-sanity]` `0` (all 16 = header 5 + footer 11); `0` attribute and `0` `input[value]` markers |
