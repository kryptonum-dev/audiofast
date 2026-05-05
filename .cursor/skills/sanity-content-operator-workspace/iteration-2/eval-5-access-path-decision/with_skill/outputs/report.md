# Access Path Decision Report

## Scope

- Skill used: `/Users/oliwiersellig/Kryptonum/audiofast/.cursor/skills/sanity-content-operator`
- External docs used: none
- Mode: read-only
- Sanity mutation executed: no

## Environment Discovery

The skill's local env check selected:

- Env file: `/Users/oliwiersellig/Kryptonum/audiofast/apps/web/.env.local`
- Project ID source: `NEXT_PUBLIC_SANITY_PROJECT_ID`
- Dataset source: `NEXT_PUBLIC_SANITY_DATASET`
- API version source: `NEXT_PUBLIC_SANITY_API_VERSION`
- Token source: `SANITY_AUTH_TOKEN`
- Token present: true

No token value was printed, copied, or saved.

## Access Path Choices

### One-off document count

For a quick human one-off, the Sanity CLI document query path is suitable because it is simple and direct for a narrow GROQ read like `count(*)`. For this eval, I used the skill's bundled `sanity-query.mjs` helper instead of the raw CLI because the task is agent-run and eval-like; the helper performs local env discovery, uses the Content Lake query endpoint, and keeps token handling redacted.

### Reusable migration

For a reusable migration, I would use a dedicated migration script or the skill's mutation helpers rather than a CLI one-liner. The script should load project config from env, print only project/dataset/API version and token presence, query a count and small sample first, default to dry-run, save the planned mutation payload or sample output, and require an explicit `--execute` flag for writes. For patches based on fetched state, it should include `_rev` / `ifRevisionID` when conflicts matter.

### App/server implementation

For app or server code, I would use the repo's Sanity client path, such as `@sanity/client` or the existing `next-sanity` integration, because application code needs a maintained API surface, shared configuration, typed queries, caching decisions, and server-only token handling. Public cacheable reads can use CDN behavior where appropriate; fresh reads, private reads, drafts, or mutation-adjacent workflows should use non-CDN reads and keep tokens out of frontend bundles.

## Safe Read Performed

Query:

```groq
count(*)
```

Result:

```json
9823
```

Saved query artifact: `document-count-query.json`
