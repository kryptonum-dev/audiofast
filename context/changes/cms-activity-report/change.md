---
change_id: cms-activity-report
title: CMS activity report app
status: implementing
created: 2026-09-29
updated: 2026-09-29
archived_at: null
implementation_base: a5eab4bcf53ea8a10ae4323f28f354a1a33c801c
views: []
---

## Notes

Client request (Jarek Orszański, audiofast.pl, Gmail thread "Problemy techniczne strony audiofast…", 25–27 Sep 2026): a per-editor work report for the Audiofast Sanity CMS so he can check how much time a remote employee (Damian Machnik, project role Editor) spends in the CMS. Accepted at 800 PLN net (4h). Promised delivery: end of this week.

Agreed scope (full package, one change, "etap 1" + "etap 1b"):
- Filter by person (project members, robots and the system author excluded) and date range (default last month, max 90 days).
- Daily summary: first/last activity, number of sessions, approximate active time, documents touched, publishes.
- Event list: date & time, editor, document name with Studio link (`/intent/edit/id=…;type=…`), action (draft edit / publish / unpublish / delete / discard), changed fields, session number. Autosaves on the same document within a 5-minute window are merged into one row.
- Changed fields ("etap 1b"): reconstructed from mendoza effects — snapshot of each touched document at range start (`/data/history/{ds}/documents/{ids}?time=`), apply `effects[id].apply` per transaction with the `mendoza` package, diff consecutive states, map field keys to Polish labels. Handle docs created inside the range (no "before"), deleted docs (`lastRevision=true` for the name), nested page-builder changes.
- CSV export (Excel-friendly) with the same columns.
- Session = events with gaps under 30 minutes (configurable in UI), labelled as an approximation of CMS activity, not working time.
- Noise to classify away: denorm patch on the draft right before a product publish (`applyDenormToPublish`), delayed `reviewAuthor` count transaction after a review publish, raw transactions from the bulk-actions table, comparator patches on published docs.

Architecture decisions (owner: Oliwier, 29 Sep 2026):
- A completely separate Sanity App SDK app, new workspace `apps/cms-activity`, Dashboard title "Raport pracy CMS". Nothing shared with or imported from `apps/b2c-admin`; no changes in `apps/web`, no backend route, no new Vercel env vars.
- Data comes straight from the Sanity History API with the logged-in user's token via `useClient().request(...)` (dataset-wide `GET /data/history/production/transactions?excludeContent=true&effectFormat=mendoza&authors=…&fromTime=…&toTime=…&limit=1000`, NDJSON, time-based paging). The app holds no secrets, so Sanity's own roles are the security boundary.
- Access: in-app allowlist in `src/config.ts` — `jarek@audiofast.pl` (p54InZnMK) and `dev@kryptonum.eu` (p3oltYQ6U), matched by email and by user id. Everyone else sees a "Brak dostępu" screen and no request is made. App `visibility: 'unlisted'`.
- Deploy target: Sanity organization `o5BEPFjvf` (Audiofast), project `fsw3likv`, dataset `production`. FastGIS is a different org (`o7lxqfv3y`) — not in scope; pure logic in `src/lib/` must stay project-agnostic so the app can be redeployed there later by changing config only.
- UI in Polish (Sanity UI, two native date inputs like the Studio newsletter tool), code/comments/docs in English, vitest tests co-located with `src/lib/*`.

Verified live on 2026-09-29 (read-only GETs with the web read token): dataset-wide transactions endpoint works incl. `authors` filter; `excludeContent=false` returns 403 for any token (API rule, not token role); mendoza effects are returned with `excludeContent=true`; snapshot endpoint works; `/projects/{id}/users/{ids}` returns displayName + email; ~5.5k transactions / 1016 docs in the last 90 days (Damian 3.6k); oldest transaction 2025-08-15 (longer than the 90 days told to the client — do not promise more than 90).

Risks / open items:
- Spike first: confirm the Dashboard-issued App SDK token can call `/data/history` on the project host from `https://www.sanity.io`; add `http://localhost:3335` to project CORS origins for local dev. Fallback if it fails: a thin route in `apps/web` under its own path and allowlist, still untouched by B2C code.
- Sanity pricing lists "Full audit trail & History API" as Enterprise; endpoint works on this project today.
- First `sanity deploy` mints the `appId` (needs org admin session or a "Manage SDK Apps" token); commit it to `sanity.cli.ts`.
- Maximum `limit` and inclusive pagination boundaries unverified; paging by `fromTime` with id de-duplication is the safe approach.

Phase 1 outcome (2026-09-29): workspace `apps/cms-activity` scaffolded, type-check/lint/build pass. No `sanity deploy` in this run by owner decision, so `deployment.appId` is not minted yet and the Dashboard-token half of the spike (decision gate for the Fallback design) is deferred to the owner's manual deploy; the local half ("Test połączenia" button) is implemented. Tests: superseded by owner decision — no vitest, phases gate on type-check, lint, build and manual checks.
