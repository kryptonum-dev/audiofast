# Sanity Destructive Delete Dry Run

Dry-run only. No Sanity delete mutation was submitted.

## Target

- Project: `fsw3likv`
- Dataset: `production`
- API version: `v2025-02-10`
- Env file: `apps/web/.env.local`
- Token present: `true`

## Selector

```groq
*[_type == "landingPage" && defined(slug.current) && string::startsWith(slug.current, "test-")]
```

## Result

- Matching documents: `0`
- Sample matching documents: `[]`
- Prepared mutation count: `0`

Because no documents matched the selector, the prepared mutation payload is a no-op:

```json
{
  "mutations": []
}
```

## Saved Artifacts

- `matching-summary.query.json`
- `matching-docs.query.json`
- `delete-mutation.json`
- `delete-mutation-preview.json`
