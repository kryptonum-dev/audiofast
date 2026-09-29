# CMS Activity Report App — Plan Brief

> Full plan: `context/changes/cms-activity-report/plan.md`
> Change notes (live findings, decisions): `context/changes/cms-activity-report/change.md`

## What & Why

Jarek Orszański (Audiofast) needs a per-editor work report for the Sanity CMS to check how much time a remote employee spends editing content. Sanity has no such report outside Enterprise, but its History API exposes every transaction with author and timestamp. We build a small standalone app on top of it. Accepted at 800 PLN net, due end of this week.

## Starting Point

The monorepo already has one Sanity App SDK app (`apps/b2c-admin`) deployed to the Audiofast org, which proves the tooling and deploy path. Nothing in the repo reads the History API yet. Live probes confirmed the dataset-wide transactions endpoint, mendoza effects, snapshots and user lookups all work with a regular project token.

## Desired End State

A Dashboard app "Raport pracy CMS", unlisted, that only `jarek@audiofast.pl` and `dev@kryptonum.eu` can use. Pick a person and a date range (max 90 days back), get a daily summary (first/last activity, sessions, approximate active time, documents, publishes) and an event list (time, document with Studio link, action, changed fields in Polish, session), and download it as an Excel-friendly CSV.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Where it lives | New workspace `apps/cms-activity`, nothing shared with B2C admin | Owner wants a completely separate area with its own access list. |
| Backend | None; the app calls History API with the user's own token | The app holds no secrets and Sanity roles already bound what each user can read, so a server adds nothing. |
| Access | In-app allowlist (id + email) for two accounts, `visibility: 'unlisted'` | Who sees the UI is a product rule, not a security boundary; Sanity permissions are. |
| Session definition | New session after 30 min gap (UI-configurable), min 5 min per session | Matches what was promised to the client and resists autosave noise. |
| Date range | Max 90 days back | Matches the client's accepted scope and documented Growth retention, even though the project shows longer history. |
| Changed fields | Top-level field label + block type/name for arrays | Readable for a non-technical owner, fits a CSV cell. |
| Studio side effects | Merge denorm patch and review-author counters into the parent publish | Jarek should see what the editor did, not what Studio did for them. |
| Tests | None | Owner decision; phases gate on type-check, lint, build and manual checks. |
| CSV | `;` separator, UTF-8 with BOM | Polish Excel opens it correctly by double-click. |
| If the token spike fails | Thin proxy route in `apps/web` under its own path and allowlist | Keeps the app separate from B2C code while unblocking delivery. |

## Scope

**In scope:** new App SDK workspace; access gate; History API client with paging; action classification and noise merging; sessions and daily summary; document names and Studio links; changed fields via mendoza reconstruction with generated Polish labels; CSV export; unlisted deploy; README and one-line docs updates; handover email draft.

**Out of scope:** backend, Supabase persistence, cron, automated tests, FastGIS deployment, ranges beyond 90 days, robot/system activity, per-character diffs, CI.

## Architecture / Approach

Browser-only React app inside the Sanity Dashboard. `useCurrentUser` → allowlist gate → `useClient` → `/data/history/{ds}/transactions` (author-filtered, paged NDJSON) → classify by effect shapes → resolve names via GROQ and last revisions → merge noise → replay all transactions per touched document from a snapshot at range start with `mendoza.applyPatch` and diff → sessions → daily summary → table and CSV. Pure logic in `src/lib/*`, project ids only in `src/config.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Scaffold, gate, spike | Workspace boots locally and in Dashboard, allowlist works, first unlisted deploy mints appId | Dashboard token cannot reach History API → fallback proxy |
| 2. Data layer | Paging client, members, classification, merging, sessions, summary | Unverified pagination boundaries; heuristic merge windows |
| 3. UI and CSV | Filters, tables, states, download | Polish Excel CSV quirks |
| 4. Changed fields | Snapshot + mendoza replay, label generator, diff formatting | Replay must include all authors; 500-document ranges take seconds |
| 5. Deploy and handover | Production deploy, docs, email draft | Deploy needs org admin session |

**Prerequisites:** org admin session for `sanity deploy`; `http://localhost:3335` added to project CORS in sanity.io/manage; dev@ account for verification.
**Estimated effort:** ~6–8h across 5 phases (the client budget covers 4h; the changed-fields phase is the extra the owner chose to include).

## Open Risks & Assumptions

- Sanity pricing labels "Full audit trail & History API" as Enterprise, yet the endpoint works on this project; if Sanity restricts it later, the report shows what Sanity returns.
- Retention observed is 13+ months, documented is 90 days; we promise 90.
- The Dashboard-issued token calling the project-host History API is inferred from types and Studio behaviour, not yet exercised in an App SDK app (Phase 1 spike).
- Session and active time are approximations of CMS activity, not working time; the UI says so.

## Success Criteria (Summary)

- Jarek opens the link, picks Damian and last month, and gets a readable daily summary plus event list within seconds.
- The CSV opens in Excel with correct columns and diacritics and can be accumulated month by month.
- Nobody outside the two accounts sees the report; no changes were needed in `apps/web` or `apps/b2c-admin`.
