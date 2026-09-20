# Implementation validation

Date: 2026-09-20. Work performed directly on main. Baseline: 39f135155b56f17212e85fe73669f31d84515366.

## Completed code checks

- Phase 1: 13 configuration tests and read-only settings/preflight passed; commit 0e84734.
- Phase 2: 41 focused tests across configuration, service, blog integration and product integration passed. Includes a controlled 70-article filter/order/slice fixture with equal scores (not a simulation of Sanity's embeddings model).
- Web type check and lint passed. Web production build completed with all 107 static pages; commit 0518228.
- Query-only type generation succeeded. The schema-extraction command also produced unrelated requiredness changes; those were restored before regenerating against the existing schema. No schema migration landed.
- Studio type check, lint and build passed; lint has 60 existing warnings and zero errors. Plugin registration and dependency removed, Assist retained; commit f82d69b.
- Follow-up da3f3bc: live readiness requires a successful data-plane query, and diagnostics use performance.now to avoid Next prerendering's Date.now restriction. Focused tests, web/studio types and web lint passed again.

## Local browser checks (Brave)

- Blog browse displays 12 of 25 articles with page links.
- Search submission updates the URL. While Sanity indexes, dataset failure recovers to the expected lexical Grimm MU2 article.
- Category route displays eight knowledge articles; searching Grimm retains category eligibility and returns one lexical match.
- Product MU2 search displays Grimm Audio MU2 and sidebar count one. Product source is unchanged and its test proves no legacy embeddings call.
- Studio loads with Structure, Vision, Media and other tools, without the embeddings dashboard. No content was edited for testing.
- Existing development-only nested cacheLife warnings originate in the shared layout/cache helper; the production build passed. No unrelated cache rewrite was made.

## Remote target and controls

Local, Vercel preview and Vercel production all resolve to fsw3likv/production. Production read and legacy credentials existed; the same read credential was added as sensitive SANITY_API_READ_TOKEN, and backend was set to legacy for staged deployment. No token values were logged or committed. Preview remains on default legacy.

Dataset enablement is recorded in dataset-enablement.json. The first ready response preceded actual query readiness; the guard was corrected and polling continued. Actual readiness was confirmed at 05:42:09 UTC with a successful semantic query; see dataset-readiness.json. Production cutover remains pending until deployed verification below.

## Remaining observation

Human relevance review and a normal editorial publication/freshness observation remain distinct from automated API checks. Keep legacy indexes for at least a week of full dataset traffic before a separate retirement action. Do not delete the site revalidation webhook or disable dataset embeddings.

## Live comparison

`verify-blog-search.ts` passed with 30 semantic requests, using the application read credential. All 25 queries succeeded; expected article IDs appeared in the top five for all 23 title-derived expectations (legacy: 22/23), with zero regressions. The fuse-selection query now ranks blog-article-1968 first. Query time: 133–389 ms, median 170 ms; a local single-run observation, not a production performance guarantee.

All responses excluded unpublished/ineligible documents. Award category returned six, year 2026 returned thirteen, their intersection returned six, year 1900 returned zero. Real service checks returned dataset/success/25, legacy/success/25 and lexical/success/1. Results and projection hash are in dataset-query-results.json.

After indexing, Brave showed eight eligible knowledge-category results for Grimm, with the relevant Grimm article first; adding 2026 reduced this to the correct three articles with 2026 publication dates. Before readiness the same route had recovered to lexical, showing fresh results without application-cache clearing.

## Deployment and production browser verification

- Prepared production deployment (legacy mode): https://audiofast-3639psd5m-kryptonum.vercel.app — READY, aliased to audiofast.pl. Its production build/type check passed and Brave rendered twelve legacy-ranked cards.
- Dataset cutover deployment: https://audiofast-k814wwbzq-kryptonum.vercel.app — READY, aliased to https://audiofast.pl. Source runtime commit: 55ffdc8. Production build completed all 107 static pages with types passing. SANITY_BLOG_SEARCH_BACKEND is dataset and the server-only read credential is configured.
- Deployments were uploaded from an archive of committed main, excluding unrelated working-tree changes and local env files. No Git push was performed.
- Brave verified real production search across three pages: 12 / 12 / 1 cards, with no overlap between the first two pages. Search text remained in page URLs. A 390px viewport showed no horizontal overflow; the viewport override was reset.
- Production MU2 product search still shows Grimm Audio MU2 with sidebar count one. Product embedding calls remain disabled.
- A deployment-scoped Vercel log query for `blog-search` returned no recovery entries during these checks. This is a short observation, not a week-long reliability claim.
- Studio dry-run confirmed the existing fsw3likv studio target; the updated Studio deployed successfully to https://audiofast.sanity.studio. Brave verified the hosted Studio (inside Sanity's dashboard) shows Structure, Vision, Media and the other tools without the Embeddings dashboard. Assist registration/dependency are preserved; no AI edit was invoked.
- Local `.env.local` now has the server-only read-token alias and explicit dataset mode; preview remains on default legacy. Existing local generated-file changes remain excluded from commits.

## Development-only behavior and adaptations

Brave exposed intermittent three-second fallback during Next development navigations, alongside pre-existing RootLayout nested-cache-life/prerender errors. A targeted read-only investigation confirmed supplied abort signals bypass Next fetch dedup, and framework abort/staging can obscure the error source. A fresh request returned the correct semantic page; production navigation returned all pages correctly, without recovery log entries. No timeout increase, retries, global cache change or SDK bypass was introduced. The explicit request-time boundary and monotonic timing fix are included in the deployed runtime. Development RootLayout warnings remain outside this migration.

No production content was edited to test freshness. Human relevance acceptance, a normal publication/index-refresh observation and the week-long rollback observation remain follow-up checks. Neither legacy index nor its token/webhook has been deleted.
