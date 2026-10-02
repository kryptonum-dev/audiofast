# Raport pracy CMS (cms-activity)

Standalone Sanity App SDK app for the Audiofast Sanity organization. For a chosen editor and date range it reports CMS activity (summary tiles, day-by-day timeline, session cards with content changes, Excel export) based on the Sanity History API.

## Purpose

The client (Audiofast) wants to see how much time an editor spends working in the CMS. The app reads `/data/history/{dataset}/transactions` for the selected person, groups the transactions into sessions and shows what changed. Active time is an approximation of CMS activity, not working time.

## Access model

- The app holds no secrets. All requests go to the project host with the logged-in user's own token (`useClient` from `@sanity/sdk-react`), so Sanity project roles are the security boundary.
- On top of that, an in-app allowlist in `src/config.ts` (`allowedUsers`, matched by user id or case-insensitive email) decides who sees the report. Everyone else gets a "Brak dostępu do raportu" card and the app makes no History API request.
- The app is deployed with `visibility: 'default'`: it is listed in the Dashboard for the whole organization, and the allowlist decides who sees data.

To give another person access, add `{ id, email }` to `allowedUsers` in `src/config.ts` and redeploy.

All project-specific values (organization, project, dataset, Studio URL, allowlist, limits, time zone) live only in `src/config.ts`.

## Local development

From the repo root:

```bash
bun install
bun run dev:cms-activity
```

or inside this folder `bun run dev`. The Sanity CLI serves the app on `http://localhost:3335`.

The browser calls the project API directly, so `http://localhost:3335` must be listed in the project's CORS origins with credentials allowed (sanity.io/manage → project `fsw3likv` → API → CORS origins, or `sanity cors add http://localhost:3335 --credentials --project-id fsw3likv`).

Checks:

```bash
bun run check-types
bun run lint
bun run build
```

## Field labels

The "Zmienione pola" column shows Polish field titles taken from the Studio schema sources. They are generated at development time and committed to `src/generated/field-labels.json`; the app never depends on Studio at runtime. After changing schemas in `apps/studio/schemaTypes`, regenerate the dictionary from this folder:

```bash
bun run generate:labels
```

Duplicate field names with different titles keep the first occurrence (documents win over blocks and Portable Text members); the conflicts are listed on stderr.

## Deploy

**Status (2026-10-02): deployed** as app `vkz2ft2v1wlv5824qsg10qmh` (listed) in organization `o5BEPFjvf`: https://www.sanity.io/@o5BEPFjvf/application/vkz2ft2v1wlv5824qsg10qmh. Redeploy with `bun run deploy` from this folder; `deployment.appId` in `sanity.cli.ts` makes it update the same app. Nothing deploys automatically; there is no CI job for this app.

Who can see it: Sanity has no per-user access list for SDK apps, only organization-wide Dashboard visibility (`default`, `unlisted`, `disabled`). The app is listed (`default`), so everyone in the organization sees it in the Dashboard. Only the accounts in `allowedUsers` get the report; everyone else gets an explanation screen with the signed-in account and a "Poproś o dostęp" mail link to `accessContact` (both in `src/config.ts`), and the app makes no History API request for them.

Thumbnails: the app's hosting origin `https://jcz3l316qbd0.sanity.studio` must be in the project's CORS origins without credentials (`sanity cors add https://jcz3l316qbd0.sanity.studio --no-credentials --project-id fsw3likv`), because inside the Dashboard thumbnails load from `cdn.sanity.io` as cookie-free CORS requests; a recreated app gets a new host, which has to be added the same way.

The steps below describe the first deploy, for redeploying elsewhere (for example another organization). In unattended mode (`-y`) the CLI refuses to create a new app when the organization already has one, so the first deploy has to be interactive.

1. Log in with an account that is an admin/developer of the Sanity organization `o5BEPFjvf` (Audiofast):

   ```bash
   bunx sanity login
   ```

   A robot token with the organization-level `Manage SDK Apps` permission, exported as `SANITY_AUTH_TOKEN`, works as well.

2. Build and deploy from this folder:

   ```bash
   cd apps/cms-activity
   bun run build
   bun run deploy
   ```

   `sanity.cli.ts` sets `visibility: 'default'` (listed for the whole organization) and the title "Raport pracy CMS".

3. The first deploy prints the app id. Add it to `sanity.cli.ts` (replace the TODO comment) and commit it, so later deploys update the same app instead of creating a new one:

   ```ts
   deployment: {
     appId: '<printed app id>',
   },
   ```

4. Open the printed Dashboard URL as `dev@kryptonum.eu`, pick an editor, keep the default last 30 days and press "Pobierz raport". A loaded report is the proof that the Dashboard-issued token can read the History API. If the request fails with 401/403 or a CORS error, switch to the Fallback design described in `context/changes/cms-activity-report/plan.md` (a thin route in `apps/web`).

5. Check the denial path with any org member who is not on the allowlist: the "Brak dostępu do raportu" card appears and the network tab shows no `/data/history` request.

## Adding or removing a person

1. Find the person's Sanity user id (sanity.io/manage → project `fsw3likv` → Members, or `GET https://fsw3likv.api.sanity.io/v2025-02-19/users/me` while logged in as that person).
2. Add `{ id, email }` to `allowedUsers` in `src/config.ts` (removing works the same way). Matching is by id or case-insensitive email.
3. Run the checks and `bun run deploy`.

The person also needs a role in the Sanity project that can read the dataset history (Administrator does; the History API rejects roles without read access). The allowlist only hides the UI, Sanity roles remain the security boundary.

The people in the "Osoba" select are project members that are not robots. Robots (for example the Supabase price sync) and the system author are never listed.

## Reading the report

The screen shows, top to bottom: summary tiles, "Dzień po dniu" (one row per active day, one bar per session on a shared hour axis; clicking a day opens and scrolls to its first session) and "Sesje i zmiany" (one collapsible card per active day with its sessions as rows; a session row opens its changes grouped by document, each with a thumbnail of the document's main image).

- **Sesja**: a run of CMS activity where the gap between consecutive changes is shorter than the "Przerwa między sesjami" value (default 30 min). Sessions are numbered across the whole range.
- **Czas aktywny (ok.)**: the sum of session lengths, from first to last change in the session, with a floor of 5 minutes per session. Reading content without saving leaves no trace in history, so this is an approximation of CMS activity, not working time.
- **Zapisy**: autosaves of the same document by the same person within 5 minutes are merged into one event; the count shows how many saves were merged.
- **Dokumenty**: image and file uploads are not counted as documents; a session card shows them as one line ("Dodano 3 obrazy"). In the "Zmiany" sheet of the export they stay as rows with Typ "Obraz"/"Plik", Akcja "Dodanie obrazu"/"Dodanie pliku", the original file name and a link to the file.
- Studio side effects (the denormalization patch right before a product publish, the review author counter after a review publish) are merged away and do not show as separate edits.
- **Zmienione pola**: top-level fields changed, with the block title for page-builder and other arrays. "(nie udało się odtworzyć)" means the document history could not be replayed for that event; the rest of the report is still correct.

"Eksportuj do Excela" downloads the loaded report as one Excel workbook, `raport-pracy-<osoba>-<od>-<do>.xlsx`. It is an `.xlsx` rather than a CSV on purpose: on double-click Excel splits a CSV by the separator of the computer's regional settings, so no CSV opens in columns on every machine, while an `.xlsx` always does (also in Numbers and Google Sheets). Every cell holds one value; dates and times are real Excel values in Europe/Warsaw, the header row is frozen and has filters, and columns are sized to their content. Two sheets:

- **Sesje**: one row per session — Data, Sesja, Od, Do, Czas (min), Dokumenty, Publikacje, Obrazy, Redaktor. Session lengths are whole minutes, so the column sum equals the "Czas aktywny" tile; a pivot by Data gives the daily totals.
- **Zmiany**: one row per changed field — Data, Godzina, Sesja, Dokument, Typ, Akcja, Pole, Element, Redaktor, Link. An edit of three fields is three rows; a changed page-builder section or other array item goes in Element (one row per item, never truncated). Publish, unpublish, delete and discard are one row with Pole empty (their fields already show on the edits), and so is each upload. Link is a clickable "Otwórz w Studio" (empty for deleted documents) or, for uploads, "Otwórz obraz" / "Otwórz plik". The app's "zapisy" count is not exported: it counts autosaves, not work.

The workbook is written in the browser by a small built-in writer (`src/lib/xlsx.ts`, `src/lib/zip.ts`), with no spreadsheet library.

## Known limits

- **90 days back.** The from-date cannot be older than 90 days. The project currently keeps longer history, but that is not guaranteed by the plan, so the app does not promise more.
- **Activity is not working time.** Only saved changes are recorded. Reading, thinking, work outside the CMS and time in other tools are invisible.
- **One account per person.** The History API records the Sanity user who made the change. If several people share one account, their work is reported as one person and sessions overlap.
- **History API availability.** Sanity lists the full audit trail as an Enterprise feature; it works on this project today. If Sanity restricts it on the current plan, the report stops loading and shows the error state.
- **Load time.** A 90-day report for a busy editor downloads a few thousand transactions and replays every touched document; expect up to ~30 s with the progress text updating.
