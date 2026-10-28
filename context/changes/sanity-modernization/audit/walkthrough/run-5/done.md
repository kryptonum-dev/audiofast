# Run 5 — done (lane D, deployed Podgląd rows)

## Summary

Run 4 left three rows BLOCKED because Podgląd was hidden in the deployed Studio (P11). Podgląd was enabled on 2026-10-28 (P12), and all three now pass on the deployed lane:

- **A2 [D] re-check:** a token typed in the deployed Studio reaches `drafts.qa-presentation`, appears live in the production iframe and renders in a production draft tab (`token true`, `[data-sanity]` 72).
- **A6:** with `Origin: https://audiofast.pl`, the dataset and live API answer `200` with `access-control-allow-credentials: true`, and the browser on that origin logs 0 CORS errors.
- **I4:** the deployed Presentation tool rejects `https://example.com` from both the URL bar and the route param, and production comes back.

The summariser reports 3 PASS, 0 FAIL, 0 BLOCKED, exit `0`. No defect was found, so this run has no `fixes.md` and no `needs-human.md`.

## Build

- Final SHA: `265ca9848d1c6bc3818e603ba97fd6623f757146`. Vercel production `dpl_6zf7CsiZNk1yQ34j9oMcxE9uk1EK` is READY and aliased to `https://audiofast.pl`. While the run was going, production moved from `1817593` to `7ae387d` and then to `265ca98`. All three have the same `apps/web` (empty diff), so the previewed site was the same throughout.
- Studio build: the deployed `https://audiofast.sanity.studio` (app `dlwt2zhgkk7rjx6dj8rdyjfz`), built with `SANITY_STUDIO_PRESENTATION_ENABLED=true` after `7ae387d`/`265ca98`. It opens inside the sanity.io dashboard.

## Cleanup assertion

The only write was `drafts.qa-presentation`, made by the A2 edit. It was reverted at 08:38:40Z by a transaction guarded on the draft's `_rev` (`ifRevisionID` `5c13221b-afbe-4338-ae17-463b60d5949b`, then `delete`; tx `5cyTuyNJJJ5tloebA3tUKH`). The published document was never written. Fresh raw-perspective read: `evidence/cleanup.json`.

```groq
{"drafts": *[_id in $draftIds]._id, "versions": *[_id in path("versions.**.qa-presentation")]._id, "revs": *[_id in $ids]{_id,_rev}}
```

Result: `drafts: []`, `versions: []`. `qa-presentation` `_rev` is `6LbxA4c5p2VL183Rwcp8pK`, equal to the baseline in `evidence/freeze.json` (`revChanged: []`), and the heading is back to `"Kto serwisuje sprzęt w AUDIOFAST?"`. `pass: true`. The pending-draft count rose from 136 to 144 because of 8 `sanity.previewUrlSecret` drafts, which the Studio creates on every Presentation load (ignored per brief §8.2).

## For a human to check by eye

- **The Presentation iframe's own console (A6).** The iframe is nested two cross-origin levels deep (sanity.io dashboard → Studio → audiofast.pl). The pane tools cannot read its console or network, so A6's console and header observables were read on the iframe's origin in a top-level tab. In DevTools, pick the `audiofast.pl` frame in Podgląd and confirm there is no CORS error and that `<SanityLive includeDrafts> is connected` is logged.
- **React hydration error on published pages (not an audit row).** The built-in browser logged `Minified React error #418 (args HTML)` when loading published `https://audiofast.pl/qa-presentation/` and `https://audiofast.pl/`. That is a hydration text mismatch. It is not a Presentation observable and was not investigated. Check it in a normal Chrome window with no extensions before deciding whether it is real.
- **Screenshot-only observations.** The live token inside the iframe (A2), and the red URL bar plus the „Blocked preview URL” toast (I4), were seen only in screenshots. The decisive values are the Lake read, the draft-tab DOM read and the Studio `preview` route param.

## BLOCKED rows and owners

None in this run. The earlier lane-L items in `../run-2/needs-human.md` stay open with Oliwier: B1, B3, C1–C7 and C9 need a visible Chrome session, and F10 needs a product decision.
