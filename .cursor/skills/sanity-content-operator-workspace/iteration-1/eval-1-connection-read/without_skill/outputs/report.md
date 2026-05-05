# Sanity Connection Baseline Eval

## Commands / Approach

- Used the repo's installed `@sanity/client` from a one-off `node --input-type=module` command.
- Parsed `apps/web/.env.local` locally in the command without printing env values.
- Created a read-only Sanity client with `useCdn: false` and ran this safe GROQ query:

```groq
*[defined(_type)]{_type}
```

- Counted returned documents by `_type` in memory. No mutation commands were run.

## Redacted Env Discovery

```json
{
  "envFile": "apps/web/.env.local",
  "projectIdPresent": true,
  "datasetPresent": true,
  "apiVersionPresent": true,
  "apiVersionDefaultUsed": false,
  "tokenPresent": true,
  "missing": []
}
```

## Query Summary

- Connection: successful.
- Returned documents: 9823.
- Unique `_type` values: 42.

| `_type` | Count |
| --- | ---: |
| award | 324 |
| blog | 1 |
| blog-article | 21 |
| blog-category | 4 |
| blogIndex | 1 |
| brand | 45 |
| brands | 2 |
| comparatorConfig | 1 |
| cpoPage | 1 |
| cpoProduct | 2 |
| faq | 6 |
| footer | 1 |
| homePage | 1 |
| navbar | 2 |
| newsletterHeroConfig | 1 |
| newsletterSettings | 1 |
| notFound | 1 |
| page | 3 |
| privacyPolicy | 1 |
| product | 925 |
| productCategories | 1 |
| productCategoryParent | 6 |
| productCategorySub | 45 |
| products | 1 |
| redirects | 1 |
| review | 928 |
| reviewAuthor | 91 |
| reviews | 1 |
| sanity.assist.task.status | 60 |
| sanity.fileAsset | 196 |
| sanity.imageAsset | 7076 |
| sanity.previewUrlSecret | 1 |
| settings | 1 |
| socialMedia | 4 |
| store | 50 |
| stores | 1 |
| system.group | 9 |
| system.release | 1 |
| system.retention | 1 |
| system.schema | 1 |
| teamMember | 3 |
| termsAndConditions | 1 |

## Blockers

None.
