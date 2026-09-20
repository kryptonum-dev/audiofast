---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — migration-impact
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: User confirmed embeddings dashboard is unused and was setup-only
---

# Migration impact inventory

| File / area | Proposed treatment | Reason |
| --- | --- | --- |
| [apps/web/src/app/actions/embeddings.ts:15](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/app/actions/embeddings.ts#L15) | Replace active usage with server-only semantic search; retain legacy path temporarily for rollback | Only active caller is server-rendered blog |
| [apps/web/src/components/blog/BlogListing/index.tsx:39](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/components/blog/BlogListing/index.tsx#L39) | Normalize input, separate browse/search, preserve result shape | Currently orchestrates two sequential requests |
| [apps/web/src/global/sanity/query.ts:1598](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/query.ts#L1598) | Replace legacy candidate-dependent blog fragments | Filters, totals and ranking must agree |
| [apps/web/src/global/types.ts:49](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/types.ts#L49) | Remove legacy response shape after cutover | No permanent pointer adapter needed |
| [apps/web/src/global/sanity/fetch.ts:53](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/fetch.ts#L53) | Keep ordinary caching; add isolated search policy | Avoid global cache changes |
| [apps/web/src/global/sanity/client.ts:38](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/client.ts#L38) | Keep global defaults; dedicated search client | Limit API/perspective regression surface |
| [apps/web/src/components/products/ProductsListing/index.tsx:82](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/components/products/ProductsListing/index.tsx#L82) | Preserve lexical behavior; remove obsolete reactivation comments when legacy API retires | Intentional feature state |
| [apps/web/src/global/sanity/query.ts:2147](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/src/global/sanity/query.ts#L2147) | Audit dormant product candidate/score branches before cleanup | Avoid changing product filters or sort contracts |
| [apps/studio/sanity.config.ts:2](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/sanity.config.ts#L2) | Remove unused dashboard during migration; user confirmed setup-only use | Deprecated integration |
| [apps/studio/package.json:27](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/package.json#L27) and bun.lock | Remove old UI package together | Reproducible dependency cleanup |
| [turbo.json:11](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/turbo.json#L11) and apps/web/.env.example | Add server-only query configuration; remove legacy token after rollback window | Deployment env must match runtime |
| apps/web/src/global/sanity/sanity.types.ts | Regenerate from changed queries | Do not hand-edit generated contracts |
| README.md and CODEBASE_OVERVIEW.md | Update semantic-search description and credentials | Existing docs imply active product semantics |

## Operational dependencies

Studio and web resolve dataset/project from separate environment names. Compare actual deployed targets before enabling or switching. Build validation currently checks payment settings, so it is not proof of embeddings readiness.

Retain `assist()` independently of dashboard cleanup. No schema-level custom Assist reference configuration was found, and the user confirmed nobody uses the dashboard; it served only initial index setup.

No frontend styling changes are needed for a behavior-preserving migration. No checkout, pricing, cart, media or newsletter redesign is in scope. Preserve shared publication card projections.

## Existing source guidance

[apps/web/AGENTS.md:1](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/web/AGENTS.md#L1) requires reading the installed Next.js guide before implementation because this project uses a newer release. This research does not alter Next.js code. During planning, apply that rule to the chosen cache and server-helper implementation.

## Follow-up Research 2026-09-20T07:22:15+02:00

User confirmed products stay lexical. Dashboard/package removal is in migration scope following user confirmation. Backend index deletion remains deferred until after the rollback window. Preserve assist(). Add a reviewed dataset-enablement step because live embeddings are disabled, and preserve server-only token handling. Source/config inspection and live credentials do not verify hosting environment values.

See [live verification](live-verification.md), [index snapshot](legacy-indexes.snapshot.json), and [query baseline](legacy-query-baseline.md). This follow-up supersedes earlier statements that live configuration or readiness had not been inspected.

## Follow-up Research 2026-09-20T07:24:03+02:00

The user confirmed nobody uses the Studio Embeddings dashboard; they used it only to configure the original website embeddings API. This is direct user evidence, not an inference from request logs. No log download is needed to close that question. Remove the dashboard plugin and dependency during migration, preserve unrelated Assist functionality, and retain legacy backend indexes temporarily for rollback. No code or remote configuration changed in this follow-up.
