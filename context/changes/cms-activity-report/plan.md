# CMS Activity Report App Implementation Plan

## Overview

Build `apps/cms-activity`, a standalone Sanity App SDK app ("Raport pracy CMS") for the Audiofast Sanity organization. For a chosen editor and date range it shows a daily summary of CMS activity, a list of content changes (document, action, changed fields, session) and exports the same data as CSV. It reads the Sanity History API directly with the logged-in user's token, holds no secrets, and lets only two accounts in (`jarek@audiofast.pl`, `dev@kryptonum.eu`). Client acceptance: 800 PLN net, delivery by end of week (2026-10-04).

## Current State Analysis

- The monorepo already ships one App SDK app, `apps/b2c-admin` (Panel Admina), deployed to org `o5BEPFjvf` via `sanity deploy` (`apps/b2c-admin/sanity.cli.ts`). It is the reference for tooling only: `tsconfig.json` extends `@workspace/typescript-config/react-library.json`, `eslint.config.js` spreads `@workspace/eslint-config/react-internal`, `src/App.tsx` wraps `SanityApp` in `ThemeProvider` from `@sanity/ui` with `buildTheme()` and `usePrefersDark()`. By decision nothing from it is imported or shared.
- Nothing in the repo calls the History API today. The only non-GROQ Sanity calls are `users.getById('me')` and `projects.list` on the web server side.
- Verified live on 2026-09-29 against project `fsw3likv`, dataset `production`:
  - `GET /v2025-02-19/data/history/production/transactions?excludeContent=true&effectFormat=mendoza&authors=<id>&fromTime=…&toTime=…&limit=1000` returns NDJSON (`application/x-ndjson`), one transaction per line: `{id, timestamp, author, documentIDs, mutations, effects, sequenceNumber}`.
  - `excludeContent=false` returns 403 for every token (API rule). Mutations therefore carry only ids (`patch: {id, unsetIsEmpty}`, `createOrReplace: {_id}`, `delete: {id, purge}`), no field content. Field-level information is only in `effects[docId].apply/revert` (mendoza patches).
  - `GET /data/history/production/documents/<id>?time=<iso>` returns `{documents: [<doc at that time>]}`.
  - `GET https://fsw3likv.api.sanity.io/v2025-02-19/users/<id1,id2>` returns `displayName` and `email` for project users.
  - Volume: ~5.5k transactions and 1016 distinct documents in 90 days. Damian Machnik (`pZmmNCQ7y`, Editor) 3.6k; robots `pHocLvO6q` (Supabase Price Sync) 1.6k, `ppbmEYAVq`, `pbonL6kuJ`; system author `god`. Jarek is `p54InZnMK`, Kryptonum Team (`dev@kryptonum.eu`) is `p3oltYQ6U`, both Administrator.
  - Oldest transaction 2025-08-15, so retention on this project is longer than the documented 90 days for Growth. We still cap the UI at 90 days.
- Installed packages: `@sanity/sdk-react` 2.20.1 (`useCurrentUser`, `useClient({apiVersion})`, `useProject()` with `members[] {id, isRobot, roles}`), `@sanity/client` 7.26.2 (`client.request({uri, query})` returns the raw NDJSON string because get-it only JSON-parses `application/json`), `mendoza` 3.0.8 (`applyPatch(left, patch)`, no differ), `@sanity/cli` 8.2.1 / `@sanity/cli-core` (`app.visibility?: 'default' | 'unlisted' | 'disabled'`).
- Studio-side noise that shows up in history under the editor's identity (`apps/studio/actions/wrap-publish-with-denorm.ts`): a draft patch with denormalized fields committed synchronously right before a product publish; a `reviewAuthor` count transaction ~0.8 s after a review publish. The bulk-actions table and the Comparator write raw transactions (`createOrReplace` + `delete drafts.X`, patches on published docs) without going through document actions.
- Field titles in Polish live only in Studio schema source (`apps/studio/schemaTypes/**`, ~600 `name`/`title` pairs). The extracted `apps/studio/schema.json` has types but no titles.
- Root `.gitignore` ignores `*.csv`.

## Desired End State

- `apps/cms-activity` exists as a Bun workspace, builds with `sanity build`, is deployed to org `o5BEPFjvf` with `visibility: 'unlisted'` and title "Raport pracy CMS", and is reachable from the Sanity Dashboard by link.
- Opening it as `jarek@audiofast.pl` or `dev@kryptonum.eu` shows: person select (humans only), from/to date inputs (default last 30 days, from-date not older than 90 days), session gap input (default 30 min), "Pobierz raport" button.
- After loading: a daily summary table (date, first activity, last activity, sessions, approximate active time, documents, publishes) and an events table (date & time, editor, document with Studio link, type, action, changed fields, saves merged, session). "Eksportuj CSV" downloads a `;`-separated UTF-8-with-BOM file with the same columns.
- Opening it as anyone else shows a "Brak dostępu do raportu" card and the app performs no History API request.
- No changes in `apps/web`, no new Vercel env vars, nothing imported from `apps/b2c-admin`.

Verification: `bun run turbo check-types lint build --filter=cms-activity` passes; manual walkthrough in the Dashboard with the dev@ account for Damian over the last 30 days; CSV opens in Excel (pl-PL) with correct columns and diacritics.

### Key Discoveries:

- Dataset-wide transactions endpoint works with `authors` filter and time window; page by `fromTime = last timestamp` and de-duplicate by `id` (boundary inclusivity unverified, `limit` max unverified beyond 5.5k).
- Mendoza effects must be applied to the exact previous version of the document. Reconstruction therefore needs every transaction on that document in the window, not only the selected author's, fetched per document via `GET /data/history/{ds}/transactions/{ids}?excludeContent=true&effectFormat=mendoza&includeIdentifiedDocumentsOnly=true&fromTime&toTime`.
- Studio's own classification of an effect (`sanity` 6.10.1, `FormField-*.js`): `revert` starts with `[0, null]` → document created; `apply` starts with `[0, null]` → deleted; otherwise modified. Studio merges same-author edits within 5 minutes.
- `app.visibility: 'unlisted'` is supported by the installed CLI (`node_modules/@sanity/cli-core/dist/cliConfig-*.d.ts:68`).
- `apps/b2c-admin/sanity.cli.ts` sets `vite.server.hmr: false`; mirror it (Dashboard iframe).
- Studio deep link pattern already used in the repo: `${studioUrl}/intent/edit/id=${id};type=${type}` with `studioUrl = https://www.sanity.io/@o5BEPFjvf/studio/dlwt2zhgkk7rjx6dj8rdyjfz/default`.

## What We're NOT Doing

- No backend route, no Supabase persistence, no cron, no changes to `apps/web` or `apps/b2c-admin` (unless the Phase 1 spike fails; see Fallback).
- No automated tests (owner decision 2026-09-29). Verification is type-check, lint, build and manual checks.
- No FastGIS deployment. Only `src/config.ts` may reference Audiofast ids so the app can be redeployed elsewhere later.
- No date ranges beyond 90 days back, no history of robots or the system author, no per-character diffs inside Portable Text.
- No CI workflow for the app; deploy is manual like b2c-admin.
- No i18n; UI copy is Polish, code and docs English.

## Implementation Approach

One new workspace, browser-only. The app authenticates through the Dashboard (App SDK), gates the UI on `useCurrentUser()` against a static allowlist, then uses `useClient({apiVersion: '2025-02-19'})` to call History API endpoints on the project host with the user's own token. Pure logic lives in `src/lib/*` as framework-free TypeScript so it stays portable. Phases go bottom-up: skeleton and access first (the spike decides whether the no-backend design holds), then data, then UI, then the changed-fields reconstruction, then deploy and handover.

Polish field labels are generated at development time by a script that scans Studio schema sources for `name`/`title` pairs and writes a committed JSON dictionary. Runtime has no dependency on Studio.

## Critical Implementation Details

**Reconstruction chain must be author-agnostic.** The events list is fetched with `authors=<selected>`, but the changed-fields step needs, per touched document, all transactions in the window from the per-document endpoint, applied in ascending order to the snapshot taken at `fromTime`. Applying only the selected author's effects to a snapshot yields wrong documents whenever someone else edited in between.

**Snapshots for documents created inside the window.** `documents/{ids}?time=<fromTime>` omits documents that did not exist yet; start those from `null` and expect the first effect's `revert` to be `[0, null]`. Deleted documents need `documents/{id}?lastRevision=true` for their name and type.

**NDJSON via `client.request`.** The response is not JSON-parsed by the client; it arrives as a string (browser). Split on `\n`, skip empty lines, and treat a line with an `error` key as a failure. Error responses (403/400) are `application/json` and surface as thrown errors.

**Time zone.** All display and daily grouping use `Europe/Warsaw` through `Intl.DateTimeFormat`; API params are UTC ISO strings (`from` = local midnight, `to` = local 23:59:59.999 converted to UTC).

## Phase 1: Scaffold, Access Gate and Token Spike

### Overview

Create the workspace, boot it locally and in the Dashboard, prove the Dashboard-issued token can read `/data/history`, and mint the app id with a first unlisted deploy.

### Changes Required:

#### 1. Workspace files

**File**: `apps/cms-activity/package.json`

**Design**: none — tooling.

**Intent**: Register the app as a Bun workspace with the same script names as b2c-admin (`dev` on port 3335, `build`, `deploy`, `check-types`, `lint`) so turbo picks it up.

**Contract**: `name: "cms-activity"`, `type: module`, deps `@sanity/sdk-react`, `@sanity/ui`, `@sanity/icons`, `sanity`, `react`, `react-dom`, `styled-components`, `mendoza`; dev deps `typescript`, `eslint`, `@types/react`, `@types/react-dom`, `@types/node`, `@workspace/eslint-config`, `@workspace/typescript-config`. Pin versions to those already in `apps/b2c-admin/package.json` so Bun dedupes. No vitest.

**File**: `apps/cms-activity/sanity.cli.ts`

**Design**: none — tooling.

**Intent**: Declare the App SDK app for org `o5BEPFjvf`, unlisted, titled "Raport pracy CMS".

**Contract**: `defineCliConfig({ app: { organizationId: 'o5BEPFjvf', entry: './src/App.tsx', icon: './app-icon.svg', title: 'Raport pracy CMS', visibility: 'unlisted' }, vite: (c) => ({ ...c, server: { ...c.server, hmr: false } }) })`. `deployment.appId` is added after the first deploy in this phase.

**Files**: `apps/cms-activity/tsconfig.json`, `apps/cms-activity/eslint.config.js`, `apps/cms-activity/.gitignore`, `apps/cms-activity/app-icon.svg`, `apps/cms-activity/README.md`

**Design**: none — tooling.

**Intent**: Mirror b2c-admin's config shape (tsconfig extends `react-library.json` with `jsx: react-jsx`, DOM libs, `types: ["node", "vite/client"]`, include `src` and `sanity.cli.ts`; eslint spreads `react-internal` and ignores `dist`; gitignore `dist`, `.sanity`). README documents purpose, access model, dev, deploy and CORS note.

**File**: `package.json` (root)

**Design**: none — tooling.

**Intent**: Add `dev:cms-activity` script mirroring `dev:b2c-admin`.

**Contract**: `"dev:cms-activity": "bun run turbo dev --filter=cms-activity"`.

#### 2. App shell and config

**File**: `apps/cms-activity/src/config.ts`

**Design**: none — configuration constants.

**Intent**: Hold every project-specific value in one place so redeploying for another project is a config change.

**Contract**: exports `appConfig` with `organizationId`, `projectId: 'fsw3likv'`, `dataset: 'production'`, `apiVersion: '2025-02-19'`, `studioUrl`, `allowedUsers: [{ id: 'p54InZnMK', email: 'jarek@audiofast.pl' }, { id: 'p3oltYQ6U', email: 'dev@kryptonum.eu' }]`, `limits: { maxRangeDays: 90, defaultRangeDays: 30, defaultSessionGapMinutes: 30, minSessionMinutes: 5, mergeWindowMinutes: 5, pageSize: 1000, snapshotBatchSize: 50 }`, `timeZone: 'Europe/Warsaw'`.

**File**: `apps/cms-activity/src/App.tsx`, `apps/cms-activity/src/App.css`

**Design**: undrawn — Sanity UI defaults, same shell as b2c-admin (ThemeProvider + prefers-dark + SanityApp with a Spinner fallback).

**Intent**: Boot the SDK for the configured project and render `<AccessGate>` around `<ReportApp>`.

**Contract**: `SanityApp config={[{ projectId, dataset }]}`.

**File**: `apps/cms-activity/src/access/AccessGate.tsx`, `apps/cms-activity/src/access/is-allowed.ts`

**Design**: undrawn — a single centered `Card` with heading "Brak dostępu do raportu" and one sentence.

**Intent**: Only render children when the current user matches the allowlist; otherwise render the denial card. No data hook may be mounted below the gate for denied users.

**Contract**: `isAllowedUser(user: {id: string; email?: string | null}, allowed: AllowedUser[]): boolean` matches on id OR case-insensitive email. `AccessGate` uses `useCurrentUser()`; while the user is undefined show a spinner.

#### 3. Spike: History API from the app

**File**: `apps/cms-activity/src/lib/history-client.ts` (first version)

**Design**: none — data access.

**Intent**: Prove the app's client can call the project-host History endpoint. Implement `fetchTransactionsPage` for real (it is reused in Phase 2) and wire a temporary "Test połączenia" button behind the gate that requests `limit=3` for the last 7 days and prints the count.

**Contract**: `fetchTransactionsPage(client, { dataset, authors?, fromTime, toTime, limit }): Promise<HistoryTransaction[]>` calling `client.request<string>({ uri: \`/data/history/${dataset}/transactions\`, query: { excludeContent: 'true', effectFormat: 'mendoza', fromTime, toTime, limit: String(limit), ...(authors ? { authors: authors.join(',') } : {}) } })` and parsing NDJSON via `parseNdjson` in `src/lib/ndjson.ts`.

#### 4. Environment and first deploy

**Manual steps** (document in README): add `http://localhost:3335` with credentials to the project's CORS origins in sanity.io/manage; run `bun install` at root; `bun run dev:cms-activity`; log in as dev@ and press "Test połączenia". Then `cd apps/cms-activity && bun run deploy` with an org admin session, copy the printed app id into `sanity.cli.ts` `deployment.appId`, open the app from the Dashboard and repeat the test there (Dashboard token is the real target of the spike).

**Decision gate**: if the Dashboard request returns 200 with NDJSON, continue to Phase 2 as planned. If it fails with 401/403/CORS, switch to the Fallback design (end of this document) before Phase 2 and record the outcome in `change.md` Notes.

### Success Criteria:

#### Automated Verification:

- Workspace installs and type-checks: `bun install && bun run turbo check-types --filter=cms-activity`
- Lint passes: `bun run turbo lint --filter=cms-activity`
- App builds: `cd apps/cms-activity && bun run build`
- `apps/cms-activity/sanity.cli.ts` contains a non-empty `deployment.appId` after the first deploy: `grep -q "appId: '" apps/cms-activity/sanity.cli.ts`

#### Manual Verification:

- Local `sanity dev` on port 3335 logs in and shows the report shell for dev@; a second, non-allowlisted account sees "Brak dostępu do raportu".
- "Test połączenia" prints a transaction count locally and inside the Dashboard-hosted app.
- The app is listed as unlisted in the Dashboard (not visible on the org home page, reachable by link).

---

## Phase 2: Data Layer (`src/lib`)

### Overview

Framework-free modules that turn History API output into report rows: paging, member resolution, action classification, noise merging, sessions and the daily summary.

### Changes Required:

#### 1. History access

**File**: `apps/cms-activity/src/lib/history-client.ts`

**Design**: none — data access.

**Intent**: Complete the client: page the dataset-wide list, fetch per-document transaction chains, snapshots and last revisions.

**Contract**:
- `fetchAllTransactions(client, { dataset, authors, fromTime, toTime, pageSize, onProgress? })`: loop `fetchTransactionsPage` with `fromTime = last.timestamp`, de-duplicate by `id`, stop when a page yields fewer than `pageSize` or no new ids; hard stop at 100 pages.
- `fetchDocumentTransactions(client, { dataset, ids, fromTime, toTime })`: `GET /data/history/${dataset}/transactions/${ids.join(',')}` with `excludeContent=true&effectFormat=mendoza&includeIdentifiedDocumentsOnly=true&fromTime&toTime`, ids batched by `snapshotBatchSize`.
- `fetchSnapshots(client, { dataset, ids, time })`: `GET /data/history/${dataset}/documents/${ids}?time=` → `Map<id, doc>`; missing ids absent from the map.
- `fetchLastRevision(client, { dataset, id })`: `?lastRevision=true`.
- Types in `src/lib/types.ts`: `HistoryTransaction { id; timestamp; author; documentIDs: string[]; mutations: HistoryMutation[]; effects?: Record<string, { apply: unknown[]; revert: unknown[] }> }`.

**File**: `apps/cms-activity/src/lib/ndjson.ts`

**Design**: none.

**Intent**: Parse the raw NDJSON string safely.

**Contract**: `parseNdjson<T>(raw: unknown): T[]` accepts string, Uint8Array/Buffer or an already-parsed object/array; throws `HistoryApiError` when a line contains an `error` key.

#### 2. People

**File**: `apps/cms-activity/src/lib/members.ts`

**Design**: none.

**Intent**: Build the person picker list and an author-id → display name map.

**Contract**: `selectHumanMembers(members: ProjectMember[])` filters `isRobot === false`; `resolveUserProfiles(client, ids)` calls `GET /users/${ids.join(',')}` on the project host and returns `Map<id, { displayName; email }>`; `authorLabel(id, profiles)` falls back to `Robot (<id>)` for unknown `p…` ids and `System` for `god`.

#### 3. Classification and merging

**File**: `apps/cms-activity/src/lib/classify.ts`

**Design**: none.

**Intent**: Convert one transaction into zero or more `ActivityEvent`s using effect shapes, independent of how the write was made (Studio action, bulk table, Comparator).

**Contract**: `classifyTransaction(tx): ActivityEvent[]`. Group `documentIDs` by published id (`stripDraft`). Per group compute draft/published effect kind (`created | deleted | modified | none` from `revert`/`apply` starting with `[0, null]`). Map: published created or modified AND draft deleted → `publish`; published deleted AND draft created → `unpublish`; only draft deleted → `discard`; published deleted (draft deleted or none) → `delete`; draft created → `create`; draft modified → `edit`; published modified/created without draft change → `edit` with `direct: true`. `ActivityEvent { id; at; authorId; documentId; docType?: string; action; direct?: boolean; mergedCount: 1; changedFields: string[] }`.

**File**: `apps/cms-activity/src/lib/merge.ts`

**Design**: none.

**Intent**: Remove Studio side effects and collapse autosaves.

**Contract**: `mergeNoise(events, { mergeWindowMinutes })`, run after document types are known: (a) drop an `edit` on a document when the same author publishes the same document within 5 s afterwards (denorm pre-publish patch); (b) drop `edit`/`direct` events on `reviewAuthor` documents within 3 s after a `publish` of a `review` by the same author; (c) merge consecutive `edit`/`create` events on the same document by the same author within `mergeWindowMinutes` into one event with `mergedCount` summed, `at` = first, `changedFields` unioned.

#### 4. Sessions and summary

**File**: `apps/cms-activity/src/lib/sessions.ts`

**Design**: none.

**Intent**: Assign session numbers and compute active time.

**Contract**: `assignSessions(events, { gapMinutes, minSessionMinutes })` sorts by `at`, starts a new session when the gap exceeds `gapMinutes`, returns events with `sessionIndex` (1-based, per whole range) plus `Session { index; start; end; durationMinutes: max(end - start, minSessionMinutes); eventCount }`.

**File**: `apps/cms-activity/src/lib/summary.ts`

**Design**: none.

**Intent**: Daily rollup in Europe/Warsaw.

**Contract**: `buildDailySummary(events, sessions, timeZone)` → `DailyRow { date: 'YYYY-MM-DD'; firstAt; lastAt; sessions; activeMinutes; documents; publishes }[]`, plus a totals row.

**File**: `apps/cms-activity/src/lib/time.ts`

**Design**: none.

**Intent**: Range validation and formatting helpers.

**Contract**: `toRangeIso(from: 'YYYY-MM-DD', to, timeZone)` → `{ fromTime, toTime }` UTC; `validateRange(from, to, { maxRangeDays, today })` → error message in Polish or null; `formatDateTime(iso, timeZone)` → `DD.MM.YYYY HH:mm`; `formatMinutes(n)` → `Xh Ymin`.

#### 5. Names and links

**File**: `apps/cms-activity/src/lib/documents.ts`

**Design**: none.

**Intent**: Resolve human-readable names and types for every touched document, including deleted ones.

**Contract**: `resolveDocuments(client, ids)` runs GROQ `*[_id in $ids]{_id, _type, "name": coalesce(select(_type == "product" => brand->name + " " + name), name, pt::text(title), question, heading, label)}` for both `id` and `drafts.id`, prefers the draft name, then `fetchLastRevision` for ids still unresolved; returns `Map<publishedId, { name; type; deleted: boolean }>`. `studioEditUrl(studioUrl, id, type)` → `${studioUrl}/intent/edit/id=${id};type=${type}`.

#### 6. Orchestration

**File**: `apps/cms-activity/src/lib/build-report.ts`

**Design**: none.

**Intent**: One async function the UI calls.

**Contract**: `buildReport(client, config, { authorId, from, to, gapMinutes, onProgress })` → `Report { events; sessions; daily; meta: { authorId; fromTime; toTime; transactionCount; truncated: boolean } }`. Order: fetch transactions → classify → resolve documents → mergeNoise → (Phase 4: changed fields) → assignSessions → buildDailySummary.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `bun run turbo check-types --filter=cms-activity`
- Lint passes: `bun run turbo lint --filter=cms-activity`
- Build passes: `cd apps/cms-activity && bun run build`

#### Manual Verification:

- Temporary debug output (console) for Damian, last 30 days: transaction count matches a direct curl of the same query; every publish of a product shows as one `publish` row, not `edit` + `publish`.
- Robots are absent from the picker; `god` never appears as an author.

---

## Phase 3: Report UI and CSV

### Overview

The screens Jarek uses: filters, daily summary, events table, states, CSV download. Sanity UI components, Polish copy.

### Changes Required:

#### 1. Screens

**File**: `apps/cms-activity/src/components/ReportApp.tsx`

**Design**: undrawn — Sanity UI layout: heading "Raport pracy CMS", filter `Card`, results below; states as `Card` with tone.

**Intent**: Own filter state and the `idle | loading | ready | error` state machine; call `buildReport`; keep previous data while reloading; support cancel via `AbortSignal` passed to `client.request`.

**Contract**: filters `{ authorId; from; to; gapMinutes }`; default `from = today - 30d`, `to = today`; disable "Pobierz raport" while invalid; show progress text from `onProgress` ("Pobrano 2000 transakcji…").

**File**: `apps/cms-activity/src/components/Filters.tsx`

**Design**: undrawn — `Grid columns={[1,2,4]}`: `Select` person, two `TextInput type="date"`, `TextInput type="number"` for gap with label "Przerwa między sesjami (min)", button.

**Intent**: Person list from `useProject()` members filtered by `selectHumanMembers` and labelled via `resolveUserProfiles`; date min attribute set to today - 90 days; inline validation message from `validateRange`.

**File**: `apps/cms-activity/src/components/DailySummary.tsx`

**Design**: undrawn — plain `<table>` in a `Card`, columns: Data, Pierwsza aktywność, Ostatnia aktywność, Sesje, Czas aktywny (ok.), Dokumenty, Publikacje; totals row; footnote "Czas aktywny to przybliżenie aktywności w CMS, nie czasu pracy."

**File**: `apps/cms-activity/src/components/EventsTable.tsx`

**Design**: undrawn — plain `<table>`, columns: Data i godzina, Redaktor, Dokument (link, `target=_blank`), Typ, Akcja (`Badge`), Zmienione pola, Zapisy, Sesja. Rows grouped visually by session with a thin separator. Action labels: Edycja, Utworzenie, Publikacja, Cofnięcie publikacji, Usunięcie, Odrzucenie szkicu, and "Edycja opublikowanej wersji" when `direct`.

**File**: `apps/cms-activity/src/components/StateCard.tsx`

**Design**: undrawn — `Card` with tone `critical` for errors (message from `HistoryApiError` or a Polish fallback "Nie udało się pobrać historii z Sanity."), `transparent` for empty ("Brak aktywności w wybranym okresie.").

#### 2. CSV

**File**: `apps/cms-activity/src/lib/csv.ts`

**Design**: none.

**Intent**: Excel (pl-PL) friendly export of the events table with the same columns plus ISO date.

**Contract**: `buildCsv(rows: string[][]): string` with `;` separator, CRLF line endings, `"` quoting when a cell contains `;`, `"` or newline, leading `﻿`. Header: `Data i godzina;Redaktor;Dokument;Typ;Link;Akcja;Zmienione pola;Zapisy;Sesja`. Dates as `YYYY-MM-DD HH:mm` (text).

**File**: `apps/cms-activity/src/components/ExportButton.tsx`

**Design**: undrawn — `Button text="Eksportuj CSV" icon={DownloadIcon}`, disabled until ready.

**Intent**: Blob download `raport-pracy-<slug(author)>-<from>-<to>.csv` via a temporary anchor and `URL.revokeObjectURL`.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `bun run turbo check-types --filter=cms-activity`
- Lint passes: `bun run turbo lint --filter=cms-activity`
- Build passes: `cd apps/cms-activity && bun run build`

#### Manual Verification:

- Damian, last 30 days: daily summary and events render, links open the right document in Studio, session numbering is contiguous, active time looks plausible against the events.
- From-date older than 90 days is blocked with a Polish message; to < from is blocked.
- Empty range shows the empty state; disconnecting the network shows the error state and "Spróbuj ponownie".
- CSV opens in Excel by double-click with separate columns and correct diacritics (ł, ś, ż).

---

## Phase 4: Changed Fields (Mendoza Reconstruction)

### Overview

Fill the "Zmienione pola" column with Polish labels of top-level fields and, for arrays, the block type or name of the changed item.

### Changes Required:

#### 1. Label dictionary

**File**: `apps/cms-activity/scripts/generate-field-labels.ts`, `apps/cms-activity/src/generated/field-labels.json`

**Design**: none.

**Intent**: Development-time generator that scans `apps/studio/schemaTypes/**/*.{ts,tsx}` for `defineField`/`defineType`/`defineArrayMember` objects and records `name → title` (fields) and type `name → title` (document/object types). Committed output; script exposed as `bun run generate:labels`.

**Contract**: JSON shape `{ fields: Record<string, string>, types: Record<string, string> }`. On duplicate names with different titles keep the first occurrence and log the conflict to stderr. Runtime lookup in `src/lib/field-labels.ts`: `fieldLabel(path: string[], typeHint?: string)` → `fields[name] ?? humanize(name)`; block label → `types[_type] ?? name ?? _type`.

#### 2. Reconstruction and diff

**File**: `apps/cms-activity/src/lib/field-diff.ts`

**Design**: none.

**Intent**: Given a previous and next document, list changed top-level fields, and for array fields the identity of changed items.

**Contract**: `diffDocuments(prev, next): ChangedField[]` where `ChangedField { field: string; item?: { key?: string; type?: string; name?: string } }`. Ignore `_rev`, `_updatedAt`, `_createdAt`, `_id`, `_type`, `_system`. For arrays compare items by `_key` (added/removed/deep-changed); item `type` is `_type`, `name` is `name ?? title ?? label ?? heading` when a string. `formatChangedFields(changes, labels)` → e.g. `Opis`, `Sekcje: Hero`, `Dane techniczne: Moc`.

**File**: `apps/cms-activity/src/lib/reconstruct.ts`

**Design**: none.

**Intent**: Attach `changedFields` to each event of the selected author by replaying every transaction on each touched document.

**Contract**: `attachChangedFields(client, config, { events, fromTime, toTime, onProgress })`: (1) collect touched ids (published and draft variants); (2) `fetchSnapshots` at `fromTime` in batches; (3) `fetchDocumentTransactions` for the same ids (all authors); (4) per document id, sort transactions ascending, `next = applyPatch(prev, effects[id].apply)`; when `tx.author === selected` compute `diffDocuments(prev, next)` and store by `tx.id` + document id; (5) map back onto events (union across merged transactions). Wrap `applyPatch` in try/catch; on failure mark the event `changedFields = ['(nie udało się odtworzyć)']` and continue.

**File**: `apps/cms-activity/src/lib/build-report.ts`

**Intent**: Call `attachChangedFields` between `mergeNoise` and `assignSessions`; merged events carry the merged transaction ids so their field sets can be unioned.

### Success Criteria:

#### Automated Verification:

- Generator runs and output is non-empty: `cd apps/cms-activity && bun run generate:labels && test -s src/generated/field-labels.json`
- Type-check passes: `bun run turbo check-types --filter=cms-activity`
- Lint passes: `bun run turbo lint --filter=cms-activity`
- Build passes: `cd apps/cms-activity && bun run build`

#### Manual Verification:

- Edit one known field on a test product as dev@ (e.g. `subtitle`), publish, run the report for dev@ for today: the edit row shows "Podtytuł" (or the schema title), the publish row shows the same field.
- A page-builder edit shows `Sekcje: <block title>`.
- A document created and deleted inside the range does not crash the report.
- Loading time for Damian over 90 days stays under ~30 s on a normal connection; progress text updates during snapshots.

---

## Phase 5: Deploy, Docs and Handover

### Overview

Production deploy, verification with the dev@ account, repo documentation, and the handover message to the client.

### Changes Required:

#### 1. Cleanup and deploy

**Files**: `apps/cms-activity/src/**`

**Intent**: Remove the Phase 1 "Test połączenia" button and debug logging; `bun run deploy` from `apps/cms-activity` with an org admin session; confirm the Dashboard link.

#### 2. Documentation

**File**: `apps/cms-activity/README.md`

**Intent**: Purpose, access model (allowlist in `config.ts`, unlisted visibility, Sanity roles as the boundary), local dev (CORS origin, port 3335), deploy, how to add a person, how to regenerate labels, known limits (90 days, activity ≠ working time, shared accounts).

**Files**: `README.md` (root), `CLAUDE.md` (monorepo layout section)

**Intent**: Add the fourth app in one line each; note that SCSS rules do not apply to App SDK apps.

**File**: `context/changes/cms-activity-report/change.md`

**Intent**: Record spike outcome, deployed app id and Dashboard URL in Notes.

#### 3. Client handover (manual)

Draft the email to Jarek with the `email-draft` skill (draft only, never send): link, who has access, how to read sessions and active time, CSV, the 90-day limit, the "own account per person" reminder.

### Success Criteria:

#### Automated Verification:

- Type-check passes: `bun run turbo check-types --filter=cms-activity`
- Lint passes: `bun run turbo lint --filter=cms-activity`
- Build passes: `cd apps/cms-activity && bun run build`
- No debug artefacts remain: `! grep -rn "Test połączenia\|console.log" apps/cms-activity/src`

#### Manual Verification:

- Dashboard app opens for dev@, full flow works for Damian over the last 30 days, CSV downloads.
- A non-allowlisted org member opening the link sees the denial card and the network tab shows no `/data/history` request.
- Email draft exists in Gmail drafts for Oliwier to review and send.

---

## Fallback Design (only if the Phase 1 spike fails)

Approved on 2026-09-29 as the contingency: keep the app as is, but move History API calls behind a thin route in `apps/web` that shares nothing with B2C code.

- Route `apps/web/src/app/api/cms-activity/history/route.ts` (GET, OPTIONS) proxying `transactions`, `documents` and `users` calls with a server-only token `SANITY_HISTORY_READ_TOKEN`; new module `apps/web/src/global/cms-activity/server/auth.ts` verifying the forwarded bearer with `users.getById('me')` against `CMS_ACTIVITY_ALLOWED_EMAILS`/`CMS_ACTIVITY_ALLOWED_USER_IDS`; CORS from `CMS_ACTIVITY_ALLOWED_ORIGINS` (`https://www.sanity.io`, `http://localhost:3335`). All three vars added to `turbo.json` `globalEnv`, `apps/web/.env.example` and Vercel.
- App side: `history-client.ts` gains a transport switch (`direct | proxy`) selected in `config.ts`; the proxy transport sends `Authorization: Bearer ${useAuthToken()}` and a `path` query.
- Everything in Phases 2–5 stays unchanged.

## Testing Strategy

No automated tests by owner decision. Each phase gates on type-check, lint and build. Manual checks are listed per phase; the reference scenario is Damian Machnik, last 30 days, run with the dev@ account.

## Performance Considerations

- ~5.5k transactions per 90 days for all authors, ~3.6k for the selected editor; one page of 1000 with effects is a few MB. Keep page size at 1000 and show progress.
- Changed fields add one snapshot batch call per 50 documents plus one per-document transaction batch per 50 documents. For ~500 touched documents that is ~20 requests. Run batches with a concurrency of 3.
- Do all processing in memory in the browser; no caching between runs.

## Migration Notes

None. New app, no data model changes, no env changes in the primary design.

## References

- Change notes and live findings: `context/changes/cms-activity-report/change.md`
- Reference App SDK app: `apps/b2c-admin/src/App.tsx`, `apps/b2c-admin/sanity.cli.ts`, `apps/b2c-admin/tsconfig.json`, `apps/b2c-admin/eslint.config.js`
- Date inputs pattern: `apps/studio/tools/newsletter/index.tsx:503-508, 959-975`
- Blob download pattern: `apps/studio/tools/newsletter/index.tsx:883-891`
- Studio side effects to merge: `apps/studio/actions/wrap-publish-with-denorm.ts:60-109`
- Studio deep link: `apps/b2c-admin/src/admin/components/CouponProductPicker.tsx:224-229`
- CLI app visibility type: `node_modules/@sanity/cli-core/dist/cliConfig-*.d.ts:36-68`
- Sanity History API reference: https://www.sanity.io/docs/http-reference/history

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scaffold, Access Gate and Token Spike

- [x] 1.1 Workspace installs and type-checks: `bun install && bun run turbo check-types --filter=cms-activity`
- [x] 1.2 Lint passes: `bun run turbo lint --filter=cms-activity`
- [x] 1.3 App builds: `cd apps/cms-activity && bun run build`
- [ ] 1.4 `apps/cms-activity/sanity.cli.ts` contains a non-empty `deployment.appId` after the first deploy

### Phase 2: Data Layer (`src/lib`)

- [ ] 2.1 Type-check passes: `bun run turbo check-types --filter=cms-activity`
- [ ] 2.2 Lint passes: `bun run turbo lint --filter=cms-activity`
- [ ] 2.3 Build passes: `cd apps/cms-activity && bun run build`

### Phase 3: Report UI and CSV

- [ ] 3.1 Type-check passes: `bun run turbo check-types --filter=cms-activity`
- [ ] 3.2 Lint passes: `bun run turbo lint --filter=cms-activity`
- [ ] 3.3 Build passes: `cd apps/cms-activity && bun run build`

### Phase 4: Changed Fields (Mendoza Reconstruction)

- [ ] 4.1 Generator runs and output is non-empty: `cd apps/cms-activity && bun run generate:labels && test -s src/generated/field-labels.json`
- [ ] 4.2 Type-check passes: `bun run turbo check-types --filter=cms-activity`
- [ ] 4.3 Lint passes: `bun run turbo lint --filter=cms-activity`
- [ ] 4.4 Build passes: `cd apps/cms-activity && bun run build`

### Phase 5: Deploy, Docs and Handover

- [ ] 5.1 Type-check passes: `bun run turbo check-types --filter=cms-activity`
- [ ] 5.2 Lint passes: `bun run turbo lint --filter=cms-activity`
- [ ] 5.3 Build passes: `cd apps/cms-activity && bun run build`
- [ ] 5.4 No debug artefacts remain: `! grep -rn "Test połączenia\|console.log" apps/cms-activity/src`
