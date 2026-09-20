---
change_id: sanity-dataset-embeddings-migration
title: Migrate semantic search to Sanity dataset embeddings
status: implemented
created: 2026-09-20
updated: 2026-09-20
archived_at: null
implementation_base: 39f135155b56f17212e85fe73669f31d84515366
views: []
---

## Notes

Migrate the current embedding index logic to the new logic proposed by Sanity. Use multiple research subagents and produce comprehensive research with supporting files.

Legacy documentation: https://www.sanity.io/docs/content-lake/embeddings-index-api-overview
Replacement documentation: https://www.sanity.io/docs/content-lake/dataset-embeddings

## Confirmed scope and live follow-up

- Product semantic search stays disabled (user decision).
- Blog search filters before top-50 selection; preserve coherent paging and lexical fallback (user decision).
- Live production dataset inspected: new embeddings disabled; enablement and successful query validation belong to implementation.
- Legacy configurations exported; neither expands references. Remove the unused dashboard plugin during migration; retain Assist and keep legacy indexes temporarily for rollback.
- See research.md and live-verification.md for evidence, baseline results and the resolved editorial-usage decision.

## Follow-up Research 2026-09-20T07:24:03+02:00

The user confirmed nobody uses the Studio Embeddings dashboard; they used it only to configure the original website embeddings API. This is direct user evidence, not an inference from request logs. No log download is needed to close that question. Remove the dashboard plugin and dependency during migration, preserve unrelated Assist functionality, and retain legacy backend indexes temporarily for rollback. No code or remote configuration changed in this follow-up.
