# Access Path Decision Baseline

## Constraints Followed

- Did not use the `sanity-content-operator` skill, its references, or its scripts.
- Did not use external web/docs.
- Performed read-only Sanity access only.
- Did not print, copy, or save token values. The query artifact records only whether a token was present.

## Access Path Decisions

### One-off Document Count

For a one-off document count, I would use a direct read-only Sanity client call from the local repo environment, not a migration or application code path. The goal is a narrow inspection, so the safest path is a single GROQ count query such as `count(*[])` with no document projection and no mutation-capable workflow.

### Reusable Migration

For a reusable migration, I would use a dedicated migration script in the repo, colocated with other Studio migration tooling. A migration needs repeatability, dry-run behavior, batching, explicit write-token handling, validation, and reviewable source control history. That makes it different from an ad hoc count query even if both use the same underlying Sanity client package.

### App/Server Implementation

For app/server implementation, I would use the existing application Sanity client layer, especially `apps/web/src/global/sanity/client.ts` and `apps/web/src/global/sanity/fetch.ts`. That path already centralizes project/dataset/API version settings, perspective behavior, token handling, and Next.js caching semantics, so feature code should consume that abstraction instead of creating new clients in page or route code.

## Safe Count Read

Only the safe document-count read was run.

- Query: `count(*[])`
- Project ID: `fsw3likv`
- Dataset: `production`
- API version: `2025-02-10`
- Perspective: `published`
- CDN: disabled
- Token present: `true`
- Token value saved: `false`
- Count result: `9682`

Safe query artifact: `document-count-read.json`
