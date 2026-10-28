# Presentation walkthrough — run 1

Environment: lane `L`; Studio origin `http://localhost:3333`; Studio build `local sanity dev at d5257cc5e79e0b596b6b132fb4104ea5b3024ceb`; previewed origin `http://localhost:3000`; previewed SHA `d5257cc5e79e0b596b6b132fb4104ea5b3024ceb + uncommitted Phase 11 tree (LiveVisualEditing RSC-script filter)`; browser `Claude desktop built-in browser pane (Chromium) for the Studio + headless Playwright (repo @playwright/test) for draft-tab DOM probes` (Claude in Chrome not connected); instrumentation `Studio pane / clean headless draft tab / CLI + GROQ (raw perspective)`; started `2026-10-27T15:43:02Z`; ended `2026-10-27T16:25:07Z`. Rows marked "not attempted in run 1" were moved to run 2 because the G3 fix changes the draft render of every page-builder block (the C rows drag those blocks).

| ID | Result | Evidence | Notes |
| --- | --- | --- | --- |
| A1 | PASS | evidence/A1-enable.txt | HTTP `307`; Set-Cookie `__prerender_bypass`, `sanity-preview-perspective`, deletion of `sanity-preview-variant`; no `sanity-preview-partitioned` |
| A2 | PASS | evidence/A2-iframe.txt | overlay click opened `pageBuilder[_key=="qa-phone-image-cta-1"].primaryHeading`; typed ` QA11A2TOKEN`; draft tab body contains the token; `[data-sanity]` 72 |
| A3 | BLOCKED | evidence/A2-iframe.txt | only the drafts → published leg was observed (iframe src `sanity-preview-perspective=published`); the token-absent read was not taken before the interim cleanup deleted the A2 draft; re-run in run 2 |
| A5 | PASS | evidence/A5-exit.txt | after „Wyjdź z podglądu” + reload: `__prerender_bypass` gone, PreviewBar absent, `[data-sanity]` `0` |
| B1 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| B3 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| B4 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| B6 | PASS | evidence/B6-alt-href.txt | QA: 155 `img[alt]`, 232 `a[href]`, `0` marker matches |
| B7 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C1 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C2 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C3 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C4 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C5 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C6 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C7 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C8 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| C9 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| D5 | PASS | evidence/D5-video.txt | play button `aria-label` `Odtwórz wideo` clean; the iframe is a click facade (no `iframe[title]` before play); `0` markers |
| D6 | PASS | evidence/D6-clear.txt | `qa-hero-static-1` description absent while cleared, present after restore (≥75 s refresh on QA) |
| D7 | PASS | evidence/D7-list-item.txt | step `qa-step-list-1-1` renders without an empty heading element |
| D10 | PASS | evidence/D10-attributes.txt | QA, product and blog draft tabs: `attrFindingCount` `0`, `headFindings` `0` |
| E1 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| E3 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| E4 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| E6 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| E7 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| E8 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| E9 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| F1 | PASS | evidence/A2-iframe.txt | token ` QA11A2TOKEN` in the H3 text node; `0` attribute markers |
| F2 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| F3 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| F6 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| F7 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| F8 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| F10 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| G1 | PASS | evidence/G1-navbar.txt | on `/kontakt/` (QA refresh >25 s): header shows the exact draft nav label without reload |
| G2 | PASS | evidence/G2-reference.txt | on `/kontakt/`: FAQ shows the exact draft question of faq `0c2ca645-…` without reload |
| G3 | FAIL | evidence/G3-console.txt, evidence/G3-diagnosis.txt | `TypeError: Cannot read properties of null (reading 'parentNode') at $RS` ×3 on every draft load; no mutation `console.debug` line. Cause: OptimisticBlocks rendered `<Suspense fallback={children}>`, so every block streamed twice and the fallback copy's late segments hit a removed placeholder |
| H1 | PASS | evidence/H1-referenced.txt | store, award, teamMember, faq, reviewAuthor, youtubeVideo, productCategoryParent each show ≥1 page, the unused or the site-wide message |
| H2 | PASS | evidence/H2-static.txt | all 7 exact `STATIC_LOCATIONS` messages |
| H3 | BLOCKED | — | not attempted in run 1 (moved to run 2) |
| H4 | PASS | evidence/H4-unused.txt | store `2e39534e-…`: „Not used on any pages”; no URL |
| H5 | PASS | evidence/H5-tests.txt | `apps/studio bun run test` 126/126 |
| I2 | PASS | evidence/I2-head.txt | draft `seo.title` `I2TOKEN…`: `<title>` and every `ld+json` keep the published value; `0` markers |
| I3 | PASS | evidence/I3-reporter.txt | `window.__stegaReports` `undefined` on `/` and QA after scroll |
| K1 | PASS | evidence/K1-buy-disabled.txt | `/produkty/nas/` draft: button `disabled`, note „Zakup niedostępny w podglądzie”; published enabled (product-130 is not sellable online) |
| K2 | PASS | evidence/K2-quick-add.txt | `/marki/r-volution/` draft: quick-add disabled, `0` markers in `aria-label` |
| K3 | BLOCKED | evidence/K3-b2c-routes.txt | `0` attribute/`input[value]` markers, but `[data-sanity]` `16` on each route from the root-layout navbar/footer; verdict on `main` scope moved to run 2 |
| K4 | PASS | evidence/K4-price.txt | `23 400 zł` in draft and published |
| K5 | PASS | evidence/K5-actions.txt | gate tests pass; no `stega`/`draftMode` read in `global/b2c/**`, `app/koszyk`, `app/konto-klienta` |
