---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — current-runtime
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: Added follow-up research for confirmed decisions and live Sanity inspection
---

# Current runtime and caller inventory

## Active request flow

Manual blog submit → URL search/year parameters → `BlogListing` → legacy POST for at most 50 IDs → GROQ eligibility and card hydration → 12-item pagination.

[apps/web/src/components/ui/BlogAside/index.tsx:45](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/components/ui/BlogAside/index.tsx#L45) trims input and resets the page. Its Searchbar uses manual mode at line 108, so the shared component's default debounce does not describe blog request frequency.

[apps/web/src/app/actions/embeddings.ts:24](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/app/actions/embeddings.ts#L24) reads project/dataset and `EMBEDDINGS_INDEX_BEARER_TOKEN`; dataset defaults to production. The request selects index `blog` with type `blog-article`, or dormant `products` with type `product`. It trusts the JSON response without runtime validation. Missing configuration, HTTP errors and parse/network failures collapse to null.

The action sends `filter: {_type: [...]}`; Sanity's documented legacy example uses `filter.type`. This is a source/documentation discrepancy, not proof the deployed endpoint fails. The new explicit GROQ type filter removes it.

## Eligibility and counts

[apps/web/src/global/sanity/query.ts:1598](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/query.ts#L1598) is the shared blog eligibility filter. It requires a slug, strict false for hideFromList, matching category slug when supplied, and matching publication year with creation-date fallback.

With nonempty candidates, lexical matching is bypassed. Without candidates, name/title matching is used. [apps/web/src/global/sanity/query.ts:1643](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/query.ts#L1643) orders by candidate score; there is no explicit tie-break. All fallback scores are zero. If nonempty candidates are later entirely filtered out, lexical fallback does not run again.

Consequently, totals are bounded by the 50 candidates and may be starved by category/year exclusions. They are neither a corpus count nor proof that no relevant article exists outside the retrieved candidate set.

## Products and route reach

[apps/web/src/components/products/ProductsListing/index.tsx:82](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/components/products/ProductsListing/index.tsx#L82) always supplies an empty candidate array. [apps/web/src/global/sanity/query.ts:2103](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/query.ts#L2103) uses name prefix matching. [apps/web/src/components/products/SortDropdown/index.tsx:38](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/components/products/SortDropdown/index.tsx#L38) hides relevance sorting. Sidebar counts independently apply lexical search, so semantic activation would require coordinated changes.

Blog entry routes are [apps/web/src/app/blog/(listing)/page.tsx:106](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/app/blog/(listing)/page.tsx#L106) and [apps/web/src/app/blog/(listing)/kategoria/[category]/page.tsx:203](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/app/blog/(listing)/kategoria/[category]/page.tsx#L203). Existing search/year URL persistence and cards can stay as they are.

## Cache and failure boundaries

The legacy action has no explicit timeout or cache policy. Hydration uses the cached helper at [apps/web/src/global/sanity/fetch.ts:53](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/fetch.ts#L53), including three retries and production weeks-long caching. The common client at [apps/web/src/global/sanity/client.ts:38](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/client.ts#L38) defaults to API 2025-02-10, production CDN, published on Vercel and drafts locally.

A new semantic query needs its own cache decision. Content-change invalidation can occur before embeddings update; no second embeddings-ready invalidation was found. An uncached search path is the initial recommendation; introduce bounded caching only after measuring traffic and freshness. Keep regular browse caching intact.

All unresolved matters are centralized in [research.md](research.md#open-questions).

## Follow-up Research 2026-09-20T07:22:15+02:00

Both legacy filter spellings returned the same five results for the test input. The application credential works for the legacy endpoint. New semantic requests fail because embeddings are disabled, not because the API function is unrecognized. Product behavior remains explicitly unchanged.

See [live verification](live-verification.md), [index snapshot](legacy-indexes.snapshot.json), and [query baseline](legacy-query-baseline.md). This follow-up supersedes earlier statements that live configuration or readiness had not been inspected.
