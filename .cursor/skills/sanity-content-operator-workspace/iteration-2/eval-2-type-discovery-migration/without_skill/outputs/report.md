# Iteration 2 Eval 2: Type Discovery Migration Baseline

## Summary

- Completed without using the `sanity-content-operator` skill or its reference/scripts.
- Discovered the blog post document type as `blog-article`, not `post`.
- Created a reusable dry-run migration script that reads matching documents and writes patch payload samples only.
- No Sanity mutations were executed.

## Type Discovery Evidence

Local schema/query evidence:

- `apps/studio/schemaTypes/documents/collections/blog-article.ts` defines `name: "blog-article"` with title `Wpis na blogu`.
- `apps/web/src/global/sanity/query.ts` uses `_type == "blog-article"` for blog slugs, blog detail pages, listings, categories, and year navigation.
- The schema also has a `blog` singleton and `blog-category` collection, so the article document type is specifically `blog-article`.

Dataset read evidence from safe GROQ:

```json
{
  "blogArticleCount": 21,
  "blogSingletonCount": 1,
  "legacyPostCount": 0,
  "schemaEvidence": "apps/studio/schemaTypes/documents/collections/blog-article.ts defines name: blog-article"
}
```

## Dry-Run Migration

Script:

- `copy-blog-seo-title-to-meta-title.mjs`

Behavior:

- Loads Sanity config from normal project environment variables and local env files.
- Uses read-only GROQ fetches against the configured dataset.
- Selects `blog-article` documents where `seo.title` is defined and `metaTitle` is missing.
- Writes a `mutation-sample.json` artifact using `setIfMissing` patches.
- Contains no mutation commit path.

Run performed:

```sh
node copy-blog-seo-title-to-meta-title.mjs --out-dir=/Users/oliwiersellig/Kryptonum/audiofast/.cursor/skills/sanity-content-operator-workspace/iteration-2/eval-2-type-discovery-migration/without_skill/outputs
```

Result:

```json
{
  "dryRun": true,
  "mutationExecuted": false,
  "documentType": "blog-article",
  "candidateCount": 19,
  "config": {
    "projectId": "fsw3likv",
    "dataset": "production",
    "apiVersion": "2025-02-10",
    "tokenPresent": true
  }
}
```

## Saved Artifacts

- `copy-blog-seo-title-to-meta-title.mjs`
- `type-discovery.query.groq`
- `type-discovery-result.json`
- `migration-candidates.query.groq`
- `migration-candidates.json`
- `mutation-sample.json`
- `report.md`

