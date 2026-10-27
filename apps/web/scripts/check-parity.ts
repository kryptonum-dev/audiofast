/**
 * Published-HTML parity crawler (sanity-modernization P7).
 *
 * Walks every URL in `<base>/sitemap.xml` plus fixed probes (listing
 * pagination, filter combinations, `/porownaj`, archives, 404s), records per
 * URL the status, `<title>`, meta description, canonical, robots, normalised
 * JSON-LD and the stega-stripped visible text as a bag of words, and optionally
 * diffs the crawl against a baseline snapshot.
 *
 *   bun run check:parity --base http://localhost:3107 --out parity/baseline
 *   bun run check:parity --compare parity/baseline
 *
 * Crawl an isolated production build (`next start -p 3107`), never a shared
 * dev server. See context/changes/sanity-modernization/parity/README.md.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildProbes,
  buildRecord,
  compareCrawls,
  fetchPage,
  originPattern,
  type PageRecord,
  parseSitemap,
  pool,
  snapshotFileName,
  toPath,
  uniqueSorted,
} from './lib/crawl';
import {
  formatRecord,
  type ParityOptions,
  parseArgs,
  renderReport,
  resolveDir,
  timestampDirName,
  USAGE,
  UsageError,
} from './lib/parity';

const USER_AGENT = 'audiofast-check-parity/1';
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHANGE_DIR = join(REPO_ROOT, 'context/changes/sanity-modernization');

type SummaryEntry = {
  path: string;
  source: 'sitemap' | 'probe';
  status: PageRecord['status'];
  file: string;
};

type Summary = {
  schemaVersion: 1;
  base: string;
  generatedAt: string;
  gitSha: string | null;
  label: string | null;
  sitemapUrlCount: number;
  probeCount: number;
  urlCount: number;
  limited: boolean;
  statusCounts: Record<string, number>;
  pages: SummaryEntry[];
};

function fail(message: string, code: 1 | 2): never {
  console.error(`[parity] ${message}`);
  process.exit(code);
}

function gitSha(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

async function readSitemapPaths(base: string): Promise<string[]> {
  const queue = [`${base}/sitemap.xml`];
  const seen = new Set<string>();
  const paths: string[] = [];
  while (queue.length) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const response = await fetchPage(url, {
      userAgent: USER_AGENT,
      attempts: 2,
    });
    if (response.status !== 200)
      fail(
        `sitemap ${url} answered ${response.status}${response.error ? ` (${response.error})` : ''}`,
        2,
      );
    const sitemap = parseSitemap(response.html);
    for (const child of sitemap.sitemaps) queue.push(`${base}${toPath(child)}`);
    for (const entry of sitemap.urls) paths.push(toPath(entry));
  }
  if (!paths.length) fail(`sitemap at ${base} lists no URLs`, 2);
  return uniqueSorted(paths);
}

async function loadSnapshot(
  dir: string,
): Promise<{ summary: Summary; pages: Map<string, PageRecord> }> {
  let summary: Summary;
  try {
    summary = JSON.parse(
      await readFile(join(dir, 'summary.json'), 'utf8'),
    ) as Summary;
  } catch (error) {
    fail(`cannot read ${join(dir, 'summary.json')}: ${String(error)}`, 2);
  }
  const pages = new Map<string, PageRecord>();
  for (const entry of summary.pages) {
    const record = JSON.parse(
      await readFile(join(dir, 'pages', entry.file), 'utf8'),
    ) as PageRecord;
    pages.set(entry.path, record);
  }
  return { summary, pages };
}

async function main(options: ParityOptions): Promise<void> {
  const cwd = process.cwd();
  const outDir = resolveDir(
    options.out ?? `parity/runs/${timestampDirName(new Date())}`,
    cwd,
    CHANGE_DIR,
  );
  const baselineDir = options.compare
    ? resolveDir(options.compare, cwd, CHANGE_DIR)
    : null;
  if (baselineDir && baselineDir === outDir)
    fail('--out must differ from --compare', 2);
  const baseline = baselineDir ? await loadSnapshot(baselineDir) : null;

  const sitemapPaths = await readSitemapPaths(options.base);
  const sitemapSet = new Set(sitemapPaths);
  const probes = uniqueSorted([
    ...(options.noProbes ? [] : buildProbes(sitemapPaths)),
    ...options.probes,
  ]).filter((path) => !sitemapSet.has(path));

  let targets: { path: string; source: SummaryEntry['source'] }[] = [
    ...sitemapPaths.map((path) => ({ path, source: 'sitemap' as const })),
    ...probes.map((path) => ({ path, source: 'probe' as const })),
  ];
  if (options.limit) targets = targets.slice(0, options.limit);

  console.log(
    `[parity] ${options.base}: ${sitemapPaths.length} sitemap URLs + ${probes.length} probes` +
      `${options.limit ? ` (limited to ${targets.length})` : ''}, concurrency ${options.concurrency}`,
  );

  await rm(join(outDir, 'pages'), { recursive: true, force: true });
  await mkdir(join(outDir, 'pages'), { recursive: true });

  const pattern = originPattern([options.base]);
  const started = performance.now();
  let done = 0;
  const entries = await pool(
    targets,
    options.concurrency,
    async ({ path, source }) => {
      const fetched = await fetchPage(`${options.base}${path}`, {
        userAgent: USER_AGENT,
      });
      const record = buildRecord(
        {
          path,
          status: fetched.status,
          location: fetched.location,
          html: fetched.html,
          error: fetched.error,
        },
        pattern,
      );
      const file = snapshotFileName(path);
      await writeFile(join(outDir, 'pages', file), formatRecord(record));
      done += 1;
      if (done % 50 === 0 || done === targets.length)
        console.log(
          `[parity] ${done}/${targets.length} (${Math.round((performance.now() - started) / 1000)}s)`,
        );
      const entry: SummaryEntry = { path, source, status: record.status, file };
      return { entry, record };
    },
  );

  const statusCounts: Record<string, number> = {};
  for (const { entry } of entries)
    statusCounts[String(entry.status)] =
      (statusCounts[String(entry.status)] ?? 0) + 1;

  const summary: Summary = {
    schemaVersion: 1,
    base: options.base,
    generatedAt: new Date().toISOString(),
    gitSha: gitSha(),
    label: options.label,
    sitemapUrlCount: sitemapPaths.length,
    probeCount: probes.length,
    urlCount: entries.length,
    limited: Boolean(options.limit),
    statusCounts,
    pages: entries.map(({ entry }) => entry),
  };
  await writeFile(
    join(outDir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(
    `[parity] wrote ${entries.length} records to ${outDir} — statuses ${JSON.stringify(statusCounts)}`,
  );

  const unreachable = entries.filter(
    ({ entry }) => entry.status === 'unreachable',
  );
  if (unreachable.length)
    fail(
      `${unreachable.length} URL(s) unreachable, e.g. ${unreachable[0]!.entry.path} — is the server up?`,
      2,
    );

  if (!baseline) {
    const serverErrors = entries.filter(
      ({ entry }) => typeof entry.status === 'number' && entry.status >= 500,
    );
    const ssrErrors = entries.filter(({ record }) => record.ssrErrors.length);
    for (const { entry } of serverErrors)
      console.warn(`[parity] ${entry.status} ${entry.path}`);
    for (const { entry, record } of ssrErrors)
      console.warn(`[parity] ssr-error ${entry.path}: ${record.ssrErrors[0]}`);
    if (serverErrors.length) fail(`${serverErrors.length} server error(s)`, 1);
    return;
  }

  const current = new Map(
    entries.map(({ entry, record }) => [entry.path, record]),
  );
  let baselinePages = baseline.pages;
  if (options.limit) {
    baselinePages = new Map(
      [...baseline.pages].filter(([path]) => current.has(path)),
    );
  }
  const diffs = compareCrawls(baselinePages, current);
  await writeFile(
    join(outDir, 'diff.json'),
    `${JSON.stringify(diffs, null, 2)}\n`,
  );
  const report = renderReport({
    baselineDir: baselineDir!,
    base: options.base,
    baselineCount: baselinePages.size,
    currentCount: current.size,
    diffs,
  });
  await writeFile(join(outDir, 'report.md'), report);

  if (!diffs.length) {
    console.log(
      `[parity] no differences vs ${baselineDir} (${current.size} URLs)`,
    );
    return;
  }
  console.log(report.split('\n## Paths')[0]);
  fail(
    `${diffs.length} path(s) differ from the baseline — see ${join(outDir, 'report.md')}`,
    1,
  );
}

let options: ParityOptions;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    if (error.message) console.error(`[parity] ${error.message}\n`);
    console.error(USAGE);
    process.exit(error.message ? 2 : 0);
  }
  throw error;
}

main(options).catch((error: unknown) => {
  console.error('[parity] crashed:', error);
  process.exit(2);
});
