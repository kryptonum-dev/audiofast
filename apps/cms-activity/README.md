# Raport pracy CMS (cms-activity)

Standalone Sanity App SDK app for the Audiofast Sanity organization. For a chosen editor and date range it reports CMS activity (daily summary, list of content changes, CSV export) based on the Sanity History API.

## Purpose

The client (Audiofast) wants to see how much time an editor spends working in the CMS. The app reads `/data/history/{dataset}/transactions` for the selected person, groups the transactions into sessions and shows what changed. Active time is an approximation of CMS activity, not working time.

## Access model

- The app holds no secrets. All requests go to the project host with the logged-in user's own token (`useClient` from `@sanity/sdk-react`), so Sanity project roles are the security boundary.
- On top of that, an in-app allowlist in `src/config.ts` (`allowedUsers`, matched by user id or case-insensitive email) decides who sees the report. Everyone else gets a "Brak dostępu do raportu" card and the app makes no History API request.
- The app is deployed with `visibility: 'unlisted'`: it is not shown on the organization home page and is opened by direct link.

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

The owner deploys manually:

```bash
cd apps/cms-activity
bun run deploy
```

Deploying App SDK apps requires an organization admin/developer session, or an organization-level robot token with the `Manage SDK Apps` permission exposed as `SANITY_AUTH_TOKEN`.

The first deploy prints the app id. Add it to `sanity.cli.ts` and commit it, so later deploys update the same app instead of creating a new one:

```ts
deployment: {
  appId: '<printed app id>',
},
```

After deploying, open the app from the Sanity Dashboard and use "Test połączenia" to confirm the Dashboard-issued token can read the History API (the temporary button is removed before handover).
