# Run 2 fixes

## Cause group 1 — listing page of parent locations (H3)

- Scenario ids: H3.
- Diagnosis ([evidence/H3-parents.txt](evidence/H3-parents.txt)): `apps/studio/presentation/pagination.ts` paged the `/produkty/` row by `orderRank asc`, but `app/produkty/(listing)/page.tsx` sorts by `priceAsc` (since before implementation_base). The category and brand grid rows (and the blog category row) were never paged. product-130 was promised on `/produkty/?page=7` but is on page 23, and on `/marki/goldenear/` (page 1) but is on page 4.
- Fix: every listing row is paged by its own `{href, ids}` list, built with the web listing's default sort and filter (`parentPagination.lists`, `subLists`), including the category and brand grids.
- Changed files: `apps/studio/presentation/pagination.ts`, `apps/studio/presentation/pagination.test.ts`, `apps/studio/presentation/locations.test.ts`, `apps/studio/presentation/routes.ts` (comments).
- Plausible regressions: H1, H2, H3, H4 (same „Używany na” panel).
- Gates: `cd apps/studio && bun run test` 128/128; Studio tsc, eslint and prettier clean; root `bun run check-types` and `bun run lint` 0 errors.
- Commit: `e5bdeb2` `fix(sanity-modernization): listing page of parent locations (run 2)`.
- Lane confirmation [L]: the local Studio (HMR) now shows for product-130 „Produkty — strona 23 /produkty/?page=23” and „Goldenear Technology — strona 4 /marki/goldenear/?page=4”; a curl scan of the web pages 1..42 finds the product on page 23 and brand page 4. Retest in run 3.

## Not a cause group (BLOCKED, no fixer)

- B1, B3, C1–C7, C9: executor limits of the built-in browser pane (stale overlay geometry after iframe scroll, no drag primitive) while Claude in Chrome is not connected. Owner: Oliwier in a visible Chrome session.
- F10: product decision, see [needs-human.md](needs-human.md).
