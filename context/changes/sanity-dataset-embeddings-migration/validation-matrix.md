---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — validation-matrix
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: Added follow-up research for confirmed decisions and live Sanity inspection
---

# Validation matrix for the implementation phase

The implementation matrix below remains unexecuted except the read-only follow-up probes listed at the end. Existing source analysis found no dedicated embeddings/blog-search tests. The repository already provides Vitest and Playwright; use focused coverage rather than a new framework.

| Case | Expected evidence |
| --- | --- |
| Missing/blank/whitespace query | No semantic call; normal newest-first browse |
| Manual search submit | URL updated once, page reset, year retained |
| Conceptual Polish query without title overlap | Useful article can appear semantically |
| Diacritics, brand and exact model | Human-reviewed relevance; exact identifiers not lost |
| Irrelevant query | Documented outcome; no invented score cutoff |
| Category/year | Filtering precedes top-50 selection |
| Relevant document below previous global top 50 | Can enter selected category's result set |
| 0 / 1 / 12 / 13 / 50 / >50 eligible documents | Correct bounded count and page slices |
| Equal scores | Stable ordering across page requests |
| Hidden, missing-slug, draft documents | Excluded from public search and fallback |
| Missing hideFromList value | Preserve current strict-false policy unless explicitly changed |
| Missing publishedDate | Year/date fallback to creation time remains |
| Failure, timeout, bad response, unauthorized | Useful lexical fallback and safe diagnostic |
| Genuine empty response | Declared fallback runs; distinct from upstream failure internally |
| Content write before embeddings refresh | Results recover after refresh without weeks of stale cache |
| Referenced brand/category update | Any adopted local searchable values remain synchronized |
| Long article / custom text block | Deliberate coverage; inspect matched content during quality review |
| Product searches | Same prefix match, sorts, filters and sidebar counts; no semantic request |
| Studio after dashboard cleanup | Assist, structure, Vision and media still work |

## Relevance corpus

Use 20–30 real queries from application analytics or stakeholder examples, with expected helpful document IDs and exclusions. Synthetic starting categories: amplifier choice, turntable setup, speaker placement, exact brand/model, Polish diacritics, rare topic, nonsense phrase. These are categories for fixtures, not claims those documents exist.

Record old/new top results, human assessment, latency and fallback status. Do not compare numerical score magnitudes across backends. Sanity request logs help inventory callers but do not provide query strings from POST bodies; application analytics must supply those.

## Appropriate verification commands

After implementation: run focused web Vitest tests, web/studio type checks and lint, regenerate Sanity schema/types if queries change, then web/Studio builds and browser smoke tests on blog/category routes. Available scripts are in [apps/web/package.json:5](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/package.json#L5) and [apps/studio/package.json:8](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/package.json#L8). Use existing package manager Bun.

Live readiness/query tests are required separately: a mock cannot prove embedding enablement, real GROQ behavior or search quality. Do not run unrelated payment integration tests simply because the monorepo includes them.

## Evidence to retain

Save fixture IDs/results, exact query and projection revision, fixed API date, target dataset, readiness check time, benchmark environment, and pass/fail notes. Capture no tokens. Cutover acceptance should include zero visibility leaks, coherent paging, reviewed relevance, measured latency and recovery after indexing lag.

## Follow-up Research 2026-09-20T07:22:15+02:00

Read-only live probes and all 25 curated legacy requests have now run. See live-verification.md for exact pass/fail status and legacy-query-baseline.md for results. New-backend, post-write freshness, >50 fixtures and application/browser regressions remain unexecuted. The earlier matrix is still the implementation checklist, not a completed test report.

See [live verification](live-verification.md), [index snapshot](legacy-indexes.snapshot.json), and [query baseline](legacy-query-baseline.md). This follow-up supersedes earlier statements that live configuration or readiness had not been inspected.
