# 04. Pozycjonowanie - typy produktow (brak kontroli linkow i naglowkow)

## Client context (mail)

> "Na podstronach typow w ogole nie mamy wplywu na hyperlinki i naglowki. Opis kategorii nie pozwala na tworzenie linkow wewnetrznych oraz oznaczanie H1, H2 itp."

## Root diagnosis

## Confirmed in schema

In `apps/studio/schemaTypes/documents/collections/product-category-sub.ts`:

- Category `title` allows only:
  - style: `normal`
  - no annotations
- Category `description` allows only:
  - style: `normal`
  - decorators only (`strong`, `em`)
  - no annotations

So editor complaint is correct: CMS currently blocks links and heading semantics in those fields by schema design.

## Frontend capability check

- Category page uses `HeroStatic` with `PortableText` rendering.
- Renderer can already output portable text content; the bottleneck is schema constraints, not frontend rendering architecture.

## Fix plan (step-by-step)

1. **Expand portable text capabilities for category fields**
   - Update `product-category-sub.ts`:
     - `title` styles: include at least `normal`, `h2`, `h3` (avoid `h1` inside title field to keep one-page-H1 strategy controlled).
     - `description` styles: include `normal`, `h2`, `h3`.
     - annotations: include `customLink`.

2. **Define content governance rules**
   - Keep a clear policy:
     - primary page H1 is managed by page hero heading,
     - editor can use H2/H3 in category body text.
   - Add schema descriptions so editors know intended usage.

3. **Frontend validation**
   - Verify links from category description render correctly and are clickable.
   - Verify heading hierarchy remains logical (`h1` from page hero, subordinate headings in text body).

4. **SEO QA**
   - Crawl sample category pages and confirm:
     - internal links visible in rendered HTML,
     - heading tree is valid and not duplicated at H1 level.

## Acceptance criteria

- Editor can add internal links in category text.
- Editor can add subheadings (`h2`/`h3`) in category content.
- Category pages render these semantics correctly on frontend.
- SEO audit no longer flags "no internal linking control in category content".

## Risks / rollback

- **Risk:** editors may overuse heading levels.
- **Mitigation:** add short editorial guidance in field descriptions.
- **Rollback:** revert style/annotation allowances in one schema file if necessary.

