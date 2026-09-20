---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — research
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: User confirmed embeddings dashboard is unused and was setup-only
---

# Research: migrate Audiofast to Sanity dataset embeddings

**Date:** 2026-09-20T07:08:52+02:00  
**Researcher:** Codex  
**Git Commit:** 39f135155b56f17212e85fe73669f31d84515366  
**Branch:** main  
**Repository:** audiofast

## Research Question

Open a new change for migrating the existing Sanity Embeddings Index integration to Dataset Embeddings; use multiple research agents and produce comprehensive supporting files.

## Summary

The active migration target is blog search. Products intentionally stopped calling embeddings; their text search and sidebar filtering should remain intact. Three parallel agents investigated runtime behavior, schemas/operations/history, and official Sanity APIs. The parent verified key code, historical commits, documentation, and the synthesis.

Recommended direction: replace the blog's two-stage candidate lookup/document fetch with a dedicated server-side semantic GROQ search returning the existing article/card shape. Retain the ordinary cached newest-first listing for blank searches, explicit lexical fallback, and current visibility/category/year rules. Keep a bounded result set initially, but apply filters before selecting candidates. The user confirmed product search stays disabled and accepted filter-first bounded top-50 search with fallback. Implementation has not started.

Live index projections are now exported and contain no reference expansion. The verified blocker is disabled dataset embeddings; remaining risks are long-lived app caching and unintended changes to product/editorial behavior.

## Detailed Findings

### Runtime and behavior

- [apps/web/src/app/actions/embeddings.ts:15](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/app/actions/embeddings.ts#L15) selects `products` or `blog`, requests 50 candidates, and returns legacy ID/score objects or null.
- The only active caller is [apps/web/src/components/blog/BlogListing/index.tsx:42](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/components/blog/BlogListing/index.tsx#L42). Its follow-up GROQ fetch applies filters and pagination.
- [apps/web/src/global/sanity/query.ts:1600](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/query.ts#L1600) restricts articles by slug, strict `hideFromList == false`, category and year. With candidates, their IDs replace lexical matching. The count covers eligible candidates, not the entire corpus.
- [apps/web/src/components/products/ProductsListing/index.tsx:82](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/components/products/ProductsListing/index.tsx#L82) explicitly disables embeddings. Simply uncommenting that code would still intersect semantic results with the product name filter.
- [apps/web/src/global/sanity/fetch.ts:65](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/fetch.ts#L65) caches production results for weeks. Moving semantic ranking under that helper could retain pre-refresh results long after embeddings catch up; this is an architectural inference, not a reproduced incident.

### Replacement contract

Dataset embeddings use semantic scoring inside GROQ, replacing named-index requests. See [API contract](api-contract.md) for sourced differences and requirements; the source is Sanity's [migration guide](https://www.sanity.io/docs/content-lake/migrate-from-embeddings-index-api).

An isolated search client avoids changing global API-version, draft and CDN behavior across checkout and other consumers. Do not reuse the public-prefixed read-token convention for new privileged credentials. No arbitrary score cutoff exists in current application code to preserve.

### Content and operations

Studio registers the deprecated dashboard at [apps/studio/sanity.config.ts:35](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/sanity.config.ts#L35), separately from Assist. Current document types and fields differ from historical setup examples. The actual legacy configuration is now exported in legacy-indexes.snapshot.json; the follow-up records effective indexed fields and deliberate quality improvements separately.

## Code References

| Evidence | Meaning |
| --- | --- |
| [apps/web/src/global/types.ts:49](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/types.ts#L49) | Legacy response contract |
| [apps/web/src/global/sanity/query.ts:1643](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/query.ts#L1643) | Blog ranking and count |
| [apps/web/src/global/sanity/query.ts:2103](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/query.ts#L2103) | Product name matching |
| [apps/web/src/components/ui/BlogAside/index.tsx:108](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/components/ui/BlogAside/index.tsx#L108) | Manual search submission |
| [apps/studio/schemaTypes/documents/collections/blog-article.ts:16](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/schemaTypes/documents/collections/blog-article.ts#L16) | Actual article schema |
| [apps/studio/utils/denormalize-product.ts:34](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/utils/denormalize-product.ts#L34) | Existing local reference-text materialization |
| [turbo.json:11](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/turbo.json#L11) | Legacy credential build environment |

## Architecture Insights

Keep search-result eligibility, ordering, count and paging tied to the same candidate population. Normalize input once, choose browse/search explicitly, score before card projection, and use stable ordering for pagination. A temporary legacy-shape adapter is possible, but a permanent adapter would preserve extra requests and conceal the new contract.

Public search should explicitly use published content. An embedding projection controls semantic input; it is not an access-control filter. The application's category/year/visibility rules must still apply to every search and fallback path.

## Historical Context (from prior changes)

No `context/foundation/lessons.md` or `context/archive/` existed at research time. Existing change research does not document this migration.

- [Original integration commit](https://github.com/kryptonum-dev/audiofast/commit/4166139) introduced the legacy action and dashboard in November 2025.
- [Product search change](https://github.com/kryptonum-dev/audiofast/commit/4bc98daff58bb085105313f497fe068c0935f812) deliberately switched products to text search and matching sidebar counts in February 2026.
- [.ai/embeddings-search-implementation-plan.md:74](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/.ai/embeddings-search-implementation-plan.md#L74) contains stale examples, including `_type == 'blog'`; actual articles are `blog-article`. Its processed-document counts are historical, not current production measurements.

## Related Research

- [YouTube publications](../youtube-publications/research.md): shared publication rendering and content-type history. Live code takes precedence over this older document.
- [Current runtime](current-runtime.md)
- [API contract](api-contract.md)
- [Projection and content](projection-design.md)
- [File and dependency impact](migration-impact.md)
- [Behavior recommendations](search-behavior-decisions.md)
- [Validation matrix](validation-matrix.md)
- [Rollout and rollback](rollout-and-rollback.md)
- [Source register and evidence limits](source-register.md)

## Research Boundaries

Only documentation was created. No application code, dataset configuration, content, tokens, dependencies or deployment was changed. Initial research ran no runtime tests. Follow-up performed read-only API probes and a 25-query legacy baseline; no application test suite or new-backend success benchmark was run. Existing modifications to `apps/web/next-env.d.ts`, `apps/web/src/generated/redirects.ts`, and `.playwright-mcp/` were left untouched. The TaskCreate/TaskUpdate tools were unavailable; three collaboration tasks supplied parallel research instead.

## Decisions confirmed by the user

1. Product semantic search remains disabled.
2. Inspect the actual Sanity setup; completed with exported index definitions and readiness probes. User subsequently confirmed the dashboard was only used for initial setup; remove its plugin during migration while retaining indexes temporarily for rollback.
3. Filter before selecting the top 50, keep coherent totals and lexical fallback, and do not invent score thresholds.
4. Verify readiness directly; completed with a negative result: embeddings are disabled.

## Open Questions

No open questions — research is decision-complete for implementation planning. Dataset enablement, successful semantic queries and cutover checks remain implementation tasks.

## Follow-up Research 2026-09-20T07:22:15+02:00

Live project `fsw3likv`, dataset `production`: both legacy indexes active; neither dereferences references. Dataset embeddings settings return enabled=false/status=disabled; semantic GROQ returns embeddingNotEnabledError on both tested API dates. Published reads and legacy search credentials work. Organization UI displays 0/1,000 monthly embeddings usage (daily reporting).

The blog's SEO aliases point to fields absent on all 25 published articles. All 25 articles contain body content, which the legacy index omits. No reference-text backfill is needed for parity. Preserve the compact baseline first; evaluate corrected SEO/body inclusion explicitly.

All 25 curated legacy queries succeeded; 22/23 title-derived expected documents appeared in the top five. The irrelevant soup query still produced audio results. These are not analytics-derived searches or human-approved acceptance results.

At the time of the live inspection, dashboard usage was unconfirmed. The user subsequently confirmed nobody uses it; it was only an initial setup tool. Log retrieval remains incomplete but is no longer needed to resolve editorial usage. Backend index cleanup still follows cutover and rollback validation.

- [Live verification](live-verification.md)
- [Legacy index snapshot](legacy-indexes.snapshot.json)
- [Sanitized API evidence](live-api-evidence.json)
- [Query baseline](legacy-query-baseline.md)
- [Full baseline results](legacy-query-baseline.json)

No settings/content were changed. A request-log export job was generated. Readiness must be rechecked after enablement during implementation; current research does not authorize or claim a successful cutover.

## Follow-up Research 2026-09-20T07:24:03+02:00

The user confirmed nobody uses the Studio Embeddings dashboard; they used it only to configure the original website embeddings API. This is direct user evidence, not an inference from request logs. No log download is needed to close that question. Remove the dashboard plugin and dependency during migration, preserve unrelated Assist functionality, and retain legacy backend indexes temporarily for rollback. No code or remote configuration changed in this follow-up.
