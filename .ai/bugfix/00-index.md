# Audiofast Bugfix Research Pack (From Notion: "Wszystkie poprawki")

This folder contains one detailed analysis file per client-reported problem, in the exact order from Notion page `Wszystkie poprawki` (`3078947e8c3e8036a3acea5be1851fba`).

## Files

1. `01-recenzje-osadzone-w-tresci.md`
2. `02-blog-nie-w-newsach.md`
3. `03-problem-ze-specyfikacja-ephono-plus.md`
4. `04-pozycjonowanie-typy-produktow.md`
5. `05-cms-walidacja-publish-kategoria.md`
6. `06-h1-na-stronach-produktowych.md`
7. `07-grafiki-na-blogu-poobcinane.md`
8. `08-indeksowanie-opaslych-podstron.md`
9. `09-problem-z-cennikiem-i-skryptem.md`
10. `10-balagan-w-recenzjach.md`

## Method used

- Parsed all toggle sections from Notion task page.
- Mapped each symptom to concrete code paths in:
  - `apps/web` (frontend, queries, rendering, SEO, revalidation),
  - `apps/studio` (Sanity schema, desk structure, validation),
  - pricing pipeline docs/scripts (`.ai/office-scripts`, `.ai/vba-scripts`).
- Used Supabase MCP (`execute_sql`) to validate current pricing rows for Stromtank issue.
- Marked uncertain areas as hypotheses and added a verification procedure.

## Output format in each file

- Client mail context (from Notion toggle body).
- Root diagnosis (business + code perspective).
- Detailed fix plan (step-by-step).
- Acceptance criteria.
- Risks and rollback notes.

