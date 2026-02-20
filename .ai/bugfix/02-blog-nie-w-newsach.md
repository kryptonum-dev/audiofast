# 02. Blog nie w newsach

## Client context (mail)

> "Publikacje na BLOG nie publikuja sie w newsach... po interwencji dzialalo, ale w praktyce nie dziala. Dzisiejszy artykul blogowy nie..."

## Root diagnosis

## Primary cause (confirmed): homepage cache is not invalidated on blog-article publish

- Home page query is cached with tag `homePage` in `apps/web/src/app/page.tsx`.
- Revalidation map in `apps/web/src/app/api/revalidate/route.ts` defines:
  - `'blog-article': ['blog']`
  - **No `homePage` dependency for blog-article updates**.
- Result: after publishing a blog article, blog listing may update, but homepage "news/publications" can stay stale until another event invalidates `homePage`.

This exactly matches "sometimes works after manual intervention".

## Secondary consistency gaps (confirmed)

- `latestPublicationBlock` and `featuredPublicationsBlock` in `apps/web/src/global/sanity/query.ts` do not enforce the same blog filters as blog listing (`hideFromList` and strict slug requirement).
- This creates inconsistent "what appears in blog listing vs what appears in homepage publication feed".

## Optional content-side cause (hypothesis)

- If homepage block is set to `selectionMode == "manual"` in Sanity, new posts will not appear automatically by design.
- Needs quick sanity content check during implementation.

## Fix plan (step-by-step)

1. **Fix revalidation dependency graph**
   - In `TYPE_DEPENDENCY_MAP`, change:
   - `'blog-article': ['blog']`
   - to:
   - `'blog-article': ['blog', 'homePage']`
   - This ensures homepage publication widgets refresh immediately after article publish.

2. **Align homepage publication filters with blog listing rules**
   - In `query.ts`, update `latestPublicationBlock` and `featuredPublicationsBlock` automatic branches:
     - for blog articles require `defined(slug.current)`,
     - respect `hideFromList != true` (or equivalent).

3. **Align manual mode behavior**
   - For manual publication selection, optionally exclude hidden blog entries (`hideFromList`) unless explicit editorial override is desired.
   - If override is desired, document this clearly in studio UI.

4. **Editorial UX hardening**
   - In Sanity (homepage block descriptions), explain:
     - `manual` = fixed curated items,
     - `latest` = automatic.
   - Add short instruction for editors so expected behavior is explicit.

5. **Regression tests / verification**
   - Publish a test blog article:
     - verify `/blog/` updates,
     - verify homepage publication widgets update without manual cache clear.
   - Toggle `hideFromList` and verify consistent behavior across pages.

## Acceptance criteria

- Fresh blog publish appears in homepage news/publication feed without manual intervention.
- Blog listing and homepage feed follow consistent visibility rules.
- Revalidation logs show `homePage` tag invalidated for `blog-article`.

## Risks / rollback

- **Risk:** broader revalidation increases cache churn.
- **Mitigation:** invalidate only necessary tags (`blog`, `homePage`) and keep existing reverse lookup precision.
- **Rollback:** revert dependency map entry if needed (single-line rollback).

