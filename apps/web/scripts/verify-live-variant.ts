/**
 * Asserts that the built server output uses the one-request `next-js` build of
 * `next-sanity/live` (decision D10, sanity-modernization Phase 3).
 *
 * `next-sanity/live` ships three export conditions. Under `cacheComponents`
 * Next adds the `next-js` condition, whose `sanityFetch` makes ONE request and
 * registers `cacheTag`/`cacheLife` itself. Without it the `react-server` build
 * is selected, which makes TWO requests per fetch: a sync-tag lookup tagged
 * `fetch-sync-tags`, then the data fetch. Webpack's rule is readable in JS;
 * Turbopack's is native code, so the only proof is the built output.
 *
 *   bun apps/web/scripts/verify-live-variant.ts [--dir <.next/server>]
 *
 * Exit 0: no `fetch-sync-tags` marker and the `next-js` build's default request
 * tag (`next-loader.fetch.cache-components`) is present.
 * Exit 1: the marker is present (two-request build selected), or the `next-js`
 * build is missing (the check would otherwise pass vacuously).
 * Exit 2: no server output to inspect (run it after `next build`).
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const TWO_REQUEST_MARKER = 'fetch-sync-tags';
const ONE_REQUEST_MARKER = 'next-loader.fetch.cache-components';
const SCANNED_EXTENSIONS = ['.js', '.mjs', '.cjs'];

function parseDir(argv: string[]): string {
  const index = argv.indexOf('--dir');
  if (index !== -1) {
    const value = argv[index + 1];
    if (!value) {
      console.error('[live-variant] --dir needs a path');
      process.exit(2);
    }
    return value;
  }
  return fileURLToPath(new URL('../.next/server', import.meta.url));
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      yield path;
    }
  }
}

async function main() {
  const serverDir = parseDir(process.argv.slice(2));
  if (!existsSync(serverDir)) {
    console.error(
      `[live-variant] ${serverDir} does not exist; run \`next build\` first.`,
    );
    process.exit(2);
  }

  const twoRequestFiles: string[] = [];
  let oneRequestFiles = 0;
  let scanned = 0;

  for await (const file of walk(serverDir)) {
    scanned += 1;
    const content = await readFile(file, 'utf8');
    if (content.includes(TWO_REQUEST_MARKER)) {
      twoRequestFiles.push(relative(serverDir, file));
    }
    if (content.includes(ONE_REQUEST_MARKER)) {
      oneRequestFiles += 1;
    }
  }

  if (twoRequestFiles.length > 0) {
    console.error(
      `[live-variant] FAIL: the two-request react-server build of next-sanity/live is in the server output (${TWO_REQUEST_MARKER}):`,
    );
    for (const file of twoRequestFiles) console.error(`  ${file}`);
    process.exit(1);
  }

  if (oneRequestFiles === 0) {
    console.error(
      `[live-variant] FAIL: no file contains ${ONE_REQUEST_MARKER}; the next-js build of next-sanity/live is not in the server output (${scanned} files scanned).`,
    );
    process.exit(1);
  }

  console.log(
    `[live-variant] OK: one-request next-js build selected (${oneRequestFiles} file(s) with ${ONE_REQUEST_MARKER}, 0 with ${TWO_REQUEST_MARKER}, ${scanned} files scanned).`,
  );
}

await main();
