# Sanity 403 Mutation Diagnosis

## Likely Cause

Reads work because the local web environment has the public Sanity project/dataset settings and a read token configured:

- `NEXT_PUBLIC_SANITY_PROJECT_ID`: present
- `NEXT_PUBLIC_SANITY_DATASET`: present
- `NEXT_PUBLIC_SANITY_API_READ_TOKEN`: tokenPresent: true

Mutations are failing because the local environment does not expose the write-token variable expected by mutation scripts:

- `SANITY_API_TOKEN`: tokenPresent: false
- `SANITY_PROJECT_ID`: present: false
- `SANITY_DATASET`: present: false
- `apps/studio/.env.local`: present: false
- root `.env.local`: present: false

The repo's read client uses `NEXT_PUBLIC_SANITY_API_READ_TOKEN`, but migration/write clients expect `SANITY_API_TOKEN`. A read token can successfully fetch content but will be rejected with 403 for create/patch/delete operations. There is also a risky naming issue in `apps/web/src/app/api/revalidate/route.ts`: it uses `NEXT_REVALIDATE_TOKEN` as a Sanity client token for denormalization. That variable is also used as the webhook bearer secret, so it should not be assumed to be a Sanity write token.

## Safest Fix

Create a dedicated server-only Sanity API token with the minimum role needed for the intended mutation scope, then configure it only under a non-public env name such as `SANITY_API_TOKEN` or `SANITY_WRITE_TOKEN`. Do not reuse `NEXT_PUBLIC_SANITY_API_READ_TOKEN`, and do not put any write token in a `NEXT_PUBLIC_*` variable.

For local Cursor/script runs, add the write token to the environment that actually runs the mutation command, for example `apps/studio/.env.local` or an exported shell variable, alongside the matching project/dataset values if the script needs them. Keep `NEXT_REVALIDATE_TOKEN` only for webhook/API authentication, or rename the Sanity write credential in `route.ts` to a separate server-only variable.

Before any live mutation, verify with a non-mutating/auth-only check that the token is present and scoped to the correct project/dataset, then run the mutation in dry-run/preview mode if available.
