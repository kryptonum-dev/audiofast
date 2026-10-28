# Phase 12 cut-over record

What was checked before `/api/revalidate` and its webhooks were retired, and what was removed. Times are UTC, 2026-10-28 (run labelled 2026-10-27 in the plan).

## Soak checks (old webhook still live)

Every edit was a reversible API patch on a real published document with an `ifRevisionID` guard, dry-run first, made with no Studio or preview tab open (so each one is also a zero-tab publish). Freshness was polled on `https://audiofast.pl` every 3 s.

| Check | Document / field | Result |
|---|---|---|
| publish → fresh #1 | product `eecda851…` (Kala 50) `subtitle` + ` (QA12a)` | fresh on `/produkty/kala-50/` after 4.8 s |
| publish → fresh #2 | same field reverted | fresh after 8.5 s; marker gone on the next HIT |
| zero-tab publish | `homePage` `seo.description` + ` QA12h`, then reverted | fresh on `/` after 3.9 s and 5.3 s |
| Function ran | `bunx sanity functions logs invalidate-sync-tags` | `Invalidated 4 sync tag(s) via https://audiofast.pl/api/revalidate-tags/` at 07:28:50 and 07:29:02 |
| Excel price path | exact `pricing-ingest` request: `POST /api/revalidate-tags/` `{"customTags":["product-pricing"]}` with the shared secret | `{"revalidated":1}` 200; `/produkty/playerpro-8k-tv/` went HIT age 1 → STALE → regenerated HIT; a wrong secret got 401. Supabase secret `SANITY_REVALIDATE_TAGS_SECRET` matches the local value by SHA-256 |
| CPO reserve | code path only (no production orders) | `invalidateCpoAvailabilityCache` expires only `cpoProduct:<slug>` with `{ expire: 0 }` (unit-tested in `cpo-availability.test.ts`); the detail page still carries that tag |

All documents were restored to their original values (checked by GROQ afterwards).

A real Excel price run and a real CPO reserve were not triggered: both need real business actions. They stay as manual checks.

## Callers of the old route

- `cpo-product-sync` (Supabase, v11) POSTed `{tags:['cpoProduct','cpoPage'], paths}` to `${NEXT_REVALIDATE_URL}/api/revalidate`. **The call was dropped, not repointed** (v12, source now in `supabase/functions/cpo-product-sync/`): everything the function changes is a Sanity mutation on `cpoProduct` documents (createOrReplace, delete, archive patch) and every CPO read on the web goes through `defineLive`, so the `invalidate-sync-tags` Function already expires the listing, detail and sitemap entries.
- That call had in fact never run: the Supabase secret was stored as `NEXT_REVALIDATE_URL\t` (trailing tab), so the function always logged "Skipping Next.js revalidation".
- No other Edge Function (`pricing-ingest`, `sync-prices-to-sanity`, `sync-related-products`, `migrate-has-multiple-prices`) reads `NEXT_REVALIDATE_*` or calls `/api/revalidate`; `pricing-ingest` already posts to `/api/revalidate-tags/`.

## Removed

- Supabase secrets `NEXT_REVALIDATE_TOKEN` and `NEXT_REVALIDATE_URL\t`.
- Sanity webhooks `Revalidate Next.js` and `Revalidate CPO (TEMP)`. Remaining: `Embeddings index: blog`, `Vercel Deploy on Redirect Change`.
- Sanity token `Next Revalidate Token` (`g-kellx3y6lEIl`); its old value now gets 401 from `/users/me`.
- Vercel `NEXT_REVALIDATE_TOKEN` (all environments). `SANITY_WEBHOOK_SECRET` was not set in Vercel any more.

## After the webhooks were deleted

One more publish → fresh, which can only pass through the Function: brand `brand-456` (KLH Audio) `seo.description` + ` QA12b` → fresh on `/marki/klh-audio/` after 7.3 s, reverted → fresh after 7.2 s, with matching `invalidate-sync-tags` log lines at 07:41:31 and 07:41:43.

## Rollback

Restore `apps/web/src/app/api/revalidate/` from git, recreate the webhook (`https://audiofast.pl/api/revalidate/`, dataset `*`) with a new bearer token in Vercel, and redeploy. The Functions keep working alongside it.
