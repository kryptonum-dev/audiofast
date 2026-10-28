# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-research, /10x-plan, /10x-implement.

## Use strict defineLive under Cache Components

- **Context**: Any Next.js app with `cacheComponents` that fetches Sanity through `next-sanity/live` `defineLive` (audiofast `global/sanity/live.ts`, Najbar, lsse-www).
- **Problem**: Without `strict: true`, `defineLive` silently resolves `perspective: 'published', stega: false` inside cached scopes, so draft mode and Presentation keep showing published content with no error anywhere. Without a `browserToken`, `<SanityLive includeDrafts>` silently degrades to published as well.
- **Rule**: Always create `defineLive` with `strict: true` and a Viewer `browserToken`, resolve `perspective` and `stega` outside `'use cache'` (`getDynamicFetchOptions()`) and pass them in as props. Never put `children` inside a `'use cache'` scope.
- **Applies to**: plan, implement, verify

## Callback URLs must match the site's trailing-slash policy

- **Context**: Webhooks, Sanity Functions, Supabase Edge Functions or any server-to-server POST into a Next.js app with `trailingSlash: true` (audiofast `/api/revalidate-tags/`).
- **Problem**: A slashless URL gets a 308, and most callers do not re-POST the body, so the call "succeeds" or fails quietly and nothing is invalidated. The old Sanity webhook targeted `https://audiofast.pl/api/revalidate` this way.
- **Rule**: Always write callback URLs with the trailing slash, send `redirect: 'manual'` from callers you control, and verify a new caller end to end (caller log plus the route's response), not only the route's unit tests.
- **Applies to**: plan, implement, verify

## Sync tags cover Sanity only; every other cache needs its own invalidation

- **Context**: Cache invalidation design on Sanity + Supabase sites (audiofast pricing in `pricing_*` tables, CPO availability, geocoding).
- **Problem**: Supabase pricing was only ever expired as a side effect of the Sanity webhook (the price sync patched products). Retiring the webhook without a replacement would have frozen product prices for the cache lifetime.
- **Rule**: Before retiring an invalidation channel, list every cache entry it expired, including side effects, and give each non-Sanity source an explicit trigger (audiofast: `pricing-ingest` POSTs `customTags: ['product-pricing']`). Do not add hand cache tags for Sanity data: sync tags already cover it, and the hand tags left are `product-pricing*`, `cpoProduct:<slug>` and `geocode`.
- **Applies to**: research, plan, implement

## Check secret names byte for byte, and make "missing config" loud

- **Context**: Supabase function secrets, Vercel env, Sanity Functions env; any code path that skips work when a variable is unset.
- **Problem**: The Supabase secret `NEXT_REVALIDATE_URL` was stored with a trailing tab, so `Deno.env.get('NEXT_REVALIDATE_URL')` was always undefined and `cpo-product-sync` skipped its revalidation call on every run with only a `console.log`. Nobody noticed for months.
- **Rule**: When auditing secrets, list them as JSON (`supabase secrets list -o json`) and compare names exactly and values by hash only. Code that cannot do its job without a secret logs an error (or fails the request), never a quiet "skipping".
- **Applies to**: implement, verify

## Sanity document ids with a dot are not public

- **Context**: Seeding fixtures or creating documents by API in a dataset that the web reads without a token (audiofast published reads use the unauthenticated API CDN).
- **Problem**: A QA fixture seeded as `page.qa-presentation` rendered 404 in production: ids containing `.` are path-scoped and need a token to read, so the public CDN never returns them.
- **Rule**: Never use a dot in the id of a document the public site must read; use `qa-presentation` style ids, and check a new fixture through the same unauthenticated path the site uses.
- **Applies to**: plan, implement

## Prove a cut-over on production before deleting the old path

- **Context**: Replacing a live mechanism (webhook, cron, integration) with a new one while the site is in production.
- **Problem**: While both channels run, a passing freshness check can come from the old channel, so the new one can be broken without anyone seeing it until the old one is deleted.
- **Rule**: Run the soak checks with reversible patches on real documents (patch with `ifRevisionID`, poll the public page, check the new channel's own logs, revert), delete the old channel, then repeat one freshness check so it can only pass through the new path.
- **Applies to**: plan, implement, verify
