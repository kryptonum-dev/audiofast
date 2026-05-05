# Settings Announcement Dry Run

## Environment

- Dataset read used the configured Sanity environment from `apps/web/.env.local`.
- Project ID: `fsw3likv`
- Dataset: `production`
- API version: `v2025-02-10`
- Token present: `true`

## Singleton Read

- Query: `*[_type == "settings"] | order(_updatedAt desc)[0]{_id,_type,_rev,_updatedAt,announcement}`
- Found singleton document `_id: settings`.
- Revision used for optimistic locking: `70dHOGscnIYmrjTPueQcgB`.
- Current `announcement` value: `null`.

## Prepared Patch

The dry-run mutation payload targets only:

- `announcement.enabled` -> `true`
- `announcement.text` -> `Holiday shipping starts today`

No mutation was submitted. The dry-run helper was run without `--execute`.

## Saved Artifacts

- `settings-read.json`
- `settings-announcement-patch.json`
- `settings-announcement-mutation.json`
- `settings-announcement-diff-preview.json`
- `settings-announcement-mutation-dry-run.json`
