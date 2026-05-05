# Troubleshooting

## Missing Configuration

If env values are missing:

1. Check the current working directory.
2. Run the env-check helper from the repo root and from the likely app directory.
3. If there are multiple apps, pass the intended env file with `--env-file`.
4. Check `sanity.cli.ts` and `sanity.config.ts`.
5. Ask the user where the project's Sanity env file lives.

Run:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-env-check.mjs
node .cursor/skills/sanity-content-operator/scripts/sanity-env-check.mjs --env-file apps/web/.env.local
```

## 401 Unauthorized

Likely causes:

- Missing `SANITY_AUTH_TOKEN`.
- Expired or revoked token.
- Token not loaded from the expected env file.
- Using `sanity exec` without `--with-user-token` or explicit token config.

Fix by reloading env, regenerating a token, or running `npx sanity@latest login` for interactive CLI workflows.

## 403 Forbidden

Likely causes:

- Token role lacks permission.
- Token belongs to a different project.
- Dataset or document type has restricted permissions.
- Trying to mutate with a viewer token.

Use an editor/developer/admin token only when writes are required.

## Stale Reads

If a query does not show a recent mutation:

- Use `useCdn: false`.
- Query the document endpoint by ID for direct fetches.
- Use mutation visibility options when relevant.
- Wait briefly and re-query if the search index is catching up.

## Query Errors

Check:

- GROQ syntax.
- Missing params.
- Shell quoting around `*`, `$`, and quotes.
- API version format.

When shell quoting is painful, put the query in a file or use the helper script with quoted JSON params.

## Mutation Errors

Check:

- The document exists for `patch`.
- The document has `_type` for `create`.
- `createOrReplace` has an `_id`.
- Patch paths match Sanity field paths.
- Array mutations include stable `_key` values when needed.
- `ifRevisionID` matches the current `_rev`.
