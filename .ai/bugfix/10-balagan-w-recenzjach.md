# 10. Balagan w recenzjach (scalanie wariantow autorow/czasopism)

## Client context (mail)

> "Recenzje byly uporzadkowane wg czasopism, a teraz sa rozjechane (AUDIO, AUDIO 2002/11, itd.). Potrzebna mozliwosc scalania wielu instancji czasopism w jedna."

## Updated decision (UX + architecture)

We will implement this as a **new embedded configurator view inside `Recenzje`** in Studio structure (not as another top navigation tab).

Reasoning:

- It is contextually correct: this workflow belongs to reviews.
- It avoids top-bar clutter as more tools are added.
- It ships faster than a separate global app while still enabling App SDK-powered workflow patterns.

## Current root diagnosis

- Reviews currently reference `reviewAuthor` (`review.author`), and author names are treated as identity buckets.
- Historical imports and editor naming variants create duplicates (`AUDIO`, `Audio`, `AUDIO 2020/05`, etc.).
- There is no built-in merge workflow, bulk reassignment flow, or orphan-author assignment workflow.

## Target UX in Studio

Inside `Recenzje`, add a new item under `Lista autorów`:

- `Scalanie autorów recenzji` (working title)

When opened, it shows a configurator with two actions:

1. **Merge author variants**
   - Choose target author (canonical).
   - Select source authors to merge into target.
   - Preview number of affected reviews.
   - Optional checkbox: delete source authors when empty after merge.

2. **Assign missing author in bulk**
   - Show reviews with missing `author`.
   - Filter/search and select multiple reviews.
   - Assign selected reviews to chosen author.

## Scope and non-goals

### In scope (MVP)

- New structure view in `Recenzje`.
- Bulk merge of author references.
- Optional cleanup of now-empty source authors.
- Bulk assignment for reviews with missing author.
- Safety controls (preview, confirm, progress, summary, error handling).

### Out of scope (this issue)

- Full schema redesign (`reviewPublication`, alias graph, etc.).
- Moving all tools to separate left-side global app.
- Automatic fuzzy merging without user confirmation.

## Implementation strategy (step-by-step)

1. **Add structure entry in `Recenzje`**
   - Update `apps/studio/structure.ts`.
   - Add a new list item below `Lista autorów`.
   - Open a custom component pane (same custom-pane pattern already used in Studio).

2. **Create configurator module**
   - Add a dedicated component folder for review merge tool (for example under `apps/studio/components/` or `apps/studio/tools/`).
   - Implement clear split between:
     - data-loading hooks/services,
     - mutation actions,
     - UI sections (merge, orphan assignment, summary).

3. **Data retrieval layer**
   - Fetch authors with counts of linked reviews.
   - Fetch reviews with missing `author`.
   - Support search/filter for both lists.
   - Keep draft/published awareness in queries.

4. **Merge flow**
   - Validate inputs:
     - target selected,
     - at least one source selected,
     - target not included in sources.
   - Preview:
     - per-source and total affected reviews.
   - Execute batched transactions:
     - reassign `review.author` references from sources to target.
   - Post-merge optional cleanup:
     - delete source authors only if reference count is zero.

5. **Assign-missing flow**
   - Build selectable table/list for reviews with no `author`.
   - Allow bulk assignment to selected target author.
   - Execute batched patch operation and return summary.

6. **Safety rails and guardrails**
   - Confirmation dialog with counts before write.
   - Progress state during mutation.
   - Success/error toast + final operation report.
   - Fail-safe behavior:
     - if one batch fails, continue next batch and report failed IDs.
   - No destructive action without explicit user opt-in.

7. **QA and editorial validation**
   - Test with real variants (`AUDIO`, `AUDIO 2020/05`, etc.).
   - Verify grouped view consistency after merge.
   - Verify no broken references after optional source deletion.
   - Verify orphan assignment updates listings immediately.

8. **Release and documentation**
   - Add short editor guide:
     - when to merge,
     - when to assign missing author,
     - what delete-empty does.
   - Add rollback note and manual fallback process.

## Proposed files to touch

- `apps/studio/structure.ts` (add new review configurator view entry)
- New configurator component(s), e.g.:
  - `apps/studio/tools/review-author-manager/index.tsx` (or equivalent)
  - optional split files for queries/actions/UI sections

## Acceptance criteria

- Editors can merge multiple author variants into one canonical author from inside `Recenzje`.
- Editors can bulk assign orphan reviews (missing author) to a selected author.
- Optional cleanup removes only truly empty source authors.
- Workflow is discoverable, fast, and does not require external scripts.

## Risks and rollback

- **Risk:** accidental merge into wrong target.
  - **Mitigation:** preview + confirm dialog + explicit target/source display.
- **Risk:** deleting non-empty author documents.
  - **Mitigation:** hard pre-delete count check (must be zero).
- **Risk:** partial batch failure.
  - **Mitigation:** batch-level error reporting and rerun support.
- **Rollback plan:**
  - Re-run merge in reverse (target back to original sources) using operation summary.
  - Avoid irreversible destructive steps by default.

## Long-term evolution (post-MVP)

- If operations tools keep growing, migrate this and similar utilities into one dedicated global left-side app (`Audiofast Operations`), while keeping `Recenzje` entry as shortcut.

