# 01. Recenzje osadzone w tresci - brak linku

## Client context (mail)

> "W sekcji recenzji na dole strony - linkuje prawidlowo, natomiast jako recenzja osadzona - brak linku. Jak kontrolowac recenzje osadzone?"

## Root diagnosis

### What is happening functionally

- Bottom review sections use a publication projection that supports all review destination types (`page`, `pdf`, `external`).
- Embedded review blocks (`ptReviewEmbed`) use a narrower projection and only read `slug.current`.
- For reviews that are PDF/external, `slug.current` is empty by design, so frontend falls back to `#`.

### Confirmed code evidence

- `apps/web/src/global/sanity/query.ts`
  - `ptReviewEmbed` projection returns only `"slug": slug.current`.
  - `publicationBlock` already has correct logic with `select(...)` per destination type.
- `apps/web/src/components/portableText/ReviewEmbed/index.tsx`
  - Builds URL as `review.slug || "#"`.
  - Uses raw `<a href={reviewUrl}>`, so non-page reviews become dead links.

### Why client sees inconsistency

- "Recenzje produktu" at page bottom uses `publicationBlock` and therefore works.
- Embedded block uses a different data contract, so link behavior diverges.

## Fix plan (step-by-step)

1. **Unify review URL projection for embedded blocks**
   - Update both `ptReviewEmbed` query fragments in `query.ts` to return:
     - `destinationType`
     - `slug` computed with `select(...)`:
       - `page -> slug.current`
       - `pdf -> pdfSlug.current`
       - `external -> externalUrl`
     - `openInNewTab` (`true` for `pdf`/`external`, `false` for `page`)

2. **Update component typing and link behavior**
   - In `ReviewEmbed`, extend type with `destinationType` and `openInNewTab`.
   - Use `Link` for internal routes when destination is internal path.
   - Use `<a target="_blank" rel="noopener noreferrer">` for external/PDF destinations.
   - Remove `"#"` fallback for valid review objects; show "Brak linku recenzji" state if URL is truly missing.

3. **Add defensive rendering**
   - If referenced review document is unpublished or missing required destination field, render a non-clickable card with editor-safe message in preview/staging.

4. **Editor guidance (to answer "Jak kontrolowac")**
   - Document that embedded review behavior is controlled by review `destinationType` + destination field (`slug`/`pdfSlug`/`externalUrl`) in Sanity.
   - Add short helper text in schema description for `ptReviewEmbed`.

## Acceptance criteria

- Embedded review links work for:
  - page review,
  - PDF review,
  - external review.
- No embedded review card links to `#`.
- Behavior matches bottom review cards for the same review document.

## Risks / rollback

- **Risk:** Query contract change can affect generated types.
- **Mitigation:** Regenerate Sanity types and run typecheck before release.
- **Rollback:** Revert `ptReviewEmbed` query and `ReviewEmbed` component changes only (isolated scope).

