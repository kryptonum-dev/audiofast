# Sanity Migration Script Report

Created a reusable one-off migration script for copying `seo.title` into `metaTitle` for documents missing `metaTitle`.

## Outputs

- `copy-seo-title-to-meta-title.mjs`: standalone migration script.
- `mutation-sample.json`: example mutation payload shape.

## Safety

- Read and followed the skill instructions, including auth/env, mutation workflow, and bulk safety references.
- Ran the skill env check against `apps/web/.env.local`; result: `ok: true`, dataset `production`, tokenPresent: `true`.
- No token value was printed, copied, or saved.
- The script defaults to dry-run mode and requires `--execute` before submitting any mutation.
- No mutations were executed.

## Script Behavior

- Defaults to `_type == "post"`, source field `seo.title`, and target field `metaTitle`.
- Supports future reuse through `--document-type`, `--source-field`, `--target-field`, `--limit`, `--batch-size`, `--env-file`, and `--mutation-file`.
- Uses `_rev` with `ifRevisionID` in each patch.
- Writes the generated mutation payload to a local JSON file during dry-run.

## Validation

- `node --check copy-seo-title-to-meta-title.mjs` passed.
- No linter diagnostics were reported for the script.
