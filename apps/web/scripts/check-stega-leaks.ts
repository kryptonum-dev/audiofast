/**
 * The Presentation stega gate (Tier 0, gate 0.1): "no marker where a machine
 * reads it", as a command. Ported from lsse-www (research/11 §5).
 *
 * Draft-mode stega appends invisible marker runs to every CMS string so the
 * Presentation overlay can trace text back to its field. That is correct in
 * visible text and wrong everywhere else (an `href`, an `alt`, a `class`, a
 * `data-*`, a JSON-LD string, a `<title>`, an inline `<script>`, an
 * `<input value>`), and wrong ONLY in draft mode, so no normal build sees it.
 * This walks every sitemap URL plus fixed probes and reports, by location:
 *
 *   - published mode: any marker anywhere is a finding, and so is a single
 *     `data-sanity` attribute (visual-editing bytes never leave draft mode);
 *   - draft mode: markers in visible text are expected and counted; markers
 *     in `<title>`, `<meta content>`, `<link href>`, JSON-LD strings, any
 *     attribute except `data-sanity*`, inline `<script>`/`<style>`/
 *     `<noscript>`, `<textarea>` and inline `<svg>` are findings;
 *   - both: the stega-stripped visible text (a bag of words) must be identical
 *     across the modes; a subtree that renders published under draft shows up
 *     as a `divergence`. While the dataset holds pending content drafts this
 *     comparison is informational (an unpublished edit is a legitimate
 *     difference) and the report says so;
 *   - either: a Suspense boundary whose server render threw (`ssr-error`);
 *   - both: every never-published draft of a routed type (up to 2 per type)
 *     must render in draft mode and stay not-found when published (failure
 *     classes G and M; the source half is `presentation-gates/
 *     draft-not-found-status.test.ts`).
 *
 * The RSC flight payload (`self.__next_f.push(…)`) is exempt from the
 * inline-script class: it serialises the same tree the HTML carries.
 *
 * Draft cookies are obtained the way Presentation obtains them: the
 * share-access secret (`shareAccess: true`, read with the Viewer token),
 * otherwise a preview secret minted with `createPreviewSecret` (needs a
 * write token; a 60-minute `sanity.previewUrlSecret` system document, the
 * same write the Studio makes), then `GET /api/draft-mode/enable/` with
 * `redirect: 'manual'`, keeping every `Set-Cookie`. Cookies are minted per
 * run: `__prerender_bypass` changes with every build.
 *
 * Run it against production for the published gate and against an ISOLATED
 * local production build (`next start -p 3108`) for draft mode, never a
 * shared dev server:
 *
 *   bun run check:stega-leaks --base https://audiofast.pl --mode published
 *   bun run check:stega-leaks --base http://localhost:3108 --mode both
 *
 * Flags: --base <url> --out <report.md> --mode published|draft|both
 *        --concurrency <n> --probe <path…> --limit <n> (a smoke run, never a gate)
 *
 * Exit code: 0 clean; 1 on any finding; 2 on a bad argument, an unreachable
 * sitemap or a draft session that could not be opened.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

import { HREF_EXPRESSIONS, ROUTES } from '../../studio/presentation/routes';
import {
  fetchPage,
  parseSitemap,
  pool,
  toPath,
  uniqueSorted,
} from './lib/crawl';
import { findToken, type LakeEnv, lakeEnv } from './lib/lake-env';
import {
  analyse,
  buildStegaProbes,
  extractLocations,
  type Finding,
  isNotFound,
  MARKERS,
  type Mode,
  NEVER_EXISTING,
  normalizePath,
  type StegaPage,
  templateKey,
  textTokens,
  tokenDifference,
} from './lib/stega-crawl';

const USER_AGENT = 'audiofast-check-stega-leaks/1';
const READ_TOKENS = ['SANITY_API_READ_TOKEN', 'SANITY_AUTH_TOKEN'] as const;
const WRITE_TOKENS = ['SANITY_AUTH_TOKEN'] as const;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

type Options = {
  base: string;
  out: string | null;
  concurrency: number;
  probes: string[];
  limit: number | null;
  modes: Mode[];
};

const USAGE =
  'Usage: bun run check:stega-leaks [--base <url>] [--out <file.md>] [--mode published|draft|both] [--concurrency <n>] [--probe <path>…] [--limit <n>]';

function usageError(message: string): never {
  console.error(message);
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    base: 'http://localhost:3108',
    out: null,
    concurrency: 4,
    probes: [],
    limit: null,
    modes: ['published', 'draft'],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    }
    if (!arg.startsWith('--')) usageError(`Unexpected argument: ${arg}`);
    if (arg === '--probe') {
      let consumed = 0;
      while (index + 1 < argv.length && !argv[index + 1]!.startsWith('--')) {
        options.probes.push(normalizePath(argv[index + 1]!));
        index += 1;
        consumed += 1;
      }
      if (consumed === 0) usageError('--probe needs at least one path');
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--'))
      usageError(`${arg} needs a value`);
    index += 1;
    switch (arg) {
      case '--base':
        options.base = value.replace(/\/+$/, '');
        break;
      case '--out':
        options.out = value;
        break;
      case '--concurrency':
      case '--limit': {
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || n < 1)
          usageError(`${arg} needs a positive integer`);
        if (arg === '--limit') options.limit = n;
        else options.concurrency = n;
        break;
      }
      case '--mode':
        if (value === 'both') options.modes = ['published', 'draft'];
        else if (value === 'published' || value === 'draft')
          options.modes = [value];
        else usageError('--mode must be published, draft or both');
        break;
      default:
        usageError(`Unknown flag: ${arg}`);
    }
  }
  return options;
}

// ---------------------------------------------------------------------------
// The draft session
// ---------------------------------------------------------------------------

type PreviewSecretConstants = {
  fetchSharedAccessQuery: string;
  urlSearchParamPreviewSecret: string;
  urlSearchParamPreviewPerspective: string;
  urlSearchParamPreviewPathname: string;
};
type CreatePreviewSecret = (
  client: SanityClient,
  source: string,
  studioUrl: string,
) => Promise<{ secret: string; expiresAt: Date }>;

/**
 * `@sanity/preview-url-secret` through `next-sanity`'s own dependency tree:
 * the version the enable route validates against, with no second pin here.
 */
function previewSecretModule(subpath: string): Promise<unknown> {
  const fromWeb = createRequire(new URL('../package.json', import.meta.url));
  const nextSanity = createRequire(fromWeb.resolve('next-sanity/package.json'));
  // ESM-only package: resolve its directory, then import the dist file.
  const pkg = nextSanity.resolve('@sanity/preview-url-secret/package.json');
  return import(`${dirname(pkg)}/dist/${subpath}.js`);
}

function lakeClient(env: LakeEnv, token: string): SanityClient {
  return createClient({
    projectId: env.projectId,
    dataset: env.dataset,
    apiVersion: env.apiVersion,
    useCdn: false,
    token,
    perspective: 'raw',
  });
}

type DraftSession = { cookie: string; source: string };

async function openDraftSession(
  base: string,
  env: LakeEnv,
  reader: SanityClient,
): Promise<DraftSession> {
  const constants = (await previewSecretModule(
    'constants',
  )) as PreviewSecretConstants;

  let secret = await reader.fetch<string | null>(
    constants.fetchSharedAccessQuery,
  );
  let source = 'share-access secret';
  if (typeof secret !== 'string' || !secret) {
    const writer = await findToken(WRITE_TOKENS);
    if (!writer) {
      console.error(
        'Share access is off and no write token (SANITY_AUTH_TOKEN) is available to mint a preview secret.',
      );
      process.exit(2);
    }
    const { createPreviewSecret } = (await previewSecretModule(
      'create-secret',
    )) as { createPreviewSecret: CreatePreviewSecret };
    const minted = await createPreviewSecret(
      lakeClient(env, writer.token),
      'check-stega-leaks',
      env.studioUrl,
    );
    secret = minted.secret;
    source = `preview secret minted for this run (expires ${minted.expiresAt.toISOString()})`;
  }

  const url =
    `${base}/api/draft-mode/enable/?` +
    `${constants.urlSearchParamPreviewSecret}=${encodeURIComponent(secret)}` +
    `&${constants.urlSearchParamPreviewPerspective}=drafts` +
    `&${constants.urlSearchParamPreviewPathname}=${encodeURIComponent('/')}`;
  let response: Response | null = null;
  let lastError = '';
  for (let attempt = 1; attempt <= 3 && !response; attempt += 1) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 3_000));
    try {
      response = await fetch(url, {
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      lastError = String(error);
    }
  }
  if (!response) {
    console.error(`Cannot open the draft session: ${lastError}`);
    return process.exit(2);
  }
  const cookies = response.headers.getSetCookie();
  if (response.status < 300 || response.status > 399 || cookies.length === 0) {
    console.error(
      `${base}/api/draft-mode/enable/ answered ${response.status} with ${cookies.length} Set-Cookie header(s)`,
    );
    process.exit(2);
  }
  return {
    cookie: cookies.map((header) => header.split(';')[0]!).join('; '),
    source,
  };
}

const SYSTEM_TYPES =
  '["sanity.previewUrlSecret", "sanity.previewUrlShareAccess"]';

/** Pending content drafts: the legitimate reason two modes may differ. */
async function pendingDrafts(client: SanityClient): Promise<string[]> {
  return client.fetch<string[]>(
    `*[_id in path("drafts.**") && !(_type in ${SYSTEM_TYPES})]._id`,
  );
}

type DraftOnlyProbe = { path: string; id: string; type: string };

/**
 * Never-published drafts of slug-routed types, up to two per type, with the
 * URL the Studio's route table (`apps/studio/presentation/routes.ts`) gives
 * them. A draft whose href is `null` (no slug, or a route condition it fails)
 * is not routable and is skipped.
 */
async function draftOnlyProbes(
  client: SanityClient,
): Promise<DraftOnlyProbe[]> {
  const slugTypes = Object.entries(ROUTES)
    .filter(([, config]) => config.kind === 'slug')
    .map(([type]) => type);
  const href = `select(${slugTypes
    .map(
      (type) => `_type == ${JSON.stringify(type)} => ${HREF_EXPRESSIONS[type]}`,
    )
    .join(', ')})`;
  const rows = await client.fetch<
    { id: string; type: string; href: string | null }[]
  >(
    `*[_id in path("drafts.**") && _type in $types
      && !defined(*[_id == string::split(^._id, "drafts.")[1]][0]._id)
    ]{ "id": _id, "type": _type, "href": ${href} } | order(id asc)`,
    { types: slugTypes },
  );
  const perType = new Map<string, number>();
  const probes: DraftOnlyProbe[] = [];
  for (const row of rows) {
    if (!row.href || !row.href.startsWith('/')) continue;
    const count = perType.get(row.type) ?? 0;
    if (count >= 2) continue;
    perType.set(row.type, count + 1);
    probes.push({ path: normalizePath(row.href), id: row.id, type: row.type });
  }
  return probes;
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

type ModeResult = {
  status: number | 'unreachable';
  location: string | null;
  ms: number;
  page: StegaPage | null;
  notFound: boolean;
  findings: Finding[];
  textRuns: number;
  statusFinding: string | null;
};

type Result = {
  path: string;
  modes: Partial<Record<Mode, ModeResult>>;
  divergence: string | null;
  draftOnly: DraftOnlyProbe | null;
};

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
    if (response.status !== 200) {
      console.error(`${url} answered ${response.status}`);
      process.exit(2);
    }
    const sitemap = parseSitemap(response.html);
    for (const child of sitemap.sitemaps) queue.push(`${base}${toPath(child)}`);
    for (const entry of sitemap.urls) paths.push(toPath(entry));
  }
  if (!paths.length) {
    console.error(`${base}/sitemap.xml lists no URLs`);
    process.exit(2);
  }
  return uniqueSorted(paths);
}

function statusFindingFor(
  path: string,
  mode: Mode,
  result: ModeResult,
  draftOnly: DraftOnlyProbe | null,
): string | null {
  const { status } = result;
  if (status === 'unreachable' || (status >= 300 && status !== 404))
    return `status ${status}${result.location ? ` → ${result.location}` : ''}`;
  if (draftOnly) {
    if (mode === 'draft' && result.notFound)
      return `never-published ${draftOnly.type} ${draftOnly.id} is not found in draft mode`;
    if (mode === 'published' && !result.notFound)
      return `never-published ${draftOnly.type} ${draftOnly.id} renders on the published site`;
    return null;
  }
  if (path === NEVER_EXISTING) return null;
  if (result.notFound)
    return status === 404 ? 'status 404' : 'not-found render';
  return null;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { base } = options;
  const wantsDraft = options.modes.includes('draft');

  // -- Draft session + Lake state -----------------------------------------
  let session: DraftSession | null = null;
  let drafts: string[] = [];
  let draftOnly: DraftOnlyProbe[] = [];
  if (wantsDraft) {
    const env = await lakeEnv();
    const reader = await findToken(READ_TOKENS);
    if (!reader) {
      console.error(
        `Draft mode needs a read token: none of ${READ_TOKENS.join(', ')} is set.`,
      );
      process.exit(2);
    }
    const client = lakeClient(env, reader.token);
    session = await openDraftSession(base, env, client);
    drafts = await pendingDrafts(client);
    draftOnly = await draftOnlyProbes(client);
    console.log(
      `draft session: ${session.source} (read token: ${reader.name}); ${session.cookie.split('; ').length} cookie(s); pending content drafts: ${drafts.length}; never-published routed drafts probed: ${draftOnly.length}`,
    );
  }

  // -- Inputs ----------------------------------------------------------------
  const sitemapPaths = await readSitemapPaths(base);
  const walked =
    options.limit === null
      ? sitemapPaths
      : sitemapPaths.slice(0, options.limit);
  const fixedProbes = buildStegaProbes(sitemapPaths);
  const draftOnlyByPath = new Map(
    draftOnly.map((probe) => [probe.path, probe]),
  );
  const paths = uniqueSorted([
    ...walked,
    ...fixedProbes,
    ...options.probes,
    ...draftOnlyByPath.keys(),
  ]);
  console.log(
    `sitemap: ${sitemapPaths.length} URLs${options.limit !== null ? ` (walking ${walked.length})` : ''}; probes: ${fixedProbes.length + options.probes.length}; modes: ${options.modes.join('+')}; concurrency ${options.concurrency}`,
  );

  // -- Fetch + analyse -----------------------------------------------------
  const total = paths.length * options.modes.length;
  let done = 0;
  const results = await pool(paths, options.concurrency, async (path) => {
    const result: Result = {
      path,
      modes: {},
      divergence: null,
      draftOnly: draftOnlyByPath.get(path) ?? null,
    };
    for (const mode of options.modes) {
      const fetched = await fetchPage(`${base}${path}`, {
        userAgent: USER_AGENT,
        cookie: mode === 'draft' ? session!.cookie : null,
      });
      const modeResult: ModeResult = {
        status: fetched.status,
        location: fetched.location,
        ms: fetched.ms,
        page: null,
        notFound: isNotFound(fetched.status, fetched.html),
        findings: [],
        textRuns: 0,
        statusFinding: null,
      };
      done += 1;
      if (done % 50 === 0 || done === total)
        console.log(`${done}/${total} ${mode} ${fetched.status} ${path}`);
      if (fetched.status === 200 || fetched.status === 404) {
        modeResult.page = extractLocations(fetched.html);
        const { findings, textRuns } = analyse(modeResult.page, mode);
        modeResult.findings = findings;
        modeResult.textRuns = textRuns;
      }
      modeResult.statusFinding = statusFindingFor(
        path,
        mode,
        modeResult,
        result.draftOnly,
      );
      result.modes[mode] = modeResult;
    }
    const published = result.modes.published;
    const draft = result.modes.draft;
    if (
      published?.page &&
      draft?.page &&
      !published.notFound &&
      !draft.notFound &&
      !result.draftOnly
    )
      result.divergence = tokenDifference(
        textTokens(published.page),
        textTokens(draft.page),
      );
    return result;
  });

  // -- Report ----------------------------------------------------------------
  const report = render(results, {
    base,
    modes: options.modes,
    sitemapTotal: sitemapPaths.length,
    sitemapWalked: walked.length,
    probes: [...fixedProbes, ...options.probes],
    session,
    drafts,
    draftOnly,
    limited: options.limit !== null,
  });
  if (options.out) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, report.markdown);
    console.log(`report → ${options.out}`);
  }
  console.log('');
  console.log(report.summary);
  process.exit(report.failing === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

type ReportContext = {
  base: string;
  modes: Mode[];
  sitemapTotal: number;
  sitemapWalked: number;
  probes: string[];
  session: DraftSession | null;
  drafts: string[];
  draftOnly: DraftOnlyProbe[];
  limited: boolean;
};

const code = (value: string): string => `\`${value.replace(/`/g, "'")}\``;
const cell = (value: string): string =>
  value.replace(/\|/g, '¦').replace(/\n/g, ' ');
/** A string with its marker runs made visible, cut for a table cell. */
function shown(value: string, max = 90): string {
  const visible = value.replace(MARKERS, '⟨stega⟩');
  return cell(visible.length > max ? `${visible.slice(0, max)}…` : visible);
}

function render(
  results: Result[],
  ctx: ReportContext,
): { markdown: string; summary: string; failing: number } {
  const lines: string[] = [];
  const w = (line = ''): void => {
    lines.push(line);
  };
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const divergenceGates = ctx.drafts.length === 0;

  const modeFindings = (r: Result, mode: Mode): number =>
    (r.modes[mode]?.findings.length ?? 0) +
    (r.modes[mode]?.statusFinding ? 1 : 0);
  const gating = (r: Result): number =>
    ctx.modes.reduce((n, mode) => n + modeFindings(r, mode), 0) +
    (r.divergence && divergenceGates ? 1 : 0);
  const failing = results.filter((r) => gating(r) > 0);
  const diverging = results.filter((r) => r.divergence);

  w(`# Stega-leak check: ${ctx.base}, ${now}`);
  w();
  w(
    `Modes: ${ctx.modes.join(', ')}` +
      (ctx.session ? ` (draft session: ${ctx.session.source})` : '') +
      `. Sitemap: ${ctx.sitemapWalked} of ${ctx.sitemapTotal} URLs` +
      (ctx.limited ? ' (**limited run**, not a gate)' : '') +
      `. Probes: ${ctx.probes.map(code).join(', ')}.`,
  );
  w();
  if (ctx.modes.length === 2) {
    w(
      divergenceGates
        ? 'Pending content drafts: **none**, so the cross-mode text comparison GATES.'
        : `Pending content drafts: **${ctx.drafts.length}**, so the cross-mode text comparison is INFORMATIONAL for this run: an unpublished edit is a legitimate difference.`,
    );
    w();
    w(
      `Never-published routed drafts probed (draft → renders, published → not found): ${
        ctx.draftOnly.length
          ? ctx.draftOnly.map((p) => `${code(p.path)} (${p.type})`).join(', ')
          : 'none in the dataset'
      }.`,
    );
    w();
  }
  for (const mode of ctx.modes) {
    const counts = new Map<string, number>();
    for (const r of results) {
      const status = String(r.modes[mode]?.status);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    w(
      `${mode}: ${results.length} URLs, status ${[...counts.entries()]
        .sort()
        .map(([s, n]) => `${s}×${n}`)
        .join(', ')}.`,
    );
  }
  w();

  w('## 1. Template table');
  w();
  const header = ['Template (representative URL)'];
  for (const mode of ctx.modes)
    header.push(
      `${mode} HTTP`,
      mode === 'published' ? 'data-sanity' : 'text marker runs',
      `${mode} findings`,
    );
  if (ctx.modes.length === 2) header.push('divergence');
  w(`| ${header.join(' | ')} |`);
  w(`|${header.map(() => '---').join('|')}|`);
  const byTemplate = new Map<string, Result>();
  for (const r of results) {
    const key = templateKey(r.path);
    if (!byTemplate.has(key)) byTemplate.set(key, r);
  }
  for (const r of byTemplate.values()) {
    const cells = [code(r.path)];
    for (const mode of ctx.modes) {
      const m = r.modes[mode];
      cells.push(
        m ? String(m.status) : '–',
        m?.page
          ? String(mode === 'published' ? m.page.dataSanity : m.textRuns)
          : '–',
        m ? String(modeFindings(r, mode)) : '–',
      );
    }
    if (ctx.modes.length === 2) cells.push(r.divergence ? 'yes' : 'no');
    w(`| ${cells.join(' | ')} |`);
  }
  w();

  w('## 2. Findings by location class');
  w();
  const classes = new Map<string, { pages: Set<string>; example: string }>();
  for (const r of results)
    for (const mode of ctx.modes)
      for (const f of r.modes[mode]?.findings ?? []) {
        const key = `${mode} ${f.kind}`;
        const row = classes.get(key) ?? { pages: new Set(), example: '' };
        row.pages.add(r.path);
        if (!row.example)
          row.example = `${code(r.path)} ${cell(f.where)}: “${shown(f.text)}”`;
        classes.set(key, row);
      }
  if (classes.size === 0) w('**None.**');
  for (const [key, row] of [...classes.entries()].sort(
    (a, b) => b[1].pages.size - a[1].pages.size,
  ))
    w(`- ×${row.pages.size} pages ${code(key)}, e.g. ${row.example}`);
  w();

  w('## 3. Per page (every page with a finding; first 10 per mode)');
  w();
  w('| page | mode | findings |');
  w('|---|---|---|');
  for (const r of failing) {
    for (const mode of ctx.modes) {
      const m = r.modes[mode];
      if (!m) continue;
      const items: string[] = [];
      if (m.statusFinding) items.push(cell(m.statusFinding));
      for (const f of m.findings.slice(0, 10))
        items.push(`${code(f.kind)} ${cell(f.where)}: “${shown(f.text)}”`);
      if (m.findings.length > 10) items.push(`… +${m.findings.length - 10}`);
      if (items.length)
        w(`| ${code(r.path)} | ${mode} | ${items.join('<br>')} |`);
    }
    if (r.divergence && divergenceGates)
      w(
        `| ${code(r.path)} | both | ${code('divergence')} ${cell(r.divergence)} |`,
      );
  }
  if (failing.length === 0) w('| none | | |');
  w();

  if (ctx.modes.length === 2) {
    w(
      `## 4. Cross-mode text divergence (${divergenceGates ? 'gating' : 'informational: pending drafts'})`,
    );
    w();
    if (diverging.length === 0)
      w(
        '**None**: every page reads the same in both modes once markers are stripped.',
      );
    for (const r of diverging) w(`- ${code(r.path)}: ${cell(r.divergence!)}`);
    w();
  }

  const summary = [
    `pages: ${results.length}`,
    ...ctx.modes.map(
      (mode) =>
        `${mode}: ${results.filter((r) => modeFindings(r, mode) > 0).length} page(s) with findings` +
        (mode === 'draft'
          ? `, ${results.reduce((n, r) => n + (r.modes.draft?.textRuns ?? 0), 0)} visible-text marker runs (expected)`
          : ''),
    ),
    ...(ctx.modes.length === 2
      ? [
          `divergence: ${diverging.length} page(s)${divergenceGates ? '' : ` (informational, ${ctx.drafts.length} pending draft(s))`}`,
          `never-published drafts probed: ${ctx.draftOnly.length}`,
        ]
      : []),
    `result: ${failing.length === 0 ? 'CLEAN (exit 0)' : `${failing.length} page(s) with findings (exit 1)`}`,
  ].join('\n');
  w('## 5. Result');
  w();
  w('```');
  w(summary);
  w('```');
  w();

  return { markdown: lines.join('\n'), summary, failing: failing.length };
}

main().catch((error: unknown) => {
  console.error('[stega-leaks] crashed:', error);
  process.exit(2);
});
