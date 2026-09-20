---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — source-register
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: User confirmed embeddings dashboard is unused and was setup-only
---

# Source register and evidence limits

## Official sources reviewed on 2026-09-20

| Source | Used for |
| --- | --- |
| [Legacy overview](https://www.sanity.io/docs/content-lake/embeddings-index-api-overview) | Deprecation and original architecture |
| [Dataset Embeddings](https://www.sanity.io/docs/content-lake/dataset-embeddings) | Configuration, projections, readiness and async updates |
| [Migration guide](https://www.sanity.io/docs/content-lake/migrate-from-embeddings-index-api) | Supported migration, export/cutover/cleanup, editorial gaps |
| [GROQ functions](https://www.sanity.io/docs/specifications/groq-functions) | Semantic function and scoring restrictions |
| [Search with GROQ](https://www.sanity.io/docs/content-lake/search-content-with-groq) | Lexical/semantic combination and result semantics |
| [Datasets CLI](https://www.sanity.io/docs/cli-reference/cli-datasets) | Command availability and flags |
| [API versioning](https://www.sanity.io/docs/content-lake/api-versioning) | Date pinning and added function compatibility |
| [Legacy HTTP API](https://www.sanity.io/docs/http-reference/embeddings-index) | Existing endpoint and request comparison |

The main agent read both user-linked documents in full via their official Markdown endpoints and checked the migration guide. The API research agent reviewed the additional official references. No third-party recommendation was used as API authority.

## Evidence classification

**Verified from repository:** active blog caller, disabled product semantics, response shape, candidate limit, filters, caching, package declarations, dashboard registration, schema fields and historical commits.

**Verified from documentation:** replacement API model, projection restrictions, score semantics, CLI floor, async lifecycle and missing editorial replacement support.

**Inferred risks:** long-lived cache after delayed embedding refresh; category starvation from pre-filter top 50; stale denormalized values affecting an adopted projection. These follow from code/contracts and are not reproduced production incidents.

**Initial research limits, updated below:** subsequent follow-up verified index definitions, disabled settings, successful read/legacy credentials, displayed quota and legacy query latency. Complete logs, management write grants, hosting deployment configuration and successful new semantic results remain unverified.

## Discrepancies to carry forward

- Legacy action sends `filter._type`; documentation shows `filter.type`. Do not assert an outage from this alone.
- Historical setup uses blog singleton and outdated SEO fields. Do not treat its examples or counts as production truth.
- No documented minimum API date or client-library version was established; 2026-08-21 is the migration example's pin.
- A general score-function warning conflicts with specialized semantic examples. Prefer the specialized contract and live validation.
- No fixed sunset date was found in reviewed material.

All open questions are recorded in [research.md](research.md#open-questions); validation tasks in the other documents do not imply that live inspection has occurred.

## Follow-up Research 2026-09-20T07:22:15+02:00

Evidence now includes authenticated GET settings/index definitions, published content coverage, legacy query probes, and authenticated management UI quota. Sanitized responses and configuration snapshots are saved. Previously uninspected live configuration/readiness/quota are now verified; editor non-use is now user-confirmed; full caller logs, deployed hosting credentials and new-backend quality remain unverified. One research subagent inspected installed dashboard/Assist integration in this follow-up.

See [live verification](live-verification.md), [index snapshot](legacy-indexes.snapshot.json), and [query baseline](legacy-query-baseline.md). This follow-up supersedes earlier statements that live configuration or readiness had not been inspected.

## Follow-up Research 2026-09-20T07:24:03+02:00

The user confirmed nobody uses the Studio Embeddings dashboard; they used it only to configure the original website embeddings API. This is direct user evidence, not an inference from request logs. No log download is needed to close that question. Remove the dashboard plugin and dependency during migration, preserve unrelated Assist functionality, and retain legacy backend indexes temporarily for rollback. No code or remote configuration changed in this follow-up.
