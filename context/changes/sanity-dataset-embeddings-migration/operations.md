# Dataset embeddings operations

Run from the repository root. Settings tooling uses `SANITY_AUTH_TOKEN` from `apps/web/.env.local` for the verified project fsw3likv / production. Runtime uses only the published-read `SANITY_API_READ_TOKEN`; no token values belong in committed files.

## Preflight

`bun --env-file=apps/web/.env.local apps/studio/scripts/dataset-embeddings.ts status --output /tmp/audiofast-embeddings-before.json`

`bun --env-file=apps/web/.env.local apps/studio/scripts/dataset-embeddings.ts check`

Inspect the snapshot and versioned projection. Check local, preview and production environment separately. Default backend is legacy; invalid explicit backend fails preflight and recovers to lexical at runtime.

## Enable and wait

`bun --env-file=apps/web/.env.local apps/studio/scripts/dataset-embeddings.ts apply --project fsw3likv --dataset production --expected-settings /tmp/audiofast-embeddings-before.json --output /tmp/audiofast-embeddings-apply.json`

`bun --env-file=apps/web/.env.local apps/studio/scripts/dataset-embeddings.ts wait --output /tmp/audiofast-embeddings-ready.json`

Apply refuses changed settings, writes a before snapshot, and enables only the versioned article projection. No content backfill or product indexing is needed. A successful PUT is not readiness. Polling times out after ten minutes.

## Cutover

Deploy prepared code with `SANITY_BLOG_SEARCH_BACKEND=legacy` initially. Configure `SANITY_API_READ_TOKEN` using the existing read-only credential through the deployment provider's secret environment handling. Validate the live query corpus, eligibility and latency before switching to `dataset`; redeploy/restart as required. Check the deployed web route and project/dataset independently of local configuration. Do not shadow all visitors. Keep comparison calls below 75 per run.

## Rollback

Set `SANITY_BLOG_SEARCH_BACKEND=legacy` and redeploy/restart while the old index/token remain available. Use `lexical` if the deprecated API is unavailable. Dataset-mode failures already recover directly to lexical. Keep dataset embeddings enabled during diagnosis. No semantic results enter the weeks-long browse cache.

## Deferred retirement

After one week of full dataset traffic, inspect caller/traffic evidence for zero legacy requests. Then separately remove the legacy helper/types/token environment, old indexes and indexing-only webhooks. Preserve the website content revalidation webhook. Dashboard removal does not delete backend indexes. Never disable dataset embeddings as legacy cleanup. No observation automation is created by this change.

## Readiness caveat verified during implementation

Immediately after enablement, settings briefly reported `ready` while the query API still returned `embeddingNotEnabledError`, then settings changed to `updating`. The wait command now requires both the matching ready projection and a successful published semantic query using `SANITY_API_READ_TOKEN`. It caps data-plane probes at 12 and keeps the ten-minute overall deadline. Never switch traffic based only on the PUT response or the first settings read.

## Reproducible comparison

`bun --conditions=react-server --env-file=apps/web/.env.local apps/web/scripts/verify-blog-search.ts`

The script makes 30 semantic requests for the fixed corpus, category/year checks and real service verification, plus ordinary published reads and one legacy recovery check. Keep all readiness probes, browser checks and retries within the migration comparison budget. It saves sanitized `dataset-query-results.json` and exits nonzero for failures or prior top-five regressions.

Schema fields are unchanged. The Studio `type` command's `--enforce-required-fields` extraction introduced unrelated requiredness churn during implementation. Preserve the checked-in schema and use `bun run --cwd apps/studio sanity typegen generate` for this query-only migration.

## Current rollout state — 2026-09-20

Production and local web now explicitly use dataset mode. Vercel preview retains legacy default. Current production deployment is `audiofast-k814wwbzq-kryptonum.vercel.app`; the preceding verified legacy deployment is `audiofast-3639psd5m-kryptonum.vercel.app`. The website alias is https://audiofast.pl. Runtime source is committed on main; no Git push was performed. The Studio is deployed at https://audiofast.sanity.studio.

For an immediate application rollback, Vercel can restore the preceding deployment (which captured legacy mode), or set the backend to legacy and redeploy the current source. If the old endpoint is unavailable, set lexical and redeploy instead. Do not disable dataset embeddings. The earliest retirement review is 2026-09-27, provided a full week of dataset traffic has been observed and no legacy callers remain; this is not an automatic deletion date.
