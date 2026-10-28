# Run 4 — done (lane D, final run)

## Summary

The [D] rows that need only the website pass on production at `3de7859`: P1, P2, A4 and I1 (the draft-tab half). Rows that need the deployed Presentation tool are BLOCKED, because Podgląd is hidden in the deployed Studio (P11): A6, I4 and the A2 re-check. The summariser reports 4 PASS, 0 FAIL, 3 BLOCKED, exit `0`. Lane [L] closed clean in run 3 (`../run-3/done.md`).

## Build

- Final SHA: `3de7859cfb12855dbcbae02b7172cd9b4e244a0f`. Vercel production `dpl_Aq1yc7vCMMu8DR2GScDYtdbvUQ9t` is READY and aliased to `https://audiofast.pl`.
- Studio build: deployed `https://audiofast.sanity.studio` (app `dlwt2zhgkk7rjx6dj8rdyjfz`) on 2026-10-28 from `3de7859`, built with `SANITY_STUDIO_PRESENTATION_ENABLED=false`.

## Cleanup assertion

Fresh read after the A4 draft was deleted, raw perspective: `evidence/cleanup.json`.

```groq
{"drafts": *[_id in $draftIds]._id, "revs": *[_id in $ids]{_id,_rev}, "neverPublished": *[_id in $deleted || _id in $deletedDrafts]._id}
```

Result: `drafts: []`. `qa-presentation` `_rev` is `6LbxA4c5p2VL183Rwcp8pK`, equal to the baseline in `evidence/freeze.json` (`revChanged: []`). `pass: true`.

## BLOCKED rows and owners

- A6, I4, A2 re-check on [D]: Podgląd is hidden in the deployed Studio (P11). Owner: Oliwier, if Podgląd is enabled for editors later.
- From lane L (`../run-2/needs-human.md`):
  - B1, B3, C1–C7, C9 need a visible Chrome session. Owner: Oliwier.
  - F10 needs a product decision on ReviewAuthorManager's published writes. Owner: Oliwier.
