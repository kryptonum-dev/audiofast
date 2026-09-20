---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — rollout-and-rollback
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: User confirmed embeddings dashboard is unused and was setup-only
---

# Rollout and rollback research

This is a proposed operational sequence, not an executed migration or a formal implementation plan.

## Establish the baseline

Read and preserve actual legacy index configuration plus current dataset embeddings settings. Inventory all callers using source and request logs. Confirm deployed web and Studio point to the intended dataset. Record filters, projection fields, reference expansion and editorial use; do not reconstruct production settings from historical examples.

Confirm management access separately from the application's read-only query credential. Check real quota and expected request volume before enabling shadow traffic. Do not print token values in artifacts.

## Prepare and validate

Create reviewed dataset projection configuration and application changes. Test the direct search path behind an explicit deployment switch, retain lexical fallback, and preserve the legacy implementation for temporary rollback. Verify CLI binary and a fixed semantic-client API date independently of global clients.

Enable only the intended dataset after reviewing existing shared configuration. Wait for ready, then run published-content queries and the validation matrix. Avoid broad content backfills unless proven necessary for reference parity.

## Cut over

Compare representative old/new results first. If shadowing is used, sample requests to bound query usage; do not duplicate every request indefinitely. Switch blog traffic once eligibility, relevance, latency, fallback and pagination are validated. Monitor error/fallback rate, latency, result behavior, embedding update lag and write performance.

Keep rollback as a deploy/config change while the legacy endpoint remains available. If it is unavailable or already retired, lexical fallback is the independent recovery path. Do not assume the deprecated service can be recreated later.

## Cleanup

Sanity recommends retaining the old index during rollout and observing a week of full traffic before deletion, checking log coverage for truncation. Deletion removes the index's generated webhook; disabling dataset embeddings would instead destroy the new feature's computed data. See [migration guide](https://www.sanity.io/docs/content-lake/migrate-from-embeddings-index-api).

After verified zero legacy use, remove old index resources, obsolete custom indexing hooks, token deployment entries, rollback code and stale docs. Keep the website's content revalidation webhook: it also handles unrelated cache and denormalization work. Remove only hooks proven to exist exclusively for retired indexing.

## Rollback checklist

- Restore legacy routing while index and token still work; otherwise switch to lexical search.
- Clear or version changed search caches where needed.
- Keep new dataset embeddings enabled while diagnosing, avoiding a needless rebuild.
- Preserve query/projection revisions and diagnostics for a repeatable retry.
- Delay irreversible cleanup until the rollback window closes; editorial dashboard use has been resolved by user confirmation.

## Follow-up Research 2026-09-20T07:22:15+02:00

Baseline export and target confirmation are complete. The new feature is disabled, so enablement/readiness is the next implementation prerequisite. Current organization display is 0/1,000 monthly queries (daily reporting); account for comparison traffic. Remove the unused dashboard plugin during migration; retain Assist and backend legacy indexes through rollback observation. Log export was generated but not retrieved; no zero-traffic conclusion is justified.

See [live verification](live-verification.md), [index snapshot](legacy-indexes.snapshot.json), and [query baseline](legacy-query-baseline.md). This follow-up supersedes earlier statements that live configuration or readiness had not been inspected.

## Follow-up Research 2026-09-20T07:24:03+02:00

The user confirmed nobody uses the Studio Embeddings dashboard; they used it only to configure the original website embeddings API. This is direct user evidence, not an inference from request logs. No log download is needed to close that question. Remove the dashboard plugin and dependency during migration, preserve unrelated Assist functionality, and retain legacy backend indexes temporarily for rollback. No code or remote configuration changed in this follow-up.
