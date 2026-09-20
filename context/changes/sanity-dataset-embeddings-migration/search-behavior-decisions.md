---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — search-behavior-decisions
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: User confirmed embeddings dashboard is unused and was setup-only
---

# Proposed search behavior decisions

The user confirmed product search stays disabled and accepted filter-first bounded top-50 search with lexical fallback and no numeric threshold. Other technical choices below remain planning recommendations. The user also confirmed the dashboard is unused; its plugin can be removed during migration.

| Concern | Current | Recommended baseline |
| --- | --- | --- |
| Products | Text-only by explicit prior change | Keep text-only |
| Blank input | Truthy URL check can disagree with trimmed action input | Normalize once; empty means cached newest-first browse |
| Blog eligibility | Slug + hideFromList strict false + category/year | Preserve these and any additional exported legacy restrictions |
| Candidate selection | Top 50 globally, then filter | Filter first, then top 50 |
| Pagination total | Eligible members of candidate list | Count the same bounded set being paginated |
| Semantic ordering | Legacy score, no explicit tie-break | New score with stable ID tie-break |
| Fallback ordering | Scores all zero | Publication date then ID |
| API error vs empty | Both collapse to [] | Distinguish internally; preserve user-facing lexical fallback |
| Cache | New candidates then cached hydration | Initially uncached semantic read; normal browse unchanged |
| Input boundary | Compile-time types only | Validate type, normalize, bound length and pagination |

## Result-set contract

The initial recommendation is a top-50 discovery result set after category/year/visibility filtering. It deliberately improves recall within a selected category while retaining bounded paging. Compute count and pages from one candidate population; do not present all article count as semantic match count. At 12 per page, 50 results means five pages, with two on the final page.

Semantic ranking is not a boolean relevance test. An unrelated query may still yield ranked documents; an empty API response is a different condition from a human finding all returned results irrelevant. Do not add `_score > 0`, a legacy cutoff, or a guessed confidence threshold to force empty states. Acceptance fixtures must characterize this behavior before launch.

## Direct query versus adapter

A direct domain query is the recommended end state because only one active caller needs migration. A temporary adapter can support staged comparison, but keeping the existing 50-ID hydration design permanently preserves unnecessary coupling. A single query should score candidates once where possible and derive the requested page/count coherently; validate the final GROQ structure against Sanity rather than treating a sketch as executable proof.

## Keyword scoring

Start with the baseline and evaluate actual Polish queries, brand names and model identifiers. Add lexical scoring only for demonstrated ranking gaps. Keep token normalization and substring/prefix semantics deliberate; the existing product name-prefix search is not interchangeable with a new lexical query parser. [Search with GROQ](https://www.sanity.io/docs/content-lake/search-content-with-groq) explains the available scoring model.

## Failure and diagnostics

A service failure should produce bounded lexical fallback and a structured diagnostic that does not expose credentials or raw upstream bodies. Timeout/retry behavior should fit a page response budget. Use an internal server-only helper unless a client-callable action is actually needed. Distinguish disabled/misconfigured, unavailable, empty and successful states in tests and telemetry.

## Follow-up Research 2026-09-20T07:22:15+02:00

Product-disabled and filter-first/top-50/fallback recommendations are now user-confirmed. The live blog corpus has only 25 eligible articles, so >50 behavior needs a controlled test. An unrelated soup query already yields legacy results; absence of an empty state is not uniquely a regression of the new backend. Remove the unused dashboard plugin during migration, preserving backend indexes temporarily for rollback.

See [live verification](live-verification.md), [index snapshot](legacy-indexes.snapshot.json), and [query baseline](legacy-query-baseline.md). This follow-up supersedes earlier statements that live configuration or readiness had not been inspected.

## Follow-up Research 2026-09-20T07:24:03+02:00

The user confirmed nobody uses the Studio Embeddings dashboard; they used it only to configure the original website embeddings API. This is direct user evidence, not an inference from request logs. No log download is needed to close that question. Remove the dashboard plugin and dependency during migration, preserve unrelated Assist functionality, and retain legacy backend indexes temporarily for rollback. No code or remote configuration changed in this follow-up.
