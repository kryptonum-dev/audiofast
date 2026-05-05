# Auth And Environment

Sanity project access is project-specific. Keep the skill generic and read credentials from the active repo or shell.

## Preferred Env Contract

```bash
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_API_VERSION=2025-02-06
SANITY_AUTH_TOKEN=your-token
```

Use `.env.local` for real local credentials and `.env.example` for committed documentation. Do not commit real tokens.

## Discovery Order

1. Use explicit flags or env files provided by the user.
2. Inspect shell environment.
3. Inspect local env files in the current working directory and ancestor directories.
4. Search downward from the nearest project/workspace root for the best matching app env directory, such as `apps/web/.env.local`, `web/.env.local`, `studio/.env`, or another nested project layout.
5. Prefer env directories that contain actual Sanity keys and match the current working context.
6. Inspect `sanity.cli.ts`, `sanity.cli.js`, `sanity.config.ts`, or `sanity.config.js` for non-secret project/dataset clues.
7. Ask the user only when project/dataset/token cannot be inferred safely.

The bundled helper scripts implement steps 1-5. If a monorepo has multiple Sanity apps, pass the intended env file explicitly:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-env-check.mjs --env-file apps/web/.env.local
```

Shell environment values override values loaded from env files, and command flags override both. This lets CI or a user-provided shell session choose the target project without editing files.

The preferred variable names are `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`, and `SANITY_AUTH_TOKEN`, but the helpers also understand common project conventions such as `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION`, `SANITY_API_TOKEN`, `SANITY_API_WRITE_TOKEN`, and `SANITY_API_READ_TOKEN`. Treat aliases as compatibility support; when adding new projects, prefer the standard names above.

When reporting env discovery, include the selected env file and source variable names. Do not include token values, partial token prefixes, or copied `.env` lines. If multiple candidate apps exist, explain the selection reason, for example "current files are under apps/web" or "this env file was the only one containing Sanity keys."

## Token Roles

- Public datasets may allow anonymous reads, but authenticated reads are more consistent for private content and drafts.
- Viewer tokens are suitable for private reads.
- Editor, Developer, or Administrator tokens are needed for mutations depending on the document type and project permissions.
- Use the lowest role that can complete the task.
- Keep write tokens server-side only. Never expose them in frontend code or committed config.

## CLI Auth

Interactive local auth:

```bash
npx sanity@latest login
```

Unattended auth:

```bash
SANITY_AUTH_TOKEN=... npx sanity@latest documents query '*[_type == "post"][0]'
```

Create a token when already authenticated with sufficient permissions:

```bash
npx sanity@latest tokens add "Cursor Agent Token" --role=editor --json
```

`sanity exec` has a special auth path. To pass the logged-in user token into `getCliClient()`, use:

```bash
npx sanity@latest exec migrations/script.ts --with-user-token
```

For non-interactive `sanity exec` scripts, explicitly configure the client with `process.env.SANITY_AUTH_TOKEN` when possible.
