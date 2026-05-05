# Mutation Workflows

Sanity mutations require authentication and write permissions. Prefer targeted patches and transactions over whole-document replacement.

Before broad mutations or migrations, discover the real target `_type` and field shape from the dataset, schema files, or existing GROQ queries. Natural language like "posts" is not enough; one repo may use `post`, another `blog-article`, and another `article`.

## Mutation Types

The Content Lake mutation API supports:

- `create`: create a new document, failing if `_id` already exists.
- `createIfNotExists`: create only when the `_id` does not exist.
- `createOrReplace`: replace the entire document. Use with care because omitted fields are removed.
- `patch`: update parts of an existing document. Fails if the target document does not exist.
- `delete`: delete by ID or by GROQ query.

Multiple mutations in one request are transactional: either all succeed or none are applied.

## Patch Operations

Common patch operations:

```json
{
  "mutations": [
    {
      "patch": {
        "id": "post-123",
        "set": {
          "title": "New title"
        },
        "unset": ["deprecatedField"],
        "setIfMissing": {
          "status": "draft"
        }
      }
    }
  ]
}
```

Supported patch operations include `set`, `setIfMissing`, `unset`, `inc`, `dec`, `insert`, and `diffMatchPatch`.

## Recommended Patch Flow

1. Query the target document and include `_id`, `_rev`, and fields being changed.
2. Build the smallest patch payload possible.
3. Preview the current value and intended value.
4. Use `ifRevisionID` when concurrent changes would matter.
5. Execute the mutation.
6. Re-query and verify.

## HTTP Mutation Endpoint

Submit mutations to:

```text
POST https://{projectId}.api.sanity.io/{apiVersion}/data/mutate/{dataset}
Authorization: Bearer {SANITY_AUTH_TOKEN}
Content-Type: application/json
```

The helper script defaults to dry-run output and only commits when `--execute` is present:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-mutate.mjs --mutation-file ./mutation.json
node .cursor/skills/sanity-content-operator/scripts/sanity-mutate.mjs --mutation-file ./mutation.json --execute
```

## JavaScript Client Pattern

```ts
const result = await client
  .transaction()
  .patch('post-123', (patch) =>
    patch.ifRevisionId(previousRev).set({title: 'New title'})
  )
  .createIfNotExists({_id: 'settings', _type: 'settings'})
  .commit()
```

Use `client.patch(id).set(...).commit()` for one document and `client.transaction()` when multiple mutations must succeed together.

## Migration Script Standard

A reusable migration script should:

- Read project config from env variables or an explicit `--env-file`.
- Print the selected project/dataset/API version and token presence only.
- Discover or accept the target `_type`; avoid hardcoded defaults unless the prompt explicitly provides them.
- Query count plus a small sample before building mutations.
- Default to dry-run and require `--execute` for writes.
- Write a mutation payload or sample output file for review.
- Use `_rev` / `ifRevisionID` when patching documents fetched earlier.
- Avoid embedding tokens or project secrets in the script.
