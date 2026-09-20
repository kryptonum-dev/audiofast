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
