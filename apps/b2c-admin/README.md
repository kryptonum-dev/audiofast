# Audiofast B2C Admin

Minimal Sanity App SDK foundation for the Phase 08 B2C admin panel.

## Purpose

This app is the future operator-facing B2C admin surface for orders, coupons, and simple analytics. It is intentionally minimal for now: the first screen only renders a dummy heading so we can verify that the App SDK app runs and deploys.

Privileged Supabase reads and writes must not happen directly in this browser app. Future admin features should call Audiofast backend APIs, and those APIs should keep Supabase service-role access server-side.

## Environment

This scaffold does not use local environment variables. The current App SDK identifiers are public configuration values, not secrets, so they live in `src/config.ts`.

Fill in `organizationId`, `projectId`, and `dataset` there when the real Sanity app details are known. `deploymentAppId` can stay empty until the first successful `sanity deploy` assigns an app id.

## Local Development

```bash
bun run dev
```

The Sanity CLI starts the local App SDK server and prints a Sanity Dashboard URL with a `dev=` parameter.

## Deploy

```bash
bun run deploy
```

Deploying App SDK apps requires an organization admin/developer session, or an organization-level robot token with the `Manage SDK Apps` permission exposed as `SANITY_AUTH_TOKEN`.
