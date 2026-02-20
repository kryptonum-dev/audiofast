# 10. Balagan w recenzjach (grupowanie po czasopismach)

## Client context (mail)

> "Recenzje byly uporzadkowane wg czasopism, a teraz sa rozjechane (AUDIO, AUDIO 2002/11, itd.). Potrzebna mozliwosc scalania wielu instancji czasopism w jedna."

## Root diagnosis

## Confirmed structural cause

- Studio desk currently groups reviews by `reviewAuthor` (`Recenzje wedlug autorow`) in `apps/studio/structure.ts`.
- `reviewAuthor` schema is a single free-text identity bucket ("author or portal").
- There is no canonical "publication/journal" entity and no merge workflow.

Result:

- Naming variants become separate entities (e.g. `AUDIO`, `AUDIO 2002/11`, `Audio`).
- Editors cannot consolidate these into one canonical publication cleanly.

## Why this keeps recurring

- Free-text name entry + migration imports produce inconsistent labels.
- No normalization/alias system.
- No admin workflow for dedupe/merge and mass reassignment.

## Fix plan (step-by-step)

1. **Introduce canonical publication model**
   - Add new document type: `reviewPublication` (or `publication`).
   - Fields:
     - canonical `name`,
     - `aliases[]`,
     - optional `websiteUrl`.

2. **Update review data model**
   - Add `publication` reference in `review`.
   - Keep `author` as optional person-level metadata where needed.
   - Validation: require at least publication (author optional).

3. **Desk structure redesign**
   - In `structure.ts`, add primary grouping:
     - `Recenzje wedlug czasopism`.
   - Keep `wedlug autorow` as secondary/admin view if needed.

4. **Data migration and merge**
   - Build migration script:
     - map existing `reviewAuthor` variants into canonical publication docs,
     - bulk reassign review references,
     - preserve old values as aliases.
   - Add dry-run mode + CSV report before write.

5. **Operational tooling**
   - Add simple merge utility:
     - choose source variants,
     - choose target canonical publication,
     - bulk rewire references.

6. **Naming governance**
   - Add editor rule:
     - select from existing publication list by default,
     - creating new publication requires review.

## Acceptance criteria

- Reviews can be browsed and managed by canonical publication (magazine/portal).
- Duplicate historical labels are merged without losing review records.
- Editors have a repeatable process for future dedupe.

## Risks / rollback

- **Risk:** reference migration mistakes.
- **Mitigation:** dry-run report + snapshot backup + batch migration.
- **Rollback:** restore previous refs from migration snapshot.

