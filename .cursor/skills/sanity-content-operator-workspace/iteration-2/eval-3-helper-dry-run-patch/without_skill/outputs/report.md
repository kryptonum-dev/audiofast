# Settings Announcement Helper Dry Run

Loaded local Sanity environment configuration and read the singleton settings document.

- Project ID: `fsw3likv`
- Dataset: `production`
- API version: `2025-02-10`
- Token present: `true`
- Query: `*[_type == "settings"][0]{_id,_type,_rev,_updatedAt,_createdAt,announcement}`
- Document ID: `settings`
- Document type: `settings`
- Revision: `70dHOGscnIYmrjTPueQcgB`
- Current `announcement`: `null`

Prepared a dry-run patch to set `announcement.enabled` to `false` and `announcement.text` to `Maintenance window tonight`. The mutation was not submitted.

Artifacts:

- `env-check.json`
- `settings-read.json`
- `settings-announcement-diff-preview.json`
- `settings-announcement-diff-preview.md`
- `settings-announcement-patch.json`
- `settings-announcement-mutation-dry-run.json`
