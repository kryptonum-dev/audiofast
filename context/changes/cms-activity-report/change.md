---
change_id: cms-activity-report
title: CMS activity report app
status: implemented
created: 2026-09-29
updated: 2026-10-02
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

Phase 5 outcome (2026-09-29): the app is implemented (all five phases) but NOT deployed — it awaits the owner's green flag. The temporary "Test połączenia" button and diagnostics panel are removed; type-check, lint and build pass. Because nothing was deployed, the Dashboard-token half of the Phase 1 spike (the decision gate for the Fallback design) is still unverified, `deployment.appId` is not in `sanity.cli.ts` yet (TODO comment in its place) and there is no Dashboard URL to record. Owner deploy steps, with an org `o5BEPFjvf` admin/developer session (`bunx sanity login`, or `SANITY_AUTH_TOKEN` with "Manage SDK Apps"):

```bash
cd apps/cms-activity
bun run build
bun run deploy   # sanity deploy; visibility 'unlisted' and title come from sanity.cli.ts
```

Then copy the printed app id into `sanity.cli.ts` as `deployment: { appId: '<id>' }` and commit it, open the printed Dashboard URL as dev@kryptonum.eu, load Damian's last 30 days (a loaded report closes the spike; 401/403/CORS → Fallback design), check the denial card with a non-allowlisted org member, record the app id and Dashboard URL here, fill `{{DASHBOARD_URL}}` in `handover-email.md` and send it to Jarek from Gmail. Full steps in `apps/cms-activity/README.md` → Deploy.

2026-10-02 — replay fix and report redesign (owner-approved):
- Fix: the History API documents endpoint adds a synthetic `_rev` to snapshots, while mendoza effects are computed against the stored document without it; mendoza addresses fields by sorted-key index, so patches on pre-existing documents failed. Replay state is now seeded without `_rev` (snapshot revision kept apart for the boundary check). A second failure mode showed up over 90 days: some effects are based on an internal version the snapshot endpoint never returns (e.g. a published version that reads as missing at every `?time=`). On a failed patch the replay now reads the document right after that transaction (`?revision=`), derives its base via the `revert` patch and replays again (max 5 rounds). Damian: 30 days 9 → 0 failed rows, 90 days 119 → 0 of 567.
- Redesign: centered 1200px layout with a one-row filter bar; report header with readable Polish range; four summary tiles (active time with daily average, active days, sessions with the gap setting, documents/publishes with image/file assets excluded); "Dzień po dniu" timeline (session bars on a data-driven hour axis in Europe/Warsaw, rows open and scroll to the day's first session); "Sesje i zmiany" collapsible session cards (chronological, auto-expanded up to 20 sessions) grouping events by document with Polish type labels, action badges with counts and times, field chips with "+ N" and on-demand event times; image/file uploads folded into "Dodano N obrazów" lines. CSV keeps its 9 columns; Typ now uses the Polish type label and asset rows read "Obraz"/"Plik" + "Dodanie obrazu/pliku" with no fields. The themed background fills the whole viewport. Old `DailySummary`/`EventsTable` removed.

2026-10-02 — sessions grouped by day, roomier layout, thumbnails (owner-approved): "Sesje i zmiany" is one collapsible card per active day (expanded by default up to 10 days) with sessions as light rows that open inline; timeline rows open and scroll to the day. Document groups show a thumbnail from one GROQ projection in `resolveDocuments` (per-type image fields from `src/lib/images.ts`, then the first page-builder image; draft wins; deleted documents use the last revision), uploaded images show as small thumbnails in the "Dodano N obrazów" line. Damian 90 days: 217/218 document groups with a thumbnail (review author has no image field).

2026-10-02 — deployed (owner green flag): app `vkz2ft2v1wlv5824qsg10qmh`, title "Raport pracy CMS", unlisted, org `o5BEPFjvf`, URL https://www.sanity.io/@o5BEPFjvf/application/vkz2ft2v1wlv5824qsg10qmh. The app was created with the CLI's own `createUserApplication` (org already has b2c-admin, and `sanity deploy -y` refuses to choose between creating and reusing), then deployed with `sanity deploy -y`. Access: Sanity offers no per-user app ACL (Applications API: only `dashboardStatus`/`visibility` default|unlisted|disabled; reading apps is the org-level `sanity.sdk.applications.read` grant), so the restriction is unlisted visibility plus the in-app allowlist (jarek@audiofast.pl, dev@kryptonum.eu). Dashboard-token spike still to be confirmed by opening the deployed app as dev@.

2026-10-02 — post-deploy follow-ups (owner): app switched to listed (`visibility: 'default'`) with a clearer access-denied screen (who the report is for, signed-in account, "Poproś o dostęp" mailto to `accessContact`). Session-open view-transition animation removed entirely. Thumbnails failed on the deployed app only: Sanity hosting enforces a stricter document Referrer-Policy, so `cdn.sanity.io` rejected referrer-less image requests; fixed with an explicit `referrerPolicy="strict-origin-when-cross-origin"` on thumbnails (same fix as sanity-io/sanity#13665). The deployed report loaded for dev@ in the Dashboard, which confirms the Dashboard-issued token can read the History API (Phase 1 spike closed).

2026-10-02 — thumbnails on the deployed app, corrected root cause: the referrer-policy explanation above was wrong; the explicit `referrerPolicy` did not help and is removed. Inside the Dashboard the app runs in a cross-site iframe (`jcz3l316qbd0.sanity.studio` in `www.sanity.io`), where a plain `<img>` request to `cdn.sanity.io` carries the browser's `*.sanity.io` cookies and fails with every referrer policy, for this project and for others. A debug build proved it: the same CDN URL failed as a plain image but loaded from a `credentialless` child iframe (no cookies), and every non-Sanity image loaded. A cookie-free CORS request (`crossOrigin="anonymous"`) needs the app origin in the project's CORS list (CDN answered 403 "CORS Origin not allowed" before). Fix: `https://jcz3l316qbd0.sanity.studio` added to the project's CORS origins without credentials (owner-approved), and `Thumbnail` loads with `crossOrigin="anonymous"` first, falling back to a plain request (local dev on localhost) and then to the placeholder. Verified in the deployed app: Damian's last 30 days show real 32px row thumbnails and the 52px thumbnail in an opened session.

2026-10-02 — CSV export redesigned (owner-approved): the single 9-column event table packed several values into one cell ("Zmienione pola" lists, "Sekcje: A / B / +2") and had no session times. "Eksportuj CSV" is now a menu with two files, one value per cell: "Sesje i czas pracy" (one row per session: Data, Sesja, Od, Do, Czas (min), Dokumenty, Publikacje, Obrazy, Redaktor) and "Zmiany w dokumentach" (one row per changed field: Data, Godzina, Sesja, Dokument, Typ, Akcja, Pole, Element, Redaktor, Link). Events now carry `fieldChanges` (field label + array item label, filled next to `changedFields` and unioned on merge); uploads show their `originalFilename` and link to the CDN file; publish/unpublish/delete/discard are one row without fields (their fields already show on the edits; on Damian's 30 days they were 233 of 520 rows); "Zapisy" is no longer exported. Session durations are rounded to whole minutes at the source, so the CSV column sum, day totals and tiles agree.

2026-10-02 — export switched from CSV to XLSX (owner reported every row in one column): Excel takes the CSV separator from the computer's regional settings on double-click, so the `;` files opened as one column on the owner's Mac (en_US language, Polish region), and a `,` file would break Polish-locale Excel instead. "Eksportuj do Excela" now downloads one `.xlsx` with the same two tables as sheets "Sesje" and "Zmiany": real dates/times/numbers, bold frozen header with filters, content-sized columns, clickable links ("Otwórz w Studio", "Otwórz obraz/plik"). Written by a dependency-free writer (`src/lib/xlsx.ts` + stored-entry `src/lib/zip.ts`); verified with openpyxl and by opening the file in Microsoft Excel for Mac (no repair prompt). `csv.ts` removed; the export menu and its popover providers are gone again.

2026-10-02 — access-denied screen simplified (owner): after testing it with dev@ temporarily removed from the allowlist, the contact line, the "Poproś o dostęp" mail button and the "Zalogowano jako" line were removed; the screen keeps the lock icon, heading and one sentence. `accessContact` removed from the config. dev@kryptonum.eu is on the allowlist again.
