---
change_id: sanity-modernization
date: 2026-10-26
decided_by: Oliwier Sellig
recorded_by: Claude (Opus 5.5)
source: answers to the 14 open questions in research.md
---

# Decisions: sanity-modernization

Oliwier answered the open questions from [research.md](research.md#open-questions) on 2026-10-26. These answers override the recommendations in research.md wherever the two differ.

**Working mode:** run as autonomously as possible. Ask Oliwier only when a step needs a credential, an approval or a product decision.

## D1. Leaked read token: hotfix immediately (Q1)

- Ship the code fix first, ahead of everything else:
  - move `urlFor`/`imageBuilder` out of `apps/web/src/global/sanity/client.ts` into a token-free module;
  - make the Sanity client `server-only`;
  - read the token from the server-only `SANITY_API_READ_TOKEN`;
  - remove every `NEXT_PUBLIC_SANITY_API_READ_TOKEN` read (`client.ts`, `scripts/generate-redirects.ts`, the legacy fallback in `blog-search.ts`, `turbo.json`, `.env.example`).
- **Token creation and rotation are Oliwier's step.** Claude does not create tokens or enter secrets. Claude prepares the exact commands: create a new Viewer token, add it to Vercel env, revoke the leaked token. Oliwier runs them.
- Verify after deploy: no public chunk on `audiofast.pl` contains `SANITY_API_READ_TOKEN` or an `sk…` literal.

## D2. Update all project dependencies, Studio included (Q2, Q13)

- Update every dependency in every workspace to latest, in this change. That includes:
  - Studio 6.20 (Portable Text data-loss fix);
  - React 19.3 / Next 16.4 / next-sanity 13.4 / `@sanity/client` 8;
  - the Sanity UI 4 + icons 5 + SDK 3 port across studio, b2c-admin and cms-activity;
  - `@portabletext/react` 8;
  - tooling;
  - TypeScript 6;
  - vitest 5 / jsdom 30 / msw 3.
- Run it as **the first phase**, followed by a full verification pass (typegen, check-types, lint, tests, full `bun run build --force`, smoke flows) before the Sanity work starts.
- Held upgrades remain held only where upstream blocks them: TS 7, ESLint 10, `@sanity/eslint-config-studio` 7, `@types/node` 26. Record each with its unblock condition in CLAUDE.md.

## D3. One change, in phases (Q3, Q7)

Everything stays in `sanity-modernization`, which will be large; that is intended. It covers:
- dependencies;
- the fetch layer + defineLive + invalidation;
- the denormalization relocation;
- query efficiency;
- the Presentation tool;
- the full Presentation audit.

## D4. Presentation: complete, lsse-www level, tested 0→100 (Q4, Q5)

- **Replaces research §H "simple target".** Presentation has to work and be as complete as in lsse-www.
- **Every document type is in Presentation:**
  - every routable type gets `locations`/`mainDocuments`;
  - every referenced-only type gets a "used on" panel;
  - every chrome/settings type gets a static message;
  - a completeness test enforces this.
- Full visual editing:
  - draft mode;
  - stega with a leaf-name filter;
  - `data-sanity` overlays;
  - draft-only `<SanityLive includeDrafts>`;
  - PreviewBar;
  - "Otwórz w podglądzie" action;
  - `shareAccess: true`.
- **Drag-and-drop:** the PageBuilder optimistic reorder, plus nested arrays where lsse made them draggable (decided per array in the plan). Every array that is not draggable is listed with a reason.
- Tested end to end with the full lsse audit:
  - Tier 0 gates, including the stega crawler;
  - the scenario catalogue;
  - the B2C isolation suite;
  - the run contract, summariser and cleanup assertion.

## D5. Preview model: production + Presentation cookies only; preview deployments go away (Q6, Q10)

- The only deployed web origin is `audiofast.pl` (production). Drafts are viewed **only** through the Presentation tool's cookie-scoped draft mode.
- Vercel preview deployments as a concept are removed (Oliwier accepts this):
  - no `VERCEL_ENV === 'preview'` branches;
  - no `cacheLife('minutes')` preview profile;
  - no live-API reads on previews.
- The env-dependent client switch goes. There is one code path: published + CDN by default, drafts only in draft mode.
- `localhost` also renders published by default; drafts appear only in draft mode.
- Presentation origins: `http://localhost:3000` and `https://audiofast.pl`.

## D6. Usage baseline not required (Q8)

- No Sanity usage export or request-log baseline for this change.
- Still add `requestTagPrefix` + per-call `requestTag` so usage is attributable later.

## D7. No `use cache: remote` in this change (Q9)

Out of scope. Request-time listings stay on `use cache`; the CDN quota absorbs them. Revisit only if the API CDN quota is exceeded.

## D8. Audit executor: Claude in Chrome, no Safari (Q11)

- The whole walkthrough runs through Claude in Chrome: lanes [L] localhost and [D] deployed Studio + production.
- Safari / lane [S] (CHIPS cookie) is deferred and recorded as such.
- Other choices:
  - `shareAccess: true`;
  - draft-only SanityLive in v1;
  - optimistic reorder in scope (see D4).

## D9. Move `metaConversionToken` out of the dataset (Q12)

- `settings.analytics.metaConversionToken` moves from the publicly readable dataset to a server-only env var.
- `/api/analytics/meta` stops reading Sanity per event.

## D10. Turbopack `sanityFetch` variant (Q14)

- Explained and accepted.
- The plan adds a verification step: build after defineLive lands, then grep the server bundle for `fetch-sync-tags`. The marker must be absent, which confirms the one-request `next-js` variant.

## Carried over from research (not contradicted)

- Denormalization writes move out of cache logic before the webhook's invalidation role is retired.
- Old and new invalidation run in parallel during cut-over, because the site is live.
- `<SanityLive>` never mounts for public visitors.
- Metadata, JSON-LD, sitemap and static params stay pinned to published with stega off.
- B2C reads stay outside defineLive: `sanityFetchFresh`, the CPO write client, order-email and legal reads.

---

# Planning-session decisions (/10x-plan, 2026-10-26)

## P1. Denormalization moves to a Sanity Function
- A document-event Function recomputes product `denorm*` fields on brand, category and product changes. It ships in the same root blueprint as the Sync Tag Invalidate Function.
- The webhook `/api/revalidate` is deleted entirely at the end of the change, after a parallel-run period.
- The Function needs a loop guard, so its own patches do not re-trigger it.

## P2. Freshness: stale-while-revalidate + warm
- The sync-tag route runs `revalidateTag('sanity:'+tag, 'max')`, then warms key paths (home + the edited document's URL).
- No `{expire:0}` waves.

## P3. Drag-and-drop at lsse level
- PageBuilder blocks get optimistic reorder.
- Every authored nested array gets an annotation.
- Arrays that cannot work are listed with a reason: marquees, cloned-slide carousels, query-driven listings, primitive arrays.

## P4. GROQ size: minify, no narrowing
- `minifyGroq` on every query.
- Fix the ranked hotspots: the filter-metadata payload, duplicate SEO queries, CPO list+count, dead queries, N+1s.
- No per-page narrowing of the block union.

## P5. Preview deployments: remove Sanity-side only
- Remove every Sanity/preview code path:
  - the client env switch;
  - the preview `cacheLife('minutes')`;
  - the dev-branch Studio URL (switches to localhost/prod).
- Vercel preview builds stay.
- B2C/P24 sandbox, e2e and admin-auth `VERCEL_ENV` branches stay untouched.
- Previews render published content via the CDN, like production.

## P6. Prerender every slug in production builds
- Remove the one-per-type limit in `limitBuildTimeStaticParams`.
- Accepted cost: longer builds, plus ~2k CDN requests per deploy.

## P7. Regression net: published HTML parity crawl
- Crawl every sitemap URL before and after the fetch-layer rewrite.
- Compare status codes, stega-stripped visible text, `<title>` and JSON-LD.
- Existing vitest + Playwright suites also run at phase gates (standard gates, not extra scope).

## P8. Autonomy: deploy after gates
- Per phase, once the automated gates pass, Claude commits, pushes to `main`, runs `sanity deploy` (Studio) and deploys Sanity Functions.
- Oliwier handles only token creation/rotation and anything Claude explicitly flags.

## P9. QA fixtures in the production dataset, hidden
- `page.qa-presentation` is seeded in production with `doNotIndex` and excluded from the sitemap and listings.
- Every audit write is a draft, reverted via `ifRevisionID`; cleanup is asserted with GROQ.

## P10. B2C in draft mode: published + disabled purchase
- Cart, checkout, account and thank-you routes are not Presentation targets and always read published content.
- On product pages in draft mode, "Dodaj do koszyka" and quick-add are disabled, with a short Polish note.

## P11. „Podgląd" hidden in the deployed Studio for now (2026-10-27)
- Oliwier asked to hide Presentation from editors until he has told Jarek about it. `SANITY_STUDIO_PRESENTATION_ENABLED` gates the tool, the „Treść"/„Podgląd" tab menu and „Otwórz w podglądzie". `sanity dev` always has them; a built Studio only with the flag set to `true`.
- The web side (draft mode, stega, overlays) stays deployed. It is unreachable without the share secret or the Studio.
- Re-enable: set `SANITY_STUDIO_PRESENTATION_ENABLED=true` in `apps/studio/.env`, then `bunx sanity deploy` in `apps/studio`. Do not re-enable it as part of this change.
