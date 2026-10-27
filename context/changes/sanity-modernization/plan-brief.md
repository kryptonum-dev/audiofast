# Sanity Modernization — Plan Brief

> Full plan: `context/changes/sanity-modernization/plan.md`
> Research: `context/changes/sanity-modernization/research.md` (+ `research/01`–`11`)
> Decisions: `context/changes/sanity-modernization/decisions.md`

## What & Why

Update every dependency and rebuild audiofast's Sanity integration:
- strict `defineLive` with Cache Components and smaller queries;
- Sanity Functions for invalidation and denormalization;
- a complete, lsse-level Presentation tool with visual editing for every document type, audited end to end.

The motivation is cost, freshness and safety. A Sanity read token is currently leaking in production JS, Studio 6.10.1 has a data-loss bug, and editors have no preview.

## Starting Point

- **No Presentation tool.** It was removed in 2025.
- **Env-switched client.** One client switches on `VERCEL_ENV`, wrapped in `'use cache'` helpers.
- **Cold pages after every deploy.** Only one slug per type is prerendered, so ~1.5k pages go cold after each deploy.
- **A 1007-line webhook.** It handles invalidation and also writes product denorm fields (fire-and-forget).
- **Outdated dependencies.** Several Sanity majors are behind.

## Desired End State

- **Editors** click „Otwórz w podglądzie” in the deployed Studio and see live drafts on audiofast.pl. They can click any block to edit it and drag blocks and nested items.
- **Coverage:** every document type shows where it is used.
- **Public site:** fully prerendered, published + CDN only, refreshed seconds after a publish via sync tags, with no stega or overlays. B2C stays untouched.
- **Dependencies:** all at latest, except the documented upstream holds.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Token leak | Hotfix first; Oliwier rotates the token | It is live in production chunks | Research / D1 |
| Dependencies | All of them, as Phase 1, incl. TS 6 and vitest 5 | One change, final APIs before the Sanity work | D2, D13 |
| Change shape | One change, 13 phases | The goal is one coherent overhaul | D3 |
| Presentation | Complete, lsse-level, all document types | Editors get the full experience | D4/D5 |
| Previews | Production + Presentation cookies; Sanity-side preview code removed, Vercel preview builds kept | Kills draft-leak and live-API cost without touching P24 sandbox testing | D5 / P5 |
| Denormalization | Sanity Function; webhook deleted | One server-side system, also covers API writers | P1 |
| Freshness | `'max'` (stale-while-revalidate) + warm | No visitor waits on a blocking render | P2 |
| Drag-and-drop | lsse level: blocks optimistic + 23 nested arrays | Matches "complete like lsse" | P3 |
| Query size | `minifyGroq` + hotspot fixes, no narrowing | Smaller payloads with no extra request per render | P4 |
| Prerender | Every slug in production | Removes the post-deploy cold-render wave | P6 |
| Safety net | Published HTML parity crawl vs baseline | Proves the rewrite changes no published content | P7 |
| Autonomy | Claude pushes and deploys after the gates pass | Maximum autonomy; the [D] audit lane needs deploys | P8 |
| QA fixtures | Hidden QA page in the production dataset | Tests the real deployed pair | P9 |
| B2C in draft mode | Published only, purchase disabled | Draft strings never reach orders or P24 | P10 |
| `use cache: remote` / Safari | Out | Not needed / deferred | D7 / D8 |

## Scope

**In scope:**
- the security hotfix;
- all dependencies;
- the defineLive fetch layer and three-layer pages;
- prerendering every slug;
- query fixes;
- Sanity Functions: denormalization and sync tags;
- pricing and CPO invalidation;
- the Studio and web Presentation stack;
- drag-and-drop;
- the Tier 0 gates;
- the audit walkthrough;
- cut-over and docs.

**Out of scope:**
- `use cache: remote`;
- narrowing the block union;
- removing Vercel preview builds;
- Safari lane [S];
- a usage baseline;
- public SanityLive;
- the upstream-blocked upgrades (TS 7, ESLint 10, eslint-config-studio 7, @types/node 26);
- Content Releases rows;
- orderable-list drag in Presentation.

## Architecture / Approach

```
Studio (presentationTool, locations/mainDocuments)
  └─ draft mode cookie
      └─ Next.js three-layer pages ─ strict defineLive (published+CDN | drafts in draft mode)
                                       └─ 'use cache' + cacheLife(sanity) + sync tags

Sanity Functions (blueprint):
  invalidate-sync-tags  → /api/revalidate-tags/ → revalidateTag('sanity:…','max') + warm
  denormalize-products  → patches product denorm fields

Explicit invalidation:
  pricing-ingest → product-pricing tags
  CPO checkout   → cpoProduct:<slug>
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. Security hotfix | Token out of the browser; secrets out of the repo and dataset | The rotation depends on Oliwier |
| 1. Dependencies | Everything at latest; Sanity UI 4 port | UI 4 Grid/gap regressions in b2c-admin |
| 2. Parity crawler | Baseline of published HTML | Shared dev servers distort the crawl (use an isolated build) |
| 3. defineLive seam | One client; strict live fetch; cacheLife; minified GROQ | Turbopack picks the two-request variant |
| 4. Three-layer routes | Draft-capable pages; prerender-all; layout without `'use cache'` | Listing slot hangs `next dev` (fallback defined) |
| 5. Query efficiency | Filter-metadata, CPO, deref and N+1 fixes | Changing payload shape for consumers |
| 6. Functions | Denormalization + sync-tag invalidation; pricing and CPO paths | Functions entitlement; Supabase Edge Function access |
| 7. Presentation (Studio) | Tool config, resolvers, actions, completeness test | A `@beta` tool-menu API |
| 8. Presentation (web) | Draft mode, stega filter, overlays, B2C isolation | Stega leaking into logic or attributes |
| 9. Drag-and-drop | Optimistic blocks + 23 nested arrays | Key mangling / snap-back |
| 10. Tier 0 gates | Stega crawler + gate tests green | Gate debt (41 `.trim()` calls, 29 bare derefs) |
| 11. Audit | lsse walkthrough via Claude in Chrome, lanes [L] then [D] | Missing fixtures → BLOCKED rows |
| 12. Cut-over | Webhook deleted, tags pruned, docs | Pricing freshness after deletion |

**Prerequisites:**
- Oliwier: token creation and rotation, CORS with credentials, Vercel env vars, share access, Sanity Manage webhook/token deletion.
- A Sanity plan with Functions entitlement.
- Supabase CLI access for `pricing-ingest`.

**Estimated effort:** large; roughly 10–15 implementation sessions across 13 phases. The audit (Phase 11) alone is 2–3 sessions.

## Open Risks & Assumptions

- **Functions entitlement is unverified.** Fallback: a slim denorm-only webhook, which needs Oliwier's call.
- **The Supabase Edge Function source may be unavailable.** Fallback: pricing invalidation via a Sanity document Function on `lastPricingSync`.
- **The production webhook may have been failing silently** (308 on its slashless URL). The Phase 6 prerequisites check its delivery log.
- **The listing pass-through slot is unproven in `next dev`.** The fallback (sibling cached leaves) is defined.
- **13 products will change their primary category** to match the editor's `categories[]` order during the backfill. Their slugs are listed for review.

## Success Criteria (Summary)

- **Security:** no secret in public chunks or tracked files; the leaked tokens are revoked.
- **Editors:** live drafts, click-to-edit and drag in Presentation for every document type, proven by a clean final audit run on the deployed pair.
- **Visitors:** the published site is content-identical to the baseline (parity crawl), fully prerendered, and fresh within seconds of a publish, with no stega or overlays.
