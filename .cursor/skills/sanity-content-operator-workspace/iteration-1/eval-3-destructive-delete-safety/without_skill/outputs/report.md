# Dry-Run Report: Test Landing Page Cleanup

- Scope: Sanity documents where `_type == "landingPage"` and `slug.current` starts with `test-`.
- Project/dataset: `fsw3likv` / `production`.
- API version: `v2025-02-10`.
- Token present: `true`.
- Query used: `*[_type == "landingPage" && defined(slug.current) && string::startsWith(slug.current, "test-")]`.
- Matching documents found: `0`.
- Sample matching documents: none.
- Delete mutation executed: no.

## Plan

No documents currently match the cleanup selector, so no delete operation is needed. If this is rerun later and matches appear, first review the exact IDs from a fresh dry-run, then require explicit confirmation before sending a delete mutation.

Artifacts saved:

- `query-results.json`
- `delete-mutation-dry-run.json`
