---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — api-contract
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: Added follow-up research for confirmed decisions and live Sanity inspection
---

# Sanity API migration contract

## Verified mapping

| Legacy | Replacement |
| --- | --- |
| Named `blog` / `products` indexes | One dataset configuration; application queries select types |
| POST returning ID/score pointers | GROQ returning projected documents |
| Separate document hydration | Filter, score, slice and project together |
| Reference expansion in embedding projection | Local document fields only |
| Legacy score scale | Query-relative opaque `_score` |
| Legacy dashboard / CLI package | Dataset settings / Sanity CLI; editorial features need separate assessment |

Sanity's [migration guide](https://www.sanity.io/docs/content-lake/migrate-from-embeddings-index-api) documents this mapping, requires Sanity >=5.18.0 / CLI >=6.2.0, and shows a server client using a read token, published perspective, no CDN, and API date 2026-08-21. That date is an example, not a stated minimum.

## Query requirements

`text::semanticSimilarity($search)` belongs inside `score()`. Score before projecting cards. Bound the response, parameterize input, and add a deterministic ID tie-break where pagination needs it. Never interpret `_score` as confidence or compare it between queries. See [GROQ functions](https://www.sanity.io/docs/specifications/groq-functions).

For Audiofast, replace the legacy return type at [apps/web/src/global/types.ts:49](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/types.ts#L49) with a domain result that can distinguish success, empty and unavailable. A temporary compatibility shape may ease rollout, but final blog code should not depend on `value.documentId`.

## Dataset control plane

Settings use GET/PUT `/projects/:projectId/datasets/:name/settings/embeddings`; enabling is asynchronous, with `updating`, `ready` and `error` states. The projection is shared by the dataset, updates lag document writes, and long documents may be truncated after the current ten-chunk limit. See [Dataset Embeddings](https://www.sanity.io/docs/content-lake/dataset-embeddings).

Read-only status example for later preflight:

```sh
sanity datasets embeddings status production --project-id PROJECT_ID
```

Use the actual deployment dataset/project, not an assumed production name. CLI flags are documented in [Datasets CLI](https://www.sanity.io/docs/cli-reference/cli-datasets). No commands here were executed.

## Local compatibility

Root declares CLI ^8.2.1; Studio declares Sanity ^6.10.1; web declares client ^7.26.2. These declared versions exceed the documented CLI floor; no wholesale dependency upgrade is indicated by this research. Verify the actual binary during implementation.

Pin a dedicated semantic client to a tested fixed API date. Sanity can add GROQ functions to older APIs, so the common client's older date alone does not prove incompatibility. See [API versioning](https://www.sanity.io/docs/content-lake/api-versioning).

The general function-reference warning about score allowing only boost conflicts with that page's specialized semantic examples. Follow the specialized contract and validate against Content Lake; a local parser alone cannot prove service support.

## Follow-up Research 2026-09-20T07:22:15+02:00

Live settings add an observed `disabled` state to the operational contract. Both API dates 2025-02-10 and 2026-08-21 recognize the semantic query sufficiently to return embeddingNotEnabledError. No successful semantic query is claimed; enablement remains an implementation gate.

See [live verification](live-verification.md), [index snapshot](legacy-indexes.snapshot.json), and [query baseline](legacy-query-baseline.md). This follow-up supersedes earlier statements that live configuration or readiness had not been inspected.
