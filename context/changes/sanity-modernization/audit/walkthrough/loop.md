# Fix-and-retest loop

The main session is the sole owner of Chrome, the Studio pane, Lake draft mutations, verdicts, commits, pushes, `sanity deploy` and retests.

1. Freeze the Studio origin and build, the previewed origin and SHA, Chrome version, the `_rev` baseline of every fixture (draft-exists must be "no", brief §1.2) and timestamps into `run-<n>/evidence/freeze.json`. Run the gated phases of [../test-plan.md](../test-plan.md) §5. Write `run-<n>/results.md`.
2. `bun scripts/walkthrough/summarize-results.ts context/changes/sanity-modernization/audit/walkthrough/run-<n>/results.md`.
3. FAIL = 0: run the cleanup GROQ (brief §8.2), paste the transcript into `evidence/cleanup.json`, write `run-<n>/done.md` (summary, final SHA, Studio build, BLOCKED rows with owners) and stop.
4. Otherwise group FAILs by `Cause:` in `run-<n>/fixes.md`. Delegate only bounded, non-overlapping repository fixes or read-only reviews.
5. BLOCKED never creates a fixer. It must match an expected behaviour (brief §5) or be a genuine missing credential/approval/decision recorded in `needs-human.md`.
6. Gates (one full crawl per run; `--limit`/`--probe` only for retests):

   ```bash
   bun run lint && bun run check-types
   (cd apps/web && bun run test:run) && (cd apps/studio && bun run test)
   bun run check:stega-leaks --base http://localhost:3108 --mode both   # isolated `next start -p 3108`, never a shared dev server
   ```

7. Commit the cause group as `fix(sanity-modernization): <cause> (run <n>)`. Then by lane:
   - **[L]** reload the previewed page and quote the changed observable. Never restart a server you did not start.
   - **[D]** `git push origin main`, wait for the Vercel production deployment READY (`vercel inspect https://audiofast.pl`) at the commit SHA, then `cd apps/studio && bunx sanity deploy`.
8. Re-run the FAIL ids plus plausible regressions in a new run folder. Never rewrite an earlier result.
9. Stop after five fix iterations and report the remaining cause groups.

Content safety, in force for every step:

- **Every write is a draft.** Never publish (Studio publish button, bulk publish, `createOrReplace` on a published id).
- **Real documents revert with `ifRevisionID`** against the frozen `_rev`, or by deleting the draft; record the post-revert state in `evidence/`.
- **A pre-existing draft is a hard stop**: that document is read-only for the run.
- **No Lake-writing automation during a run:** no `migrate:denormalize`, no seed `--execute`, no CPO Excel sync, no newsletter send.
- **No orderable-list drags** (`@sanity/orderable-document-list` writes published `orderRank`).
- **Cleanup is an assertion:** `*[_id in $draftIds]._id` is `[]` and every touched published `_rev` equals its baseline. Delete drafts with `client.delete({ query: '*[_id in $ids]' })` or the Studio's discard action.
