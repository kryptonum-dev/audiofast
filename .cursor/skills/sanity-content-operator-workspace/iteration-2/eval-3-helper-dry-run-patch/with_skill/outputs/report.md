# Helper Dry-Run Settings Patch

## Environment

- Env check used `apps/web/.env.local`.
- Project ID: `fsw3likv`
- Dataset: `production`
- API version: `v2025-02-10`
- Token present: `true`
- Source variables: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION`, `SANITY_AUTH_TOKEN`

## Singleton Read

- Query: `*[_type == "settings"] | order(_updatedAt desc)[0]{_id,_type,_rev,_updatedAt,announcement}`
- Found singleton document `_id: settings`.
- Revision used for optimistic locking: `70dHOGscnIYmrjTPueQcgB`.
- Current `announcement` value: `null`.

## Prepared Patch

The targeted dry-run patch sets only:

- `announcement.enabled` -> `false`
- `announcement.text` -> `Maintenance window tonight`

The mutation payload includes `ifRevisionID` with the fetched revision.

## Dry-Run Confirmation

No mutation was submitted. The mutation helper was run without `--execute`, and the saved mutation dry-run artifact reports `dryRun: true`.

The diff preview artifact was sanitized to keep only the preview metadata, changed paths, and resulting `announcement` value, avoiding unrelated document fields.

## Saved Artifacts

- `sanity-env-check.json`
- `settings-query.json`
- `settings-read.json`
- `settings-announcement-patch.json`
- `settings-announcement-mutation.json`
- `settings-announcement-diff-preview.json`
- `settings-announcement-mutation-dry-run.json`
