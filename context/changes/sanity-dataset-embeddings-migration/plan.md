# Sanity dataset embeddings migration — Implementation Plan

## Overview

Migrate active blog search from Sanity's deprecated named Embeddings Index API to semantic GROQ over dataset embeddings. Preserve product text search, the existing blog presentation and lexical recovery. Complexity: medium; the main risks are result-set consistency, cache freshness and operational cutover, rather than schema changes.

This plan builds on the completed research and the user's four resolved decisions. No code, dependency, dataset setting or deployment is changed by planning. Content coverage follows the research recommendation: preserve the effective legacy inputs first. This is a planning default, not a new user confirmation; full-body and corrected SEO indexing are deferred.

## Current State Analysis

- `apps/web/src/components/blog/BlogListing/index.tsx:42` is the only active legacy caller. It gets up to 50 IDs before fetching eligible articles, which can discard relevant category/year matches prematurely.
- `apps/web/src/global/sanity/query.ts:1600` supplies visibility/category/year rules and card projection. The strict `hideFromList == false` rule also excludes missing values. Year uses `coalesce(publishedDate, _createdAt)`.
- `apps/web/src/global/sanity/fetch.ts:65` caches production results for weeks. New semantic reads must not enter this cache. The ordinary blank-search listing can retain it.
- `apps/web/src/global/sanity/client.ts` has shared API-date, draft and CDN choices affecting other features; isolate the semantic client instead of modifying those defaults.
- `apps/web/src/components/products/ProductsListing/index.tsx:82` intentionally disables embeddings. Its name-prefix search and sidebar counts must remain consistent.
- `apps/studio/sanity.config.ts:35` registers an unused legacy dashboard independently of Assist. The user confirmed it was only used for initial setup.
- Verified target: project `fsw3likv`, dataset `production`. On 2026-09-20 dataset embeddings were disabled; both legacy indexes were active. Management reads succeeded, but write access and successful semantic queries remain unverified.
- The 25 published articles are all eligible. Legacy projection includes name/title/description/keywords, no body or reference expansion; SEO aliases resolve to absent fields. No content backfill is required.
- The 25-query baseline is curated, not analytics-derived or human-approved. Expected title-derived IDs appeared in the top five for 22 of 23 such cases. Irrelevant input already yields ranked results.

## Desired End State

Nonblank public blog searches use published semantic GROQ, with eligibility applied before ranking and the top 50. One bounded result array supplies total and pages of 12; deterministic ties keep pagination stable. Blank input retains newest-first browse. Failures and genuinely empty semantic arrays recover through eligible lexical search.

The Studio dashboard package is removed; Assist and the other Studio tools remain. Products issue no semantic requests. A temporary server-side switch permits legacy or lexical recovery, and old indexes remain during observation. Live readiness, API correctness and deployed behavior are evidenced separately from mocked tests.

## What We're NOT Doing

- Enabling product semantic search, changing product filters/sorts, or redesigning search UI.
- Indexing article bodies, corrected SEO fields, product references or new denormalized fields.
- Adding hybrid lexical boosts, numerical relevance cutoffs, analytics infrastructure or traffic-wide shadow queries.
- Upgrading Sanity/Next globally or changing the common Sanity client's behavior.
- Deleting legacy indexes/tokens/webhooks before the observation window, or disabling dataset embeddings as cleanup.
- Recovering the optional request-log download; dashboard usage is already settled by the user.

## Implementation Approach

Use a server-only blog search service returning the existing article-card shape plus bounded total and internal backend/outcome metadata. Keep GROQ definitions in the existing typegen-scanned `global/sanity` directory and reuse the publication projection. Dataset mode uses one fresh query for at most 50 projected cards, then slices the requested page in application code. This avoids independently scoring count and results.

Introduce `SANITY_BLOG_SEARCH_BACKEND=legacy|dataset|lexical`. Missing means legacy during rollout; invalid values fail the deployment preflight and recover to lexical at runtime with a sanitized warning. Dataset failures go directly to lexical, avoiding silent extra calls to the deprecated API. The legacy mode keeps the existing two-stage path temporarily; it intentionally retains the old filter-after-candidates limitation.

The dedicated dataset/lexical client uses fixed API date `2026-08-21`, `perspective: published`, `useCdn: false`, a server-only `SANITY_API_READ_TOKEN`, explicit uncached fetches, and no automatic retries. It does not require a management token. Use a 3-second semantic request deadline, followed by at most one 3-second lexical attempt. Treat these as initial engineering budgets to measure during live validation.

Normalize search with trim once; blank means browse. For nonblank input over 256 characters use bounded lexical search with the first 256 characters and an internal input-limit outcome; preserve the user's URL/display text. Normalize page to a positive safe integer, otherwise 1. Keep category/year values parameterized and existing route semantics. Do not interpolate query text into GROQ.

Lexical recovery preserves `[name, pt::text(title)] match $search`, applies the same eligibility, orders by coalesced publication date descending then `_id` ascending, and caps at 50. If both backends fail, use the existing route error boundary rather than misrepresenting an outage as zero matches. A page beyond the candidate count is empty without starting another fallback search.

## Critical Implementation Details

### Query ordering and score meaning

Apply eligibility to source documents, then `score(text::semanticSimilarity($search))`, then order by `_score desc, _id asc`, then `[0...50]`, and only then project the card fields. Score magnitudes are opaque; even zero or negative values must not be treated as a relevance threshold. Distinguish an empty candidate array from an empty requested page.

### Cache and indexing lifecycle

Article revalidation can happen before new embeddings are ready. Keep nonblank searches outside `sanityFetch`'s `use cache` boundary and outside the Sanity CDN. The listing already awaits request search parameters under route Suspense; retain that boundary and validate with the installed Next build. No global rendering/cache override is necessary.

### Shared dataset configuration

The dataset has one embedding projection. Re-read and snapshot current settings before writing; if another actor has configured it since research, reconcile the new setting rather than overwriting it blindly. Planned projection is `{_type == "blog-article" => {name, title, description, keywords}}`. No `->`, product branch, metadata IDs or previously empty SEO aliases are needed for the effective content baseline. Enablement is asynchronous; an accepted update is not readiness.

## Phase 1: Prepare configuration and rollback controls

### Overview

Commit the target projection and safe operating controls without changing live settings or default traffic.

### Changes Required:

#### 1. Versioned projection and operations entry point

**File**: `apps/studio/config/dataset-embeddings.json` (new), `apps/studio/scripts/dataset-embeddings.ts` (new).

**Design**: none — dataset configuration and operator tooling.

**Intent**: Make the projection reproducible and make live inspection, explicit enablement and readiness polling repeatable.

**Contract**: Provide read-only `status` and `check` commands, an explicit `apply` command for enabled=true plus the versioned projection, and bounded `wait` polling (5-second intervals, maximum 10 minutes). Require explicit project/dataset matching `fsw3likv/production` for apply; obtain management credentials only in the script. Save sanitized before/after settings and fail on error/timeout. Never expose a disable/delete operation in this migration script. Reapplying identical ready configuration is a no-op.

#### 2. Server-only configuration

**File**: `apps/web/src/global/sanity/blog-search-config.ts` (new), `turbo.json`.

**Design**: none — server configuration.

**Intent**: Allow staged deployment and independent recovery without changing shared clients.

**Contract**: Centralize backend selection, fixed API date, 50-candidate/12-page limits and request deadlines. Add the backend selector to Turbo environment handling; `SANITY_API_READ_TOKEN` is already listed. Read credentials lazily so ordinary browsing and legacy deployments do not fail merely because dataset mode is not configured. Dataset mode requires the server-only read token; never fall back to a management token.

#### 3. Operating instructions

**File**: `context/changes/sanity-dataset-embeddings-migration/operations.md` (new).

**Design**: none — operator documentation.

**Intent**: Document exact script commands, environment ownership and rollback steps before any setting changes.

**Contract**: Include `Preflight`, `Enable and wait`, `Cutover`, `Rollback` and `Deferred retirement` sections. Distinguish local, preview and deployed production configuration. Backend changes may require a deployment/restart; never promise instantaneous environment switching. Keep token values out of files and command output.

### Success Criteria:

#### Automated Verification:

- Configuration checks pass: add focused config tests and run `bun run --cwd apps/web test:run src/global/sanity/blog-search-config.test.ts`; cover missing/invalid modes and credential isolation.
- Read-only preflight succeeds: run the new status/check commands against the intended target, recording settings and permission limitations without issuing a PUT.

#### Manual Verification:

- Review the operations document's target and projection before later execution; no settings are enabled in this phase.

## Phase 2: Integrate and test bounded blog search

### Overview

Build and wire the new search path while retaining legacy as the deployment default.

### Changes Required:

#### 1. Semantic and lexical queries

**File**: `apps/web/src/global/sanity/query.ts`, `apps/web/src/global/sanity/sanity.types.ts` (generated), `apps/studio/schema.json` (only if extraction changes it).

**Design**: none — data queries reuse the current publication/card projection.

**Intent**: Add direct semantic and fallback queries with one authoritative result population.

**Contract**: Add named typegen-discoverable queries alongside existing blog queries. Preserve strict visibility, slug, category and year logic. Semantic order and slice follow the ordering contract above; lexical recovery has the same eligibility and cap. Retain browse and legacy queries for compatibility. Generate types; do not manually edit generated definitions or propagate unrelated schema churn. If semantic function inference is unsupported, keep a narrowly validated typed boundary using the existing generated card type, and document the limitation without using `any`.

#### 2. Search service and listing integration

**File**: `apps/web/src/global/sanity/blog-search.ts` (new), `apps/web/src/components/blog/BlogListing/index.tsx`, `apps/web/src/app/actions/embeddings.ts` (temporary rollback path).

**Design**: none — existing card, empty-state, filter and pagination markup is retained; only data loading changes.

**Intent**: Route searches through explicit backend selection and consistent paging, while leaving cached browsing intact.

**Contract**: The service accepts normalized search/category/year/page and returns projected articles, bounded total and internal outcome. Validate response shape and IDs; malformed responses trigger lexical recovery. Dataset and lexical calls are uncached, published-only and abortable. Keep the legacy action usable only by explicit legacy mode, with a finite deadline and safe error logging. Strip backend diagnostics from rendered props. Warn on failure with backend, outcome, sanitized status and elapsed time; do not log raw queries, tokens or upstream bodies. Keep existing URL/page-reset behavior and route Suspense boundaries. Product code remains disabled and unchanged.

#### 3. Behavioral coverage

**File**: `apps/web/src/global/sanity/blog-search.test.ts` (new), `apps/web/src/components/blog/BlogListing/index.test.tsx` (new), existing MSW test support as needed.

**Design**: none — tests.

**Intent**: Exercise outcomes that can break discovery, leak unpublished content or cause incorrect pagination.

**Contract**: Cover blank/whitespace no-call behavior; invalid/large pages; oversized input; 0/1/12/13/50/>50 results; tie stability; genuine empty vs out-of-range page; malformed responses; timeout/401/429/5xx; missing credentials; double failure; and backend selection. Assert no semantic retry and no management credential use. Assert query filter/score/slice ordering with controlled fixtures; do not claim mocked tests prove Sanity's semantic execution. Include product regression assertions showing no embeddings call and unchanged text/filter results, using existing test seams instead of UI snapshots.

### Success Criteria:

#### Automated Verification:

- Search behavior tests pass: `bun run --cwd apps/web test:run src/global/sanity/blog-search-config.test.ts src/global/sanity/blog-search.test.ts src/components/blog/BlogListing/index.test.tsx` plus any focused product regression test added in this phase.
- Generated types and web checks pass: `bun run --cwd apps/studio type`, `bun run --cwd apps/web check-types`, and `bun run --cwd apps/web lint`; inspect generated diffs for unrelated changes.
- Production rendering builds: `bun run --cwd apps/web build` with the required environment; verify nonblank search remains under Suspense and no new search secret reaches client bundles.

#### Manual Verification:

- Browse, search, category/year changes and page links preserve the current interface and URL behavior.
- Forced lexical mode provides useful recovery; invalid pages do not trigger misleading new result sets.

## Phase 3: Remove the unused Studio dashboard

### Overview

Remove the deprecated setup UI independently of backend retirement.

### Changes Required:

#### 1. Plugin and dependency cleanup

**File**: `apps/studio/sanity.config.ts`, `apps/studio/package.json`, `bun.lock`.

**Design**: none — remove an unused plugin registration; no custom screen redesign.

**Intent**: Stop shipping the deprecated dashboard while preserving editorial tooling and rollback indexes.

**Contract**: Remove only `embeddingsIndexDashboard()` and `@sanity/embeddings-index-ui`; keep Assist, structure, Vision and media. Update the lockfile with Bun, without unrelated upgrades. This makes no remote API/index/webhook deletion.

#### 2. Correct current documentation

**File**: `README.md`, `CODEBASE_OVERVIEW.md`, `context/changes/sanity-dataset-embeddings-migration/operations.md`.

**Design**: none — documentation.

**Intent**: Replace stale product-semantic and named-index setup guidance with the staged blog migration and rollback contract.

**Contract**: Describe product text search, server-only dataset credentials, temporary legacy mode, and the fact that plugin removal does not remove backend indexes. Keep research snapshots unchanged as historical evidence.

### Success Criteria:

#### Automated Verification:

- Studio checks pass: `bun run --cwd apps/studio check-types`, `bun run --cwd apps/studio lint`, and `bun run --cwd apps/studio build`.
- Dependency removal is complete: inspect `bun.lock` and Studio sources to confirm no legacy dashboard registration or package remains, while Assist stays registered.

#### Manual Verification:

- Studio loads and its document editing, Assist, Vision and media tools remain available.

## Phase 4: Validate live behavior and cut over

### Overview

Enable the versioned dataset projection, prove the new backend works, then route blog traffic to it. This phase performs operational changes during implementation, not during planning; deployment and environment access must be available. A missing capability is recorded precisely and is not replaced with a claim of successful cutover.

### Changes Required:

#### 1. Live comparison tooling and evidence

**File**: `apps/web/scripts/verify-blog-search.ts` (new), `context/changes/sanity-dataset-embeddings-migration/implementation-validation.md` (new), `context/changes/sanity-dataset-embeddings-migration/dataset-query-results.json` (new sanitized output).

**Design**: none — live verification and evidence.

**Intent**: Validate the real query language, readiness and results that mocks cannot establish.

**Contract**: Consume the existing 25-query baseline without relabeling it as production analytics. Record target, API date, projection revision, timestamp, top IDs, elapsed time and fallback outcome, never tokens. Compare result membership/rank rather than score magnitudes. Default the script to dataset-only reads; explicit comparison can use the retained legacy baseline instead of spending duplicate queries. Bound comparison traffic to 75 semantic requests for this run, with no automated shadow traffic.

#### 2. Enablement and deployment

**File**: `apps/studio/config/dataset-embeddings.json`, `context/changes/sanity-dataset-embeddings-migration/operations.md`, deployment environment `SANITY_BLOG_SEARCH_BACKEND` and `SANITY_API_READ_TOKEN`.

**Design**: none — remote configuration and rollout.

**Intent**: Switch only after the configured dataset is ready and the application can query it with the deployed read credential.

**Contract**: Verify local/preview/production target and credential presence without exposing values. Snapshot settings, apply the reviewed configuration and wait for ready. Run live queries with the application read token. Exercise category/year/visibility rules against live data; use deterministic >50 fixtures in tests because production has only 25 articles, and do not create synthetic production content. Deploy prepared code initially in legacy mode, then set dataset mode and deploy/restart as required. Verify the deployed route, not merely a local environment file. Keep legacy tokens/indexes and dataset settings enabled throughout rollback drills.

#### 3. Recovery and observation handoff

**File**: `context/changes/sanity-dataset-embeddings-migration/operations.md`, `context/changes/sanity-dataset-embeddings-migration/implementation-validation.md`.

**Design**: none — operational evidence.

**Intent**: Leave an actionable recovery path and a bounded retirement policy.

**Contract**: Prove legacy mode still works and lexical mode works independently before final dataset cutover. Record readiness, success/fallback counts and latency; repeated timeout/authorization/schema failures or any visibility leak prevent cutover and retain/restore legacy. Record regressions among the 22 prior top-five title matches individually; material relevance regressions retain legacy until resolved, without opportunistically changing projection or adding boosts. Observe one week of full traffic before a separate retirement action. Zero legacy use needs caller/traffic evidence, not the unused-dashboard statement alone. Only then remove legacy adapter/types/env, old indexes and indexing-only hooks; preserve the website revalidation webhook and new dataset embeddings. This deferred destructive cleanup is outside this plan's completion state.

### Success Criteria:

#### Automated Verification:

- Live readiness and semantic validation pass: the operations script reports ready with the versioned projection and the comparison script completes the bounded corpus with no API/shape failures, published eligibility violations or unexplained candidate-count mismatches.
- Deployed cutover and recovery checks pass: verify real blog/category responses in dataset mode and record successful legacy/lexical recovery probes; verify product searches issue no semantic requests and retain their filter/count behavior.
- Validation evidence is complete: save sanitized results, measured timing, environment/target confirmation, executed commands, deferred manual checks and the retirement conditions in implementation-validation.md and operations.md.

#### Manual Verification:

- Review top results for Polish concepts, diacritics and exact brand/model queries, including the prior fuse-selection miss. Record a human relevance assessment; the corpus is only a starting point.
- Check cards and pagination on desktop/mobile without changing styling. Nonsense input may still return semantic results.
- During a normal editorial publication, confirm results recover after asynchronous embedding refresh without waiting for a weeks-long cache. Do not create or alter production content solely for this observation.
- During the observation week, review usage against the current quota and recurring failure/fallback behavior. No recurring automation is created by this plan.

## Testing Strategy

Mocked tests prove service branching, normalization, deadlines, count/page contracts and recovery. Generated types and builds prove integration, including Next's request-time boundary. Live tests prove current Sanity projection and semantic GROQ support; they cannot establish subjective relevance. Browser/relevance/publication observations remain explicitly identified manual notes. Do not run payment integrations merely because this is a monorepo.

Protect the existing dirty files `apps/web/next-env.d.ts`, `apps/web/src/generated/redirects.ts` and `.playwright-mcp/`. Build scripts can regenerate redirects; inspect and separate those changes without discarding prior user edits. Do not mark checks passed when missing environment or an unrelated pre-existing failure prevented execution; record the exact limitation.

## Risks and Assumptions

- Management read access does not prove settings-write access. If apply fails, retain legacy traffic and document the exact missing capability.
- The current monthly usage display was 0/1,000 and updates daily; it is not a traffic forecast. Recheck before benchmarking and monitor after cutover.
- Equivalent indexed fields do not guarantee equivalent ranking. The API/model changed, and the baseline corpus has limited coverage.
- The successful live semantic query remains unproven until phase 4. A fixed API date is isolation, not a claim that this date is Sanity's documented minimum.
- Uncached semantic reads prioritize freshness; monitor latency/quota before introducing any cache. Dataset updates can still lag publication.
- Deprecated legacy availability may end independently; lexical mode is the durable emergency path.

## References

- [Research](research.md), [API contract](api-contract.md), [Runtime](current-runtime.md), [Projection](projection-design.md).
- [Behavior decisions](search-behavior-decisions.md), [Validation matrix](validation-matrix.md), [Rollout research](rollout-and-rollback.md).
- [Live verification](live-verification.md), [Legacy baseline](legacy-query-baseline.md), [Sanitized evidence](live-api-evidence.json), [Index snapshot](legacy-indexes.snapshot.json).
- [Sanity dataset embeddings](https://www.sanity.io/docs/content-lake/dataset-embeddings), [Migration guide](https://www.sanity.io/docs/content-lake/migrate-from-embeddings-index-api).
- Installed Next guide: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`; follow `apps/web/AGENTS.md` before implementation.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Prepare configuration and rollback controls

- [x] 1.1 Configuration checks pass
- [x] 1.2 Read-only preflight succeeds

### Phase 2: Integrate and test bounded blog search

- [ ] 2.1 Search behavior tests pass
- [ ] 2.2 Generated types and web checks pass
- [ ] 2.3 Production rendering builds

### Phase 3: Remove the unused Studio dashboard

- [ ] 3.1 Studio checks pass
- [ ] 3.2 Dependency removal is complete

### Phase 4: Validate live behavior and cut over

- [ ] 4.1 Live readiness and semantic validation pass
- [ ] 4.2 Deployed cutover and recovery checks pass
- [ ] 4.3 Validation evidence is complete
