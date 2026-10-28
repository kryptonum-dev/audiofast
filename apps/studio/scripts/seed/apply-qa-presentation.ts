/**
 * Applies the Presentation audit fixture `apps/studio/seeds/qa-presentation.json`
 * (`qa-presentation`, decision P9) to the production dataset.
 *
 * The fixture id has no dot on purpose: ids containing `.` are not publicly
 * readable, and the web's published reads use the unauthenticated API CDN, so a
 * dotted id renders as a 404 on audiofast.pl.
 *
 * Usage (from apps/studio):
 *   bun run scripts/seed/apply-qa-presentation.ts             # dry run (default)
 *   bun run scripts/seed/apply-qa-presentation.ts --execute   # write
 *
 * The dry run prints a per-document field diff and asks the Content Lake to
 * validate the transaction (`commit({ dryRun: true })`) without writing. A
 * rerun after `--execute` must report "0 new, 0 changed" (idempotency).
 *
 * Only `createOrReplace` of the published fixture ids in the seed file. The
 * script never touches `drafts.*` and never deletes: audit drafts are cleaned up
 * by the walkthrough run contract (`context/changes/sanity-modernization/audit/
 * walkthrough/loop.md`), not here. Never run it during a walkthrough run — a
 * seed write races the editor's draft patches.
 *
 * Token: `SANITY_AUTH_TOKEN` from the environment, else from
 * `apps/web/.env.local`. The value is never printed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient, type SanityDocument } from '@sanity/client';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(HERE, '../../seeds/qa-presentation.json');
const WEB_ENV_PATH = resolve(HERE, '../../../web/.env.local');

type SeedDocument = SanityDocument & { _id: string; _type: string };

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const entries: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) entries[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return entries;
}

const SYSTEM_FIELDS = new Set(['_createdAt', '_updatedAt', '_rev', '_system']);

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : inner,
  );
}

function diffFields(
  current: Record<string, unknown> | null,
  next: Record<string, unknown>,
): string[] {
  if (!current) return Object.keys(next).filter((k) => !SYSTEM_FIELDS.has(k));
  const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
  return [...keys]
    .filter((key) => !SYSTEM_FIELDS.has(key))
    .filter((key) => stable(current[key]) !== stable(next[key]))
    .sort();
}

/** Every `_key` inside one array must be unique (Presentation drag + React keys). */
export function findDuplicateKeys(value: unknown, path = ''): string[] {
  const problems: string[] = [];
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    value.forEach((item, index) => {
      const key = (item as { _key?: unknown } | null)?._key;
      if (typeof key === 'string') {
        if (seen.has(key))
          problems.push(`${path}[${index}] duplicate _key ${key}`);
        seen.add(key);
      }
      problems.push(...findDuplicateKeys(item, `${path}[${index}]`));
    });
  } else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      problems.push(...findDuplicateKeys(inner, `${path}.${key}`));
    }
  }
  return problems;
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const webEnv = readEnvFile(WEB_ENV_PATH);
  const token = process.env.SANITY_AUTH_TOKEN ?? webEnv.SANITY_AUTH_TOKEN;
  const projectId =
    process.env.SANITY_STUDIO_PROJECT_ID ??
    webEnv.NEXT_PUBLIC_SANITY_PROJECT_ID ??
    'fsw3likv';
  const dataset =
    process.env.SANITY_STUDIO_DATASET ??
    webEnv.NEXT_PUBLIC_SANITY_DATASET ??
    'production';
  if (!token) {
    console.error('Missing SANITY_AUTH_TOKEN (env or apps/web/.env.local).');
    process.exit(2);
  }

  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as {
    documents: SeedDocument[];
  };
  for (const doc of seed.documents) {
    if (doc._id.startsWith('drafts.')) {
      throw new Error(`Seed must not contain drafts: ${doc._id}`);
    }
    const duplicates = findDuplicateKeys(doc);
    if (duplicates.length > 0) {
      throw new Error(`${doc._id}: ${duplicates.join('; ')}`);
    }
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2025-10-01',
    token,
    useCdn: false,
    perspective: 'raw',
  });

  const ids = seed.documents.map((doc) => doc._id);
  const existing = await client.fetch<Record<string, unknown>[]>(
    '*[_id in $ids]',
    { ids },
  );
  const byId = new Map(existing.map((doc) => [doc._id as string, doc]));

  let created = 0;
  let changed = 0;
  const transaction = client.transaction();
  for (const doc of seed.documents) {
    const current = byId.get(doc._id) ?? null;
    const fields = diffFields(current, doc);
    if (!current) created += 1;
    else if (fields.length > 0) changed += 1;
    else {
      console.log(`= ${doc._id}: unchanged`);
      continue;
    }
    console.log(
      `${current ? '~' : '+'} ${doc._id} (${doc._type}): ${fields.join(', ')}`,
    );
    transaction.createOrReplace(doc);
  }

  console.log(`${created} new, ${changed} changed (${projectId}/${dataset})`);
  if (created + changed === 0) return;

  if (!execute) {
    await transaction.commit({ dryRun: true });
    console.log(
      'Dry run: the Content Lake accepted the transaction. Re-run with --execute to write.',
    );
    return;
  }

  const result = await transaction.commit({ visibility: 'sync' });
  console.log(`Committed transaction ${result.transactionId}`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
