# 05. Blad w CMS - walidacja blokuje publish kategorii

## Client context (mail)

> "Nie moge opublikowac strony 'Odtwarzacze i transporty CD/SACD'. Nie wiem dlaczego, przycisk Publish nieaktywny."

## Root diagnosis

This is very likely a **schema validation blocker** (not a frontend bug). In this codebase, category publish can be blocked by several rules simultaneously.

## Confirmed validation constraints for `productCategorySub`

- `parentCategory` is required.
- `slug` must:
  - start with `/kategoria/`,
  - include non-empty content after prefix,
  - end with trailing slash `/`,
  - match strict slugify output.
- hidden `customFilters` field has validation:
  - filter names must be unique.

Any one of the above can disable Publish.

## High-probability root causes for this specific category

1. **Slug formatting conflict** around `CD/SACD`
   - if slug was manually edited with extra slash semantics, strict slug validation can fail.
2. **Hidden custom filter validation failure**
   - duplicate filter names in hidden `customFilters` can block publish while being easy to miss from standard content tab.
3. **Missing parent category reference**
   - still possible if content was duplicated/migrated.

## Confidence level

- **High confidence** that this is schema validation and not publishing infrastructure.
- **Medium confidence** on which exact field fails without opening this specific document in studio.

## Fix plan (step-by-step)

1. **Immediate diagnosis in studio**
   - Open category document.
   - Check validation panel and hidden-tab-managed fields (`Konfiguracja filtrow`).
   - Confirm:
     - `parentCategory` present,
     - slug valid and trailing slash present,
     - no duplicate `customFilters.name`.

2. **Make validation errors easier to understand**
   - Add explicit, user-facing error messages in custom filters view (not only schema-level hidden field errors).
   - Surface slug hint examples in `PathnameFieldComponent` for category documents.

3. **Reduce false-negative blocking**
   - If duplicate filter names are common during edits, temporarily downgrade to warning while editor fixes data.
   - Keep strict error in CI/content governance after cleanup.

4. **Add operational runbook**
   - Short internal checklist for "Publish inactive":
     - required refs,
     - slug format,
     - hidden custom filter duplicates.

## Acceptance criteria

- Category `Odtwarzacze i transporty CD/SACD` can be published successfully.
- Editor can clearly see which field blocks publish.
- No "silent" hidden-field validation blockers for future category edits.

## Risks / rollback

- **Risk:** loosening validation can permit inconsistent filter config.
- **Mitigation:** temporary warning mode + scheduled cleanup + re-enable strict mode.

