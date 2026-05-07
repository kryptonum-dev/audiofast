# Audiofast B2C Admin

Minimal Sanity App SDK foundation for the Phase 08 B2C admin panel.

## Purpose

This app is the future operator-facing B2C admin surface for orders, coupons, and simple analytics. It is intentionally minimal for now: the first screen only renders a dummy heading so we can verify that the App SDK app runs and deploys.

Privileged Supabase reads and writes must not happen directly in this browser app. Future admin features should call Audiofast backend APIs, and those APIs should keep Supabase service-role access server-side.

## Environment

The App SDK identifiers are public configuration values, not secrets, so they live in `src/config.ts`.

`VITE_B2C_ADMIN_API_BASE_URL` can override the deployed Audiofast Web/API origin at build time. If it is unset, the app falls back to the current preview API origin in `src/config.ts`.

The matching Web/API deployment must include the App SDK origin in `B2C_ADMIN_ALLOWED_ORIGINS`; otherwise browser CORS will fail before the app can read the API error envelope.

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
