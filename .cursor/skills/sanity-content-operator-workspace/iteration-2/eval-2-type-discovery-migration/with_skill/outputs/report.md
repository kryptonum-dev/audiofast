# Eval 2: Type Discovery Migration

## Summary

Completed a dry-run-only Sanity migration plan for copying `seo.title` to root `metaTitle` on blog posts where `metaTitle` is missing. No mutation endpoint was called and no content changes were made.

## Skill And Env

- Read and followed `.cursor/skills/sanity-content-operator/SKILL.md`.
- Also followed `references/auth-and-env.md`, `references/read-workflows.md`, and `references/safety-rules.md`.
- Env check used the bundled helper: `node .cursor/skills/sanity-content-operator/scripts/sanity-env-check.mjs`.
- Selected env source: `/Users/oliwiersellig/Kryptonum/audiofast/apps/web/.env.local`.
- Project: `fsw3likv`, dataset: `production`, API version: `v2025-02-10`.
- Token source: `SANITY_AUTH_TOKEN`; `tokenPresent: true`. No token value was printed or saved.

## Type Discovery

The actual blog post document type is `blog-article`, not `post`.

Evidence:

- Local schema defines `blogArticle` with `name: "blog-article"` in `apps/studio/schemaTypes/documents/collections/blog-article.ts`.
- Local web GROQ queries use `_type == "blog-article"` for blog routes, listings, SEO, and sitemap behavior.
- Dataset candidate counts returned `blogArticle: 21`, `blogSingleton: 1`, and `post: 0`.

Saved discovery output: `type-discovery.query.json`.

## Dry-Run Migration Shape

Target selector:

```groq
*[
  _type == "blog-article" &&
  !(_id in path("drafts.**")) &&
  defined(seo.title) &&
  !defined(metaTitle)
]
```

Counts from the dataset:

- Published total: `19`
- Eligible published documents: `19`
- Eligible including drafts: `21`
- Already has `metaTitle`: `0`
- Missing `seo.title`: `0`

Patch shape:

```json
{
  "patch": {
    "id": "<document-id>",
    "ifRevisionID": "<document-rev>",
    "setIfMissing": {
      "metaTitle": "<seo.title>"
    }
  }
}
```

`setIfMissing` and `_rev` optimistic locking keep the dry-run payload narrow and avoid overwriting a concurrently added `metaTitle`.

Note: the current Studio SEO helper defines `seo.title`; I did not find a schema field named `metaTitle`. The migration still targets root `metaTitle` because that was the requested destination field.

## Outputs

- `copy-seo-title-to-meta-title.mjs`: reusable dry-run migration script. It rejects `--execute`.
- `type-discovery.query.json`: env, local evidence, unique type list, and candidate type counts.
- `eligible-documents-sample.query.json`: count query and sample eligible documents.
- `mutation-sample.json`: safe sample mutation payload for five documents.

Verification run:

```bash
node .cursor/skills/sanity-content-operator-workspace/iteration-2/eval-2-type-discovery-migration/with_skill/outputs/copy-seo-title-to-meta-title.mjs --limit 5 --mutation-file mutation-sample.generated.json
```

The script reported `dryRun: true` and `message: "No mutations were submitted."` The temporary generated mutation file was removed after creating the normalized `mutation-sample.json` artifact.
