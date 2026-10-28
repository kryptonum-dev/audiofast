# Run 1 fixes

## Cause group 1 — duplicated draft block stream (G3)

- Scenario ids: G3.
- Diagnosis ([evidence/G3-diagnosis.txt](evidence/G3-diagnosis.txt)): `components/pageBuilder/OptimisticBlocks.tsx` wrapped the lazily loaded reorder layer in `<Suspense fallback={children}>`. In draft SSR the boundary is pending at shell flush, so Fizz streams every page-builder block twice: once as the fallback and once as the content. React reveals the content (`$RC` → batched `$RV`) and removes the fallback while the fallback copy still has pending segments (`P:7`–`P:a` on `/kontakt/`). Their `$RS` scripts then find no placeholder and throw `Cannot read properties of null (reading 'parentNode')`. Published pages never mount OptimisticBlocks, so production visitors are unaffected. The same component exists in lsse-www.
- Fix: the Suspense fallback is `null` on the server and during hydration (`useSyncExternalStore` hydration flag) and `children` after hydration, so client-side chunk loads still never blank the blocks. The draft HTML no longer carries a second copy of every block.
- Changed files: `apps/web/src/components/pageBuilder/OptimisticBlocks.tsx`.
- Plausible regressions: B1, C1, C2, C3, C4, C5, C9 (the reorder wrapper), A2, G1, G2, G3, D10.
- Mutation `console.debug`: next-sanity logs it only when the Studio drives the refresh inside the Presentation iframe. Run 2 makes the G edit in the Studio and reads the iframe console.
- Lane confirmation [L]: after the dev server recompiled, `/kontakt/` and `/o-nas/` draft loads show `pageerror` `[]`, `[data-sanity]` 28 / 45, attribute findings 0.
- Gates and commit SHA: see the run-2 Environment line.
