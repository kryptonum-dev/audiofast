# Sanity dataset embeddings migration — Plan Brief

> Full plan: [plan.md](plan.md)
> Research: [research.md](research.md)

## What & Why

Move active blog search from Sanity's deprecated named-index API to dataset embeddings and semantic GROQ. Preserve the site's existing interface and product text search while fixing when category/year filters are applied.

## Starting Point

Blog search currently requests 50 candidate IDs and filters them afterwards. Dataset embeddings are verified disabled; two legacy indexes are active. The unused Studio dashboard was only used for initial setup.

## Desired End State

Blog searches filter eligible published articles before ranking, then paginate one bounded set of up to 50 results. Failures recover through lexical search. Products remain text-only; Studio retains Assist and its other tools.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Products | Keep semantic search disabled | Preserve intentional search/filter behavior | User |
| Result population | Filter first, cap 50, page by 12 | Counts and pages describe the same eligible set | User |
| Recovery | Lexical fallback, no score cutoff | Scores are relative, and outages need recovery | User / Research |
| Studio dashboard | Remove plugin; retain Assist | Nobody uses the dashboard | User |
| Content coverage | Keep effective legacy inputs first | Isolate API migration from relevance expansion | Plan, following Research |
| Client | Dedicated published, uncached client | Avoid shared-client changes and stale results | Plan |
| Rollout | Explicit legacy/dataset/lexical switch | Stage code and preserve recovery | Plan |
| Index retirement | Defer until after observation | Keep a working rollback path | Research / Plan |

The content-coverage choice is a planning default, not an additional user confirmation. Article bodies and corrected SEO fields can be evaluated separately.

## Scope

**In scope:**

- Versioned dataset projection, settings/readiness tooling and server-only credentials.
- Blog semantic query, lexical fallback, deterministic pagination and focused tests.
- Dashboard dependency removal, live validation, cutover and rollback documentation.

**Out of scope:**

- Product semantic search, visual redesign, content backfills and broader indexing.
- Hybrid ranking, guessed confidence thresholds and global dependency upgrades.
- Legacy resource deletion during the initial migration.

## Architecture / Approach

A server-only service selects the configured backend. Dataset mode queries up to 50 complete article cards in one uncached published-content request, then derives total and page. Blank searches keep existing cached browsing. Explicit lexical mode also works if the deprecated service disappears.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Configuration | Projection, operations tooling and rollback switch | Target/credential mistakes |
| 2. Blog integration | Direct semantic query, fallback and tests | Filtering, cache or pagination errors |
| 3. Studio cleanup | Deprecated dashboard removed | Unrelated plugin/dependency changes |
| 4. Live cutover | Ready dataset, measured results and deployed verification | API readiness and relevance |

**Prerequisites:** Repository tooling, a published-read credential, dataset-settings write access for phase 4 and deployment access. Read access has been verified; settings writes and deployed credentials have not.
**Estimated effort:** Approximately 2–3 implementation sessions plus live verification; one week of observation precedes a separate retirement action.

## Open Risks & Assumptions

- New semantic queries cannot succeed until dataset embeddings are enabled; this remains an implementation task.
- The 25-query curated baseline is useful comparison evidence, not analytics or human-approved relevance criteria.
- Current quota is limited; cap comparison requests and avoid duplicating every visitor query.
- Embedding refresh is asynchronous. Uncached reads avoid additional weeks-long application staleness.

## Success Criteria (Summary)

- Blog filtering, totals, pagination and fallback pass focused tests and real API checks.
- Product text search and Studio editing remain intact; deployed blog traffic uses dataset embeddings.
- Rollback works, evidence is saved and legacy resources remain available during observation.
