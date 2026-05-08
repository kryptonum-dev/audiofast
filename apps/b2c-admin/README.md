# Audiofast B2C Admin

Sanity App SDK admin app for the Phase 08 B2C operations panel.

## Purpose

This app is the operator-facing B2C admin surface for orders, coupons, and simple analytics.

Privileged Supabase reads and writes must not happen directly in this browser app. Future admin features should call Audiofast backend APIs, and those APIs should keep Supabase service-role access server-side.

## Environment

The App SDK identifiers are public configuration values, not secrets, so they live in `src/config.ts`.

`VITE_B2C_ADMIN_API_BASE_URL` can override the deployed Audiofast Web/API origin at build time. The local `dev` script defaults this value to `http://localhost:3000/` so the admin app talks to the local Next.js API while `apps/web` is running.

The matching Web/API deployment must include the App SDK origin in `B2C_ADMIN_ALLOWED_ORIGINS`; otherwise browser CORS will fail before the app can read the API error envelope.

## Local Development

```bash
bun run dev
```

The Sanity CLI starts the local App SDK server on `http://localhost:3334`.

For the full local B2C development loop, run the web app and main Studio from the repo root:

```bash
bun dev
```

Then run this admin app when needed:

```bash
bun run dev:b2c-admin
```

The local web environment should allow the admin origin:

```env
B2C_ADMIN_ALLOWED_ORIGINS=http://localhost:3334,https://www.sanity.io
```

## Deploy

```bash
bun run deploy
```

Deploying App SDK apps requires an organization admin/developer session, or an organization-level robot token with the `Manage SDK Apps` permission exposed as `SANITY_AUTH_TOKEN`.
