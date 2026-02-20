# 03. Problem ze specyfikacja (EPHONO+)

## Client context (mail)

> "Nie publikuje sie tabelka ze specyfikacja dla produktu EPHONO+. Nie wiemy dlaczego."

## Root diagnosis

## What is confirmed in code

- Product page renders `TechnicalData` only if `product.technicalData` exists in `apps/web/src/app/produkty/[slug]/page.tsx`.
- `TechnicalData` component immediately returns `null` when:
  - no `data`,
  - no `groups`,
  - `groups.length === 0`,
  - or all groups have zero rows.
- Query includes technical data projection in `apps/web/src/global/sanity/query.ts`, so frontend is ready to render if data shape is valid.

## Most likely failure modes (ranked)

1. **Data shape is present but empty at runtime**
   - `technicalData.groups` exists, but groups/rows are empty.
2. **Rows exist but cells are effectively empty**
   - table appears "missing" because component only renders meaningful row structures.
3. **Editor saved data in old/legacy shape**
   - migrated content may not match expected `variants/groups/rows/values/content`.
4. **Product slug mismatch in report**
   - provided URL may not map to current product slug; we could not confirm live EPHONO+ URL directly from production.

## Confidence level

- **High confidence** in rendering gates.
- **Medium confidence** in exact EPHONO+ record root cause (requires inspecting that product document in Sanity).

## Fix plan (step-by-step)

1. **Inspect EPHONO+ document in Sanity (Technical Data tab)**
   - Verify:
     - `technicalData.groups` has entries,
     - each group has at least one row,
     - each row has `title`,
     - each row has `values` array aligned to variants (or one value for non-variant products).

2. **Add temporary runtime diagnostics (staging)**
   - In product page / `TechnicalData`, log normalized technical data for EPHONO+ slug.
   - Confirm whether data is absent, malformed, or filtered out.

3. **Harden UI feedback (avoid silent fail)**
   - Replace hard `null` return with controlled fallback in non-production (or editor debug mode):
     - "Dane techniczne sa puste lub niekompletne."
   - This reduces future silent incidents.

4. **Add schema-level guardrails in studio**
   - In `product` schema, add validation:
     - if `technicalData` exists, require at least one group with at least one row.
   - Optionally add custom validation ensuring each row has at least one non-empty value.

5. **Migration/repair utility (if needed)**
   - If malformed rows are common, create one-off migration script to normalize `technicalData` shape.

## Acceptance criteria

- EPHONO+ page shows "Dane techniczne" section with expected rows.
- Product publish in studio is blocked when technical data is present but structurally invalid.
- No silent disappearances of technical table in similar products.

## Risks / rollback

- **Risk:** strict validation can block editing for legacy records.
- **Mitigation:** introduce validation as warning first, then switch to error after cleanup.
- **Rollback:** keep validation warning-only until dataset is normalized.

