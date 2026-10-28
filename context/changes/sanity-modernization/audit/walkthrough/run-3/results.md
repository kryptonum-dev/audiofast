# Presentation walkthrough — run 3

Environment: lane `L`; Studio origin `http://localhost:3333`; Studio build `local sanity dev at e5bdeb2fb4ddff43ee9cccbeecfd1acd9c9a65ae`; previewed origin `http://localhost:3000`; previewed SHA `e5bdeb2fb4ddff43ee9cccbeecfd1acd9c9a65ae (web unchanged since 62d15b4) + uncommitted Phase 11 tree (LiveVisualEditing RSC-script filter)`; browser `Claude desktop built-in browser pane (Chromium) for the Studio; curl for the web pages` (Claude in Chrome not connected); instrumentation `Studio pane DOM via javascript_tool / curl / CLI + GROQ (raw perspective)`; started `2026-10-28T07:09:16Z`; ended `2026-10-28T07:12:38Z`. Run 3 retests the run-2 FAIL (H3) and its plausible regressions from run-2/fixes.md (H1, H2, H4), plus H5 because the Studio changed. Read-only run: no draft writes.

| ID | Result | Evidence | Notes |
| --- | --- | --- | --- |
| H1 | PASS | evidence/H1-referenced.txt | store „Used on 19 pages”, award „Used on one page”, teamMember „Used on 5 pages”, faq „Used on 4 pages”, reviewAuthor „Used on 3 pages”, youtubeVideo „Not used on any pages”, productCategoryParent „Used on 7 pages”; no absent panel |
| H2 | PASS | evidence/H2-static.txt | all 7 messages equal `STATIC_LOCATIONS` (`grep -cF` 1 each), e.g. „Nawigacja pojawia się na każdej stronie serwisu.” |
| H3 | PASS | evidence/H3-parents.txt | product-130: `/produkty/?page=23`, `/produkty/kategoria/glosniki-podlogowe/`, `/marki/goldenear/?page=4` each 200 with `a[href="/produkty/triton-two/"]` `2`; blog 1f63efc2: `/blog/` and `/blog/kategoria/nowosci/` 1 link each |
| H4 | PASS | evidence/H4-unused.txt | store `2e39534e-…` „Not used on any pages”; URL strings `[]` |
| H5 | PASS | evidence/H5-tests.txt | `apps/studio bun run test`: `Tests 128 passed (128)` |
