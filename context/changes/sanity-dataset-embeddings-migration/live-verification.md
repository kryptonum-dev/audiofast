---
date: 2026-09-20T07:22:15+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings live verification
tags: [research, sanity, embeddings, live-verification]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: User confirmed embeddings dashboard is unused and was setup-only
---

# Live verification and resolution of the four questions

## Outcome

The target dataset is **not ready for semantic GROQ search: embeddings are disabled**. This is a verified negative readiness result, not an authentication failure or an unfinished attempt. Configuration/content were not changed to manufacture a successful result.

| Original question | Resolution |
| --- | --- |
| 1. Product semantic search | User confirmed it must remain disabled. Preserve current lexical behavior. |
| 2. Actual indexes and editorial dependencies | Both live index configurations exported. Neither dereferences linked documents. User confirmed dashboard was setup-only and is unused. Remove its plugin during migration; retain backend indexes temporarily for rollback. |
| 3. Desired search behavior | User accepted filtering before top-50 selection, consistent bounded totals, lexical fallback and no guessed score threshold. |
| 4. Dataset readiness | Inspected directly: enabled=false, status=disabled; semantic query returns HTTP 400 embeddingNotEnabledError. Enablement and post-enable validation belong to implementation. |

## Environment and credential provenance

The skill's env checker selected `apps/web/.env.local`, because this is the active web integration and it contains the required Sanity configuration. `apps/studio/.env` resolves the same project `fsw3likv` and dataset `production`. These are verified local configuration targets; production hosting environment variables were not separately exported.

`SANITY_AUTH_TOKEN` successfully read management settings and legacy definitions. `NEXT_PUBLIC_SANITY_API_READ_TOKEN` successfully read published content. `EMBEDDINGS_INDEX_BEARER_TOKEN` successfully queried the legacy blog. Only names are recorded; no token values or headers are saved. For the implementation use a server-only read-token variable rather than adopting the public-prefixed convention. Successful management reads do not prove permission to enable settings.

## Observed live configuration

See [exact index snapshot](legacy-indexes.snapshot.json) and [sanitized API evidence](live-api-evidence.json).

**Blog:** active, filter `_type == 'blog-article'`.

```groq
{_type,
_id, name, title, description, keywords,
"seoTitle": seo.metaTitle, "seoDescription": seo.metaDescription}
```

**Products:** active, filter `_type=='product'`.

```groq
{_type,
_id, _type, name, subtitle}
```

Neither projection contains `->`: there is no lost reference expansion to recreate. No denormalization/backfill is needed for reference parity with these indexes. Blog body content is not currently embedded. Both filters contain only the type restriction; preserve website visibility/slug/category/year rules in the replacement.

Both index responses report zero failed and zero remaining documents. Their startDocumentCount values (20 blog / 842 products) are creation-processing metadata, not current corpus counts. Fresh published queries found 25 articles, all 25 eligible under current listing rules, and 868 products.

## Field coverage

| Blog field coverage | Published documents |
| --- | ---: |
| Total articles | 25 |
| seo.metaTitle used by legacy index | 0 |
| seo.metaDescription used by legacy index | 0 |
| Actual seo.title | 25 |
| Actual seo.description | 15 |
| Nonempty content | 25 |
| Nonempty keywords | 0 |

The old SEO aliases currently contribute no values. A compact title/description baseline preserves the effective old inputs; correcting SEO paths or adding body text must be tracked as deliberate search-quality changes and compared, not described as exact parity.

## Readiness probes

- GET dataset embeddings settings: HTTP 200, `{"enabled":false,"status":"disabled"}`. Add `disabled` to operational handling; earlier research listed only enabled-dataset statuses from documentation.
- Published content query using the available read token: HTTP 200.
- Semantic query using fixed API date `2026-08-21`: HTTP 400, `embeddingNotEnabledError`.
- Semantic query using existing API date `2025-02-10`: the same HTTP 400 and error. The old date is not the observed blocker; successful semantic execution remains untested until enablement.
- Legacy query with application `filter._type` and documentation `filter.type`: both HTTP 200 and identical five hits for the tested input. This rules out a failure for this probe, but does not prove equivalent filtering in every scenario.

No embeddings enable/disable operation, index deletion, content mutation, package change or application deployment was performed.

## Usage and request logs

Authenticated management UI shows Growth plan. Organization Embeddings Usage shows **0 / 1,000** for month to date, on a page whose metrics update daily. This is a dated allowance snapshot, not a real-time balance or promise about overage cost. [Organization usage](https://www.sanity.io/organizations/o5BEPFjvf/usage/embeddings).

Project Usage offered no existing download initially. A request-log export was generated for September 13–19 and reached available state. Download capture timed out and no export file was retrieved. Browser security rejected downloads-manager navigation; no workaround was attempted. No log entries were analyzed, so caller absence was not established from logs. Dashboard non-use was subsequently confirmed directly by the user. Export generation was the only remote job initiated; dataset configuration and content remained unchanged.

## Editorial workflow findings

A separate agent inspected source and installed packages. Studio installs dashboard 4.0.17 unconditionally and Assist 6.1.21 separately. Dashboard supports index administration and an eight-hit semantic search that opens documents for editing. No `embeddingsIndexReferenceInput`, `options.embeddingsIndex`, or `options.aiAssist.embeddingsIndex` wiring was found in Studio source.

Installed dashboard behavior is visible in `node_modules/@sanity/embeddings-index-ui/dist/index.js` around lines 19–42, 239–250, 579–596 and 1017–1024; these are local installed-package references, not repository permalinks. Source absence alone could not establish dashboard use; the user subsequently confirmed nobody uses it.

Decision for planning: retain Assist, remove the unused dashboard plugin/package during migration, and keep backend legacy indexes through cutover and rollback observation. The dashboard is not needed for rollback API calls. Deleting backend indexes remains later cleanup after validating that the website has switched and rollback is no longer needed.

## Baseline and acceptance limits

[25-query baseline](legacy-query-baseline.md) and [full results](legacy-query-baseline.json) are saved. All legacy requests succeeded. New-backend comparisons cannot run while embeddings are disabled. No application test suite or browser search regression suite was run during this research.

Research is sufficient to plan the website migration. It is not evidence that cutover is safe today. Enabling embeddings, validating the final projection/query, confirming deployment credentials and checking post-enable quality remain implementation gates.

## Follow-up Research 2026-09-20T07:24:03+02:00

The user confirmed nobody uses the Studio Embeddings dashboard; they used it only to configure the original website embeddings API. This is direct user evidence, not an inference from request logs. No log download is needed to close that question. Remove the dashboard plugin and dependency during migration, preserve unrelated Assist functionality, and retain legacy backend indexes temporarily for rollback. No code or remote configuration changed in this follow-up.
