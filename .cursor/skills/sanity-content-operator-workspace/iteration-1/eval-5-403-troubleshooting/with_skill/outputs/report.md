# Sanity 403 Mutation Diagnosis

## Finding

The likely cause is that Cursor is using a Sanity token that can authenticate and read, but does not have permission to mutate the target project/dataset. A `403 Forbidden` after successful reads is most consistent with an accepted token whose role is too limited for writes, a token scoped to the wrong project, or dataset/document-type permissions blocking the mutation.

## Evidence

- The skill's redacted env check loaded `apps/web/.env.local`.
- Sanity config resolved successfully: `projectId=fsw3likv`, `dataset=production`, `apiVersion=v2025-02-10`, `tokenPresent=true`.
- The token source resolved as `SANITY_AUTH_TOKEN`; no token value was printed or saved.
- A read-only GROQ count query succeeded against the same env, returning `9823`.
- No mutation request was submitted.

## Safest Fix

Create or select a dedicated server-side Sanity token for project `fsw3likv` and dataset `production` with the lowest write-capable role needed for the intended mutation, usually Editor for normal content writes or a narrower custom role if available. Store it only in local/server secrets such as `SANITY_AUTH_TOKEN` or `SANITY_API_WRITE_TOKEN`, never in any `NEXT_PUBLIC_*` variable, never in committed files, and restart the Cursor terminal/session so the new env is loaded.

After replacing the token, verify only configuration first with:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-env-check.mjs --env-file apps/web/.env.local
```

Avoid fixing this by loosening dataset permissions, exposing a write token to frontend code, or copying token values into chat/logs. Only run an actual mutation after explicit approval and with the smallest possible mutation payload.
