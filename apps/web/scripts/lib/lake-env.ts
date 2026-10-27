/**
 * Env lookup for the Presentation gate scripts (`check-stega-leaks.ts`,
 * `scan-dataset-stega.ts`), independent of Next's env loading: `bun run` from
 * the repo root does not read `apps/web/.env.local`. Ported from lsse-www
 * `scripts/lib/lake-cli.ts`. Token values are returned, never printed.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const WEB_DIR = fileURLToPath(new URL('../../', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** Searched in precedence order after `process.env`. */
export const ENV_FILES = [
  `${WEB_DIR}.env.local`,
  `${WEB_DIR}.env`,
  `${REPO_ROOT}apps/studio/.env.local`,
  `${REPO_ROOT}apps/studio/.env`,
];

/** Minimal dotenv line: `KEY=value`, optional `export`, optional quotes. */
const ENV_LINE = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/;

export async function envLookup(key: string): Promise<string | undefined> {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;

  for (const file of ENV_FILES) {
    let contents: string;
    try {
      contents = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of contents.split('\n')) {
      const parsed = line.match(ENV_LINE);
      const value = parsed?.[2]?.trim().replace(/^["']|["']$/g, '');
      if (parsed?.[1] === key && value) return value;
    }
  }
  return undefined;
}

export type LakeEnv = {
  projectId: string;
  dataset: string;
  apiVersion: string;
  studioUrl: string;
};

export async function lakeEnv(): Promise<LakeEnv> {
  const projectId =
    (await envLookup('NEXT_PUBLIC_SANITY_PROJECT_ID')) ??
    (await envLookup('SANITY_STUDIO_PROJECT_ID'));
  if (!projectId) {
    console.error(
      'NEXT_PUBLIC_SANITY_PROJECT_ID not found in the environment or in ' +
        ENV_FILES.map((file) => file.replace(REPO_ROOT, '')).join(', '),
    );
    process.exit(2);
  }
  return {
    projectId,
    dataset: (await envLookup('NEXT_PUBLIC_SANITY_DATASET')) ?? 'production',
    apiVersion:
      (await envLookup('NEXT_PUBLIC_SANITY_API_VERSION')) ?? '2025-02-10',
    studioUrl:
      (await envLookup('NEXT_PUBLIC_SANITY_STUDIO_URL')) ??
      'https://audiofast.sanity.studio',
  };
}

/**
 * The first token found among `names`, with the name it came from, or `null`.
 * Read tokens first: the Viewer token reads drafts and the share-access
 * secret, and nothing in these gates writes.
 */
export async function findToken(
  names: readonly string[],
): Promise<{ name: string; token: string } | null> {
  for (const name of names) {
    const token = await envLookup(name);
    if (token) return { name, token };
  }
  return null;
}
