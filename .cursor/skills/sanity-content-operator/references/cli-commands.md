# CLI Commands

Use `npx sanity@latest` when a project does not have a local CLI binary. Use package scripts or the repo's existing package manager when the project already defines a Sanity workflow.

## Project Configuration

Sanity CLI reads project config from `sanity.cli.ts` / `sanity.cli.js` in the current folder and can fall back to `sanity.config.ts`.

Minimal `sanity.cli.ts`:

```ts
import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET,
  },
})
```

Some projects hard-code `projectId` and `dataset` in config. Tokens should still remain outside committed files.

## Useful Commands

Read a document by ID:

```bash
npx sanity@latest documents get documentId --project-id "$SANITY_PROJECT_ID" --dataset "$SANITY_DATASET"
```

Run a GROQ query:

```bash
npx sanity@latest documents query '*[_type == "post"][0..4]{_id,title}' --project-id "$SANITY_PROJECT_ID" --dataset "$SANITY_DATASET"
```

Create document(s) from JSON:

```bash
npx sanity@latest documents create ./document.json --project-id "$SANITY_PROJECT_ID" --dataset "$SANITY_DATASET"
```

Delete by explicit ID:

```bash
npx sanity@latest documents delete documentId --project-id "$SANITY_PROJECT_ID" --dataset "$SANITY_DATASET"
```

Validate documents against Studio schema:

```bash
npx sanity@latest documents validate --project-id "$SANITY_PROJECT_ID" --dataset "$SANITY_DATASET"
```

Run a Studio-context script:

```bash
npx sanity@latest exec ./migrations/script.ts --with-user-token
```

## Notes

- CLI flags can override config, which is useful in monorepos.
- `sanity documents query` supports `--api-version`; the env name for the CLI query version is `SANITY_CLI_QUERY_API_VERSION`.
- CLI document commands are real operations. They are not dry-run unless the command or script explicitly avoids submitting a mutation.
