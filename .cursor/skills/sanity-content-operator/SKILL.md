---
name: sanity-content-operator
description: Operate Sanity Content Lake projects from Cursor using the Sanity CLI, GROQ queries, and authenticated Content Lake mutations. Use this skill whenever the user asks to connect to Sanity, inspect Sanity content, query GROQ, read documents, create or patch Sanity documents, migrate content, delete documents, manage Sanity CLI auth/tokens, or diagnose Sanity API/CLI access. This skill is project-agnostic: always discover project-specific Sanity env/config from the current repo instead of embedding credentials in the skill.
---

# Sanity Content Operator

Use this skill to safely read from and write to Sanity Content Lake projects. The skill is global, but every repo provides its own project ID, dataset, API version, and token. The value of the skill is not secret knowledge; it is a consistent operating standard that saves research time and reduces risky variation.

## Core Model

Treat Sanity access as two layers:

1. **Project configuration** comes from the active repo: `sanity.cli.ts`, `sanity.config.ts`, `.env.local`, `.env`, shell env, or a user-provided env file.
2. **Reusable operating behavior** comes from this skill: env discovery, query/mutation workflows, safety checks, and helper scripts.

Never store real Sanity credentials in this skill. Never ask the user to paste a token into chat if the current repo can provide it through env files or shell environment.

For standard Sanity operations covered by this skill, use the bundled references and helper scripts before doing fresh web research. Reach for external docs only when the user asks about a feature not covered here or when a command/API behavior is genuinely uncertain.

## First Step For Every Task

Identify the current project context before running Sanity commands:

1. Look for Sanity config files in the current working directory and nearby app folders.
2. Look for project env files, especially `.env.local`, `.env`, `.env.development`, or framework-specific env files.
3. Check for these variables:
   - `SANITY_PROJECT_ID`
   - `SANITY_DATASET`
   - `SANITY_API_VERSION`
   - `SANITY_AUTH_TOKEN`
4. If variable names differ, infer them carefully from local code and ask before changing project conventions.
5. Run `scripts/sanity-env-check.mjs` before any read/write operation when feasible. The helper searches shell env, ancestor env files, and the best matching descendant app/workspace env folder. Use `--env-file path/to/.env.local` when a repo has multiple Sanity apps and the target should be explicit.
6. Report the selected env source and why it was chosen, without printing secrets.

For repo-specific setup and token handling, read `references/auth-and-env.md`.

## Choosing The Right Tool

Use the Sanity CLI for quick, human-readable operations:

- `sanity documents query` for simple GROQ reads.
- `sanity documents get` for direct document lookup.
- `sanity documents create` for simple document creation from a JSON file.
- `sanity documents delete` for explicit ID deletes.
- `sanity exec` for Studio-context scripts.
- `sanity tokens add/list/delete` for token workflows when the user asks.

Use the bundled HTTP helper scripts for repeatable agent operations:

- `scripts/sanity-query.mjs` for GROQ queries.
- `scripts/sanity-mutate.mjs` for create, patch, delete, and transactional mutation payloads.
- `scripts/sanity-diff-preview.mjs` before patching a known document.

Prefer these helpers for agent-run operations and eval-like tasks because they encode the skill's env discovery, redaction, and dry-run behavior. Only hand-roll a new script when the task needs logic the helpers cannot express.

Use `@sanity/client` in project code when the repo already uses it or when you are implementing app/server code. For details, read:

- `references/cli-commands.md`
- `references/read-workflows.md`
- `references/mutation-workflows.md`

## Safety Rules

Writes may be automatic when the user has clearly requested a write, but keep the workflow observable:

- For reads, execute directly.
- For create or patch, prepare the smallest mutation that satisfies the request.
- For destructive operations (`delete`, broad query patches, `createOrReplace`, dataset imports), preview the affected documents first unless the user explicitly tells you to skip previews.
- For bulk operations, prefer a dry-run plan that lists counts, sample IDs, and mutation payload shape before execution.
- Remember: "dry run" is not automatic in Sanity. A dry run means your script queries and prints the intended change without submitting a mutation.
- Use optimistic locking with `_rev` / `ifRevisionID` when patching documents based on a previously fetched state and conflicts would matter.
- Do not assume document type names such as `post`, `page`, `product`, or `settings` from natural language alone. Discover the actual `_type` values from the dataset, schema files, or local query code before writing migrations or broad queries.

Read `references/safety-rules.md` before destructive or bulk mutations.

## Environment Contract

Prefer this per-project env contract:

```bash
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_API_VERSION=2025-02-06
SANITY_AUTH_TOKEN=your-token
```

`SANITY_AUTH_TOKEN` should be a server-side token only. Use a viewer token for private reads and an editor/developer/admin token only when mutations are needed. Never expose write tokens in frontend code or committed files.

## Standard Workflows

### Read Documents

1. Confirm env/config.
2. If the user's natural-language type is ambiguous, discover candidate `_type` values first.
3. Run a narrow GROQ query.
4. Prefer `useCdn: false` or the API endpoint for fresh data when writes or drafts are involved.
5. Summarize results without dumping sensitive content unless the user asks.

Example:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-query.mjs '*[_type == "post"][0..4]{_id,title}'
```

### Patch Documents

1. Fetch the current document.
2. Build a targeted patch payload using `set`, `setIfMissing`, `unset`, `inc`, `dec`, or `insert`.
3. Preview the diff or mutation body.
4. Execute with `--execute` only when the task calls for it.
5. Re-query the changed document and report the result.

Example dry-run:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-mutate.mjs --mutation-file ./mutation.json
```

Example execute:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-mutate.mjs --mutation-file ./mutation.json --execute
```

### Migrations And Bulk Changes

1. Discover the actual target `_type` before writing the migration.
2. Query a count and a small sample of matching documents.
3. Generate a dry-run-first script or mutation file.
4. Require an explicit execute flag for writes.
5. Save the mutation payload or sample output for review.

### Troubleshooting

For `401`, `403`, missing dataset, stale query results, CLI config problems, or `sanity exec` token issues, read `references/troubleshooting.md`.

## Evaluation Plan

This skill should be evaluated with realistic prompts before packaging. Use `evals/evals.json`, run with-skill and baseline agents, grade objective assertions, then generate the review UI with `skill-creator/eval-viewer/generate_review.py`.
