# Safety Rules

Sanity Content Lake writes can affect production content. The skill may perform automatic writes when the task clearly asks for them, but it should keep mutation behavior visible and reversible where possible.

## Dry Run Meaning

A dry run means the agent does not submit a mutation. It should:

- Query current target documents.
- Print intended mutations.
- Show counts and representative IDs for bulk operations.
- Show a field-level preview for document patches.

Sanity document commands are not dry-run by default. Do not call a write operation and assume it is dry because the conversation says "dry run."

## Destructive Operations

Preview first unless the user explicitly says to skip:

- `delete`
- `createOrReplace`
- query-based patch/delete
- dataset import/export overwrite workflows
- broad migrations touching many documents

For query-based destructive operations, first run the selector query and report the number of matches and sample IDs.

## Bulk Operations

For bulk changes:

- Add limits during exploration.
- Discover the actual target `_type` and field shape before writing mutation logic.
- Save the mutation payload to a local file before execution.
- Prefer transactions for logically related changes.
- Consider chunking very large operations.
- Re-query after execution and verify counts or sample documents.

## Secrets

- Never print `SANITY_AUTH_TOKEN`.
- Redact bearer tokens from errors, command output, and logs.
- Do not add `.env.local` or token files to git.
- Warn if a requested edit would put a write token in browser-exposed code such as `NEXT_PUBLIC_*`.

## Optimistic Locking

Use `_rev` / `ifRevisionID` when a patch is based on a specific prior document state and another editor could have changed the document meanwhile.
