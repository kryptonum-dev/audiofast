# Run 3 — done (lane L)

## Summary

The lane-[L] walkthrough is clean. Run 3 retested the only FAIL from run 2 (H3) and the rows that could regress with it (H1, H2, H4, H5). Result: 5 PASS, 0 FAIL, 0 BLOCKED, summariser exit `0`.

| Run | PASS | FAIL | BLOCKED | Fix commit |
| --- | --- | --- | --- | --- |
| 1 | 21 | 1 (G3) | 29 (mostly not attempted, moved to run 2) | `62d15b4` duplicated draft block stream |
| 2 | 22 | 1 (H3) | 11 | `e5bdeb2` listing page of parent locations |
| 3 | 5 | 0 | 0 | — |

Before run 1, the page query latency fix landed as its own commit, `d5257cc`.

## Build

- Final code SHA: `e5bdeb2fb4ddff43ee9cccbeecfd1acd9c9a65ae`, plus the Phase 11 commit. That commit adds the LiveVisualEditing RSC flight-script filter, which was audited uncommitted in runs 1–3.
- Studio build: local `sanity dev` at `e5bdeb2`. The deployed Studio (`https://audiofast.sanity.studio`) is redeployed after this phase. It keeps Podgląd hidden (`SANITY_STUDIO_PRESENTATION_ENABLED=false`, P11).
- Previewed origin: `http://localhost:3000` (`next dev`).

## Cleanup assertion

Fresh read at the end of the run, raw perspective, on the 27 touched or frozen ids: `evidence/cleanup.json`. The run 2 assertion covers run 2's draft writes, including the never-published page `8f8f9974-…`: `../run-2/evidence/cleanup-run2.json`.

```groq
{"drafts": *[_id in $draftIds]._id, "revs": *[_id in $ids]{_id,_rev}, "neverPublished": *[_id in $deleted || _id in $deletedDrafts]._id}
```

Result: `drafts: []`, `revChanged: []` (27 ids checked against `evidence/freeze.json`), `neverPublishedRemaining: []`, `pass: true`. Run 2 result: `drafts: []`, `revChanged: []` (19 ids plus `product-816`), `neverPublishedRemaining: []` for `8f8f9974-b92b-4713-91e7-09fa1627dbe6`.

## BLOCKED rows and owners (last attempt in run 2)

- **B1, B3:** overlay click precision after scrolling the iframe. **C1–C7, C9:** visual-editing drag. The built-in browser pane cannot do these, and Claude in Chrome was not connected. Owner: Oliwier, in a visible Chrome session (see `../run-2/needs-human.md`).
- **F10:** ReviewAuthorManager writes published documents. On open it syncs `reviewCount`; merge and assign also write published documents. This is the Phase 7 design, and the plan text says drafts. Owner: Oliwier, a product decision (see `../run-2/needs-human.md`).
- **A6, I4, A2 re-check on [D]:** skipped because Podgląd is hidden in the deployed Studio (P11). Owner: Oliwier, if Podgląd is enabled later.

The [D] rows that need only the website (P1, P2, A4, I1) run after the phase-end deploy, in run 4.
