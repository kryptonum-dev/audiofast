# Sanity Migration Script Report

## Result

Created `copy-seo-title-to-meta-title.mjs`, a dry-run-first Bun/Node script for copying `seo.title` into root `metaTitle` on Sanity post documents missing `metaTitle`.

The repo uses `blog-article` as the Sanity post document type, so the script defaults to:

- document type: `blog-article`
- source field: `seo.title`
- target field: `metaTitle`
- excluded drafts: yes, unless `--include-drafts` is passed

## Safety

- No mutations were executed.
- The script defaults to dry run and only writes when `--execute` is provided.
- Live execution requires `SANITY_API_TOKEN` or `MIGRATION_TOKEN`.
- The script logs only `Token present: true/false`; it never prints token values.

## Env Vars

The script loads repo env files when present and uses these env var fallbacks:

- project ID: `SANITY_PROJECT_ID`, `SANITY_STUDIO_PROJECT_ID`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, then `fsw3likv`
- dataset: `SANITY_DATASET`, `SANITY_STUDIO_DATASET`, `NEXT_PUBLIC_SANITY_DATASET`, then `production`
- token: `SANITY_API_TOKEN`, then `MIGRATION_TOKEN`

## Usage

Dry run:

```bash
bun .cursor/skills/sanity-content-operator-workspace/iteration-1/eval-4-migration-script/without_skill/outputs/copy-seo-title-to-meta-title.mjs
```

Generate a reviewed sample file:

```bash
bun .cursor/skills/sanity-content-operator-workspace/iteration-1/eval-4-migration-script/without_skill/outputs/copy-seo-title-to-meta-title.mjs --sample-out=.cursor/skills/sanity-content-operator-workspace/iteration-1/eval-4-migration-script/without_skill/outputs/mutation-sample.generated.json
```

Execute writes after reviewing dry-run output:

```bash
bun .cursor/skills/sanity-content-operator-workspace/iteration-1/eval-4-migration-script/without_skill/outputs/copy-seo-title-to-meta-title.mjs --execute
```

## Files

- `copy-seo-title-to-meta-title.mjs`
- `mutation-sample.json`
- `report.md`
