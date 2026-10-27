/**
 * Shared, Bun-free helpers for the published-HTML crawlers
 * (`scripts/check-parity.ts`, later `scripts/check-stega-leaks.ts`).
 *
 * Everything here is pure or uses only web-standard / `node:` APIs, so vitest
 * can import it and the crawlers can run under `bun` or `node` alike.
 */

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Stega + text normalisation
// ---------------------------------------------------------------------------

/**
 * The `@vercel/stega` marker alphabet (U+200B–U+200D, U+FEFF, U+2060–U+2063,
 * U+1D173–U+1D17A). Four or more in a row is a marker run; shorter runs are
 * left alone so ZWJ emoji sequences survive.
 */
// The class holds lone joiners on purpose: they are the marker alphabet.
/* eslint-disable no-misleading-character-class */
export const STEGA_CHARS =
  /[\u200B\u200C\u200D\uFEFF\u2060-\u2063\u{1D173}-\u{1D17A}]/u;
const STEGA_RUNS = new RegExp(`${STEGA_CHARS.source}{4,}`, 'gu');
/* eslint-enable no-misleading-character-class */

export function stripStega(value: string): string {
  return value.replace(STEGA_RUNS, '');
}

/**
 * Absolute URLs of the site itself, in any environment the crawl can run
 * against. They are rewritten to `{origin}` so a localhost build, a preview
 * deployment and production compare equal.
 */
const SITE_ORIGINS = [
  String.raw`https?://(?:www\.)?audiofast\.pl`,
  String.raw`https?://localhost(?::\d+)?`,
  String.raw`https?://127\.0\.0\.1(?::\d+)?`,
  String.raw`https://[a-z0-9-]+\.vercel\.app`,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function originPattern(extraOrigins: readonly string[] = []): RegExp {
  const extra = extraOrigins.map((origin) =>
    escapeRegExp(origin.replace(/\/+$/, '')),
  );
  return new RegExp(`(?:${[...extra, ...SITE_ORIGINS].join('|')})`, 'gi');
}

export function normalizeOrigins(value: string, pattern: RegExp): string {
  return value.replace(pattern, '{origin}');
}

/** HTML whitespace collapse. Never `\s`: it matches U+FEFF, a stega char. */
const HTML_SPACE = /[ \t\n\f\r]+/g;

export function collapseWhitespace(value: string): string {
  return value.replace(HTML_SPACE, ' ').replace(/^ | $/g, '');
}

/** One normalised string: stega stripped, NFC, origins rewritten, collapsed. */
export function normalizeString(value: string, pattern: RegExp): string {
  return collapseWhitespace(
    normalizeOrigins(stripStega(value).normalize('NFC'), pattern),
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
};

export function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
    (whole, body: string) => {
      if (body[0] === '#') {
        const code =
          body[1] === 'x' || body[1] === 'X'
            ? Number.parseInt(body.slice(2), 16)
            : Number.parseInt(body.slice(1), 10);
        if (Number.isNaN(code) || code > 0x10ffff) return whole;
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
    },
  );
}

// ---------------------------------------------------------------------------
// HTML extraction (a small tokenizer, enough for Next.js output)
// ---------------------------------------------------------------------------

export type ExtractedPage = {
  /**
   * Every document `<title>` (outside inline SVG), meta description, canonical
   * and meta robots, in document order. A streamed not-found page carries both
   * the route's and the 404's tags, in an order that varies run to run.
   */
  titles: string[];
  descriptions: string[];
  canonicals: string[];
  robots: string[];
  /** Raw `application/ld+json` script bodies, in document order. */
  jsonLd: string[];
  /** Visible text segments, in document order (entity-decoded, collapsed). */
  text: string[];
  /**
   * Server-render failures: `data-msg` of React's error templates and one
   * entry per streamed `$RX(…)` client-render fallback.
   */
  ssrErrors: string[];
  /** Number of `data-sanity*` attributes seen. */
  dataSanity: number;
};

/** Elements whose content is raw text and never visible copy. */
const RAW_TEXT = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'noscript',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
]);
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);
/**
 * Tags whose open/close does NOT break a visible-text segment. `<a>` is
 * deliberately absent: nav links sit side by side with no whitespace and
 * would otherwise glue into one "word".
 */
const INLINE = new Set([
  'span',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'sup',
  'sub',
  'abbr',
  'code',
  'small',
  'mark',
  'time',
  'q',
  'cite',
  'br',
  'wbr',
  'picture',
  'source',
  'img',
  'input',
]);

/** React's streamed "switch this boundary to client rendering" call. */
const CLIENT_RENDER_CALL = /\$RX\("[^"]*"(?:,"([^"]*)")?/g;

const START_TAG =
  /<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
const END_TAG = /<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>/y;
const ATTRIBUTE =
  /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1]!.toLowerCase();
    if (attributes.has(name)) continue;
    attributes.set(
      name,
      decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''),
    );
  }
  return attributes;
}

export function extractPage(html: string): ExtractedPage {
  const page: ExtractedPage = {
    titles: [],
    descriptions: [],
    canonicals: [],
    robots: [],
    jsonLd: [],
    text: [],
    ssrErrors: [],
    dataSanity: 0,
  };

  let buffer = '';
  const flush = (): void => {
    const text = collapseWhitespace(decodeEntities(buffer));
    if (text) page.text.push(text);
    buffer = '';
  };

  /** Depth of elements whose text is not visible copy (svg, template). */
  let hiddenDepth = 0;
  const hiddenStack: string[] = [];

  let index = 0;
  while (index < html.length) {
    const lt = html.indexOf('<', index);
    if (lt === -1) {
      if (!hiddenDepth) buffer += html.slice(index);
      break;
    }
    if (lt > index && !hiddenDepth) buffer += html.slice(index, lt);
    index = lt;

    if (html.startsWith('<!--', index)) {
      const close = html.indexOf('-->', index + 4);
      index = close === -1 ? html.length : close + 3;
      continue;
    }
    if (html.startsWith('<!', index) || html.startsWith('<?', index)) {
      const close = html.indexOf('>', index);
      index = close === -1 ? html.length : close + 1;
      continue;
    }

    END_TAG.lastIndex = index;
    const end = END_TAG.exec(html);
    if (end) {
      const tag = end[1]!.toLowerCase();
      if (!INLINE.has(tag)) flush();
      const open = hiddenStack.lastIndexOf(tag);
      if (open !== -1) {
        // Also drops unclosed children (tolerates sloppy markup).
        hiddenStack.length = open;
        hiddenDepth = hiddenStack.length;
      }
      index = END_TAG.lastIndex;
      continue;
    }

    START_TAG.lastIndex = index;
    const start = START_TAG.exec(html);
    if (!start) {
      // A stray `<` is text.
      if (!hiddenDepth) buffer += '<';
      index += 1;
      continue;
    }
    index = START_TAG.lastIndex;
    const tag = start[1]!.toLowerCase();
    const attributes = parseAttributes(start[2] ?? '');
    const selfClosing = start[3] === '/';

    for (const name of attributes.keys()) {
      if (name.startsWith('data-sanity')) page.dataSanity += 1;
    }

    if (!INLINE.has(tag)) flush();

    if (tag === 'meta') {
      const name = attributes.get('name')?.toLowerCase();
      const content = attributes.get('content') ?? '';
      if (name === 'description') page.descriptions.push(content);
      if (name === 'robots') page.robots.push(content);
      continue;
    }
    if (tag === 'link') {
      const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/);
      if (rel.includes('canonical'))
        page.canonicals.push(attributes.get('href') ?? '');
      continue;
    }
    if (tag === 'template') {
      const message = attributes.get('data-msg');
      if (
        message &&
        attributes.get('data-dgst') !== 'BAILOUT_TO_CLIENT_SIDE_RENDERING'
      )
        page.ssrErrors.push(collapseWhitespace(message));
    }

    // Inside SVG, `<title>`/`<style>` are ordinary elements in practice.
    const insideSvg = hiddenStack.includes('svg');
    if (RAW_TEXT.has(tag) && !selfClosing && !insideSvg) {
      const closeTag = new RegExp(`</${tag}\\s*>`, 'gi');
      closeTag.lastIndex = index;
      const close = closeTag.exec(html);
      const body = html.slice(index, close ? close.index : html.length);
      index = close ? closeTag.lastIndex : html.length;

      if (tag === 'title') {
        page.titles.push(collapseWhitespace(decodeEntities(body)));
      } else if (
        tag === 'script' &&
        (attributes.get('type') ?? '').trim() === 'application/ld+json'
      ) {
        page.jsonLd.push(body);
      } else if (tag === 'script' && !body.startsWith('self.__next_f.push(')) {
        // A boundary whose streamed server render threw is handed to the
        // client with `$RX("<boundary>","<digest>",…)`: the HTML then carries
        // only the Suspense fallback. The boundary id is left out so the
        // record stays stable when unrelated boundaries shift.
        for (const match of body.matchAll(CLIENT_RENDER_CALL))
          page.ssrErrors.push(`client-render digest="${match[1] ?? ''}"`);
      }
      continue;
    }

    if (VOID.has(tag) || selfClosing) continue;
    if (tag === 'svg' || tag === 'template' || hiddenDepth) {
      hiddenStack.push(tag);
      hiddenDepth = hiddenStack.length;
    }
  }
  flush();
  return page;
}

// ---------------------------------------------------------------------------
// Normalised page record
// ---------------------------------------------------------------------------

export type PageRecord = {
  path: string;
  status: number | 'unreachable';
  /** Redirect target (origin-normalised) for 3xx responses. */
  location: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  /** Parsed, key-sorted, origin-normalised JSON-LD blocks. */
  jsonLd: unknown[];
  /** Stega-stripped visible text as a bag of words (sorted keys). */
  words: Record<string, number>;
  wordCount: number;
  ssrErrors: string[];
  dataSanity: number;
  error?: string;
};

export function normalizeJsonValue(value: unknown, pattern: RegExp): unknown {
  if (typeof value === 'string') return normalizeString(value, pattern);
  if (Array.isArray(value))
    return value.map((item) => normalizeJsonValue(item, pattern));
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = normalizeJsonValue(
        (value as Record<string, unknown>)[key],
        pattern,
      );
    }
    return sorted;
  }
  return value;
}

export function normalizeJsonLd(blob: string, pattern: RegExp): unknown {
  try {
    return normalizeJsonValue(JSON.parse(blob), pattern);
  } catch (error) {
    return {
      __parseError: String(error).slice(0, 200),
      raw: normalizeString(blob, pattern).slice(0, 500),
    };
  }
}

/** Unicode whitespace (no U+FEFF: stega is stripped before splitting). */
const WORD_SPLIT =
  /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/u;

export function bagOfWords(
  segments: readonly string[],
  pattern: RegExp,
): Record<string, number> {
  const counts = new Map<string, number>();
  for (const segment of segments) {
    for (const word of normalizeString(segment, pattern).split(WORD_SPLIT)) {
      if (!word) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return sortRecord(Object.fromEntries(counts));
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};
  for (const key of Object.keys(record).sort()) sorted[key] = record[key]!;
  return sorted;
}

/**
 * One metadata field from every occurrence: normalised, de-duplicated, sorted
 * (order-independent) and joined with " || "; `null` when absent.
 */
export function joinDistinct(
  values: readonly string[],
  pattern: RegExp,
): string | null {
  if (!values.length) return null;
  return uniqueSorted(
    values.map((value) => normalizeString(value, pattern)),
  ).join(' || ');
}

export function buildRecord(
  input: {
    path: string;
    status: number | 'unreachable';
    location: string | null;
    html: string;
    error?: string;
  },
  pattern: RegExp,
): PageRecord {
  const page = extractPage(input.html);
  const norm = (value: string | null): string | null =>
    value === null ? null : normalizeString(value, pattern);
  const words = bagOfWords(page.text, pattern);
  return {
    path: input.path,
    status: input.status,
    location: norm(input.location),
    title: joinDistinct(page.titles, pattern),
    description: joinDistinct(page.descriptions, pattern),
    canonical: joinDistinct(page.canonicals, pattern),
    robots: joinDistinct(page.robots, pattern),
    jsonLd: page.jsonLd.map((blob) => normalizeJsonLd(blob, pattern)),
    words,
    wordCount: Object.values(words).reduce((sum, count) => sum + count, 0),
    ssrErrors: page.ssrErrors.map((message) => norm(message) ?? ''),
    dataSanity: page.dataSanity,
    ...(input.error ? { error: input.error } : {}),
  };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export type BagDiff = {
  added: Record<string, number>;
  removed: Record<string, number>;
};

export function bagDifference(
  before: Record<string, number>,
  after: Record<string, number>,
): BagDiff {
  const added: Record<string, number> = {};
  const removed: Record<string, number> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) {
    const delta = (after[key] ?? 0) - (before[key] ?? 0);
    if (delta > 0) added[key] = delta;
    if (delta < 0) removed[key] = -delta;
  }
  return { added, removed };
}

export const COMPARED_FIELDS = [
  'status',
  'location',
  'title',
  'description',
  'canonical',
  'robots',
  'jsonLd',
  'ssrErrors',
] as const;

export type FieldDiff =
  | {
      field: (typeof COMPARED_FIELDS)[number];
      baseline: unknown;
      current: unknown;
    }
  | { field: 'words'; diff: BagDiff };

export function comparePages(
  baseline: PageRecord,
  current: PageRecord,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const field of COMPARED_FIELDS) {
    if (JSON.stringify(baseline[field]) !== JSON.stringify(current[field]))
      diffs.push({ field, baseline: baseline[field], current: current[field] });
  }
  const words = bagDifference(baseline.words, current.words);
  if (Object.keys(words.added).length || Object.keys(words.removed).length)
    diffs.push({ field: 'words', diff: words });
  return diffs;
}

export type PathDiff =
  | { path: string; kind: 'missing' }
  | { path: string; kind: 'added' }
  | { path: string; kind: 'changed'; fields: FieldDiff[] };

/**
 * Compare two crawls keyed by path. `missing` = in the baseline but not in the
 * current crawl, `added` = new in the current crawl.
 */
export function compareCrawls(
  baseline: ReadonlyMap<string, PageRecord>,
  current: ReadonlyMap<string, PageRecord>,
): PathDiff[] {
  const diffs: PathDiff[] = [];
  const paths = new Set([...baseline.keys(), ...current.keys()]);
  for (const path of [...paths].sort()) {
    const before = baseline.get(path);
    const after = current.get(path);
    if (before && !after) diffs.push({ path, kind: 'missing' });
    else if (!before && after) diffs.push({ path, kind: 'added' });
    else if (before && after) {
      const fields = comparePages(before, after);
      if (fields.length) diffs.push({ path, kind: 'changed', fields });
    }
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// Sitemap, paths, probes
// ---------------------------------------------------------------------------

export type Sitemap = { urls: string[]; sitemaps: string[] };

export function parseSitemap(xml: string): Sitemap {
  const locs = (block: string): string[] =>
    Array.from(
      block.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/g),
      (match) => decodeEntities(match[1]!.trim()),
    );
  const sitemaps = Array.from(
    xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g),
    (match) => locs(match[1]!),
  ).flat();
  const urls = Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g), (match) =>
    locs(match[1]!),
  ).flat();
  return { urls, sitemaps };
}

/** Path + search of an absolute or relative URL, origin dropped. */
export function toPath(url: string): string {
  const parsed = new URL(url, 'http://parity.invalid');
  return `${parsed.pathname}${parsed.search}`;
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

/** First path of `paths` matching `/<prefix>/<one segment>/`, slug only. */
function firstSlugUnder(
  paths: readonly string[],
  prefix: string,
): string | null {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}([^/?]+)/$`);
  for (const path of [...paths].sort()) {
    const match = pattern.exec(path);
    if (match) return match[1]!;
  }
  return null;
}

/**
 * Fixed probes for request-time variants the sitemap never lists: listing
 * pagination, filter combinations, `/porownaj`, archives and 404s. Slugs for
 * category/brand probes are taken from the sitemap so the probes stay valid.
 */
export function buildProbes(sitemapPaths: readonly string[]): string[] {
  const probes = [
    '/produkty/?page=2',
    '/produkty/?sortBy=priceAsc',
    '/produkty/?sortBy=newest&page=2',
    '/produkty/?minPrice=5000&maxPrice=50000',
    '/produkty/?search=wzmacniacz',
    '/blog/?page=2',
    '/blog/?year=2024',
    '/certyfikowany-sprzet-uzywany/?page=2',
    '/certyfikowany-sprzet-uzywany/?sortBy=priceDesc',
    '/porownaj/',
    '/produkty/archiwalne/',
    '/recenzje/archiwalne/',
    '/this-page-does-not-exist/',
    '/produkty/parity-probe-missing-product/',
    '/blog/parity-probe-missing-article/',
    '/marki/parity-probe-missing-brand/',
  ];

  const brands = [...sitemapPaths]
    .sort()
    .map((path) => /^\/marki\/([^/?]+)\/$/.exec(path)?.[1])
    .filter((slug): slug is string => Boolean(slug));
  if (brands[0]) probes.push(`/produkty/?brands=${brands[0]}`);
  if (brands[0] && brands[1])
    probes.push(`/produkty/?brands=${brands[0]},${brands[1]}&sortBy=priceDesc`);

  const productCategory = firstSlugUnder(sitemapPaths, '/produkty/kategoria/');
  if (productCategory) {
    probes.push(`/produkty/kategoria/${productCategory}/?page=2`);
    probes.push(`/produkty/kategoria/${productCategory}/?sortBy=priceAsc`);
  }
  const blogCategory = firstSlugUnder(sitemapPaths, '/blog/kategoria/');
  if (blogCategory) probes.push(`/blog/kategoria/${blogCategory}/?page=2`);

  return uniqueSorted(probes);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * A stable, filesystem-safe file name for one path: a readable slug plus a
 * short hash of the exact path, so `/a/?x=1` and `/a/?x=2` never collide.
 */
export function snapshotFileName(path: string): string {
  const slug =
    path
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 100) || 'index';
  const hash = createHash('sha1').update(path).digest('hex').slice(0, 8);
  return `${slug}-${hash}.json`;
}

// ---------------------------------------------------------------------------
// Concurrency + HTTP
// ---------------------------------------------------------------------------

export async function pool<T, R>(
  items: readonly T[],
  concurrency: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await work(items[index]!, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export type Fetched = {
  status: number | 'unreachable';
  location: string | null;
  html: string;
  ms: number;
  error?: string;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET without following redirects; retried on a timeout, a dropped connection
 * or a 5xx. A 5xx that survives every attempt is returned as is.
 */
export async function fetchPage(
  url: string,
  options: {
    userAgent: string;
    timeoutMs?: number;
    attempts?: number;
    retryDelayMs?: number;
    cookie?: string | null;
    fetchImpl?: typeof fetch;
  },
): Promise<Fetched> {
  const {
    userAgent,
    timeoutMs = 120_000,
    attempts = 3,
    retryDelayMs = 3_000,
    cookie = null,
    fetchImpl = fetch,
  } = options;
  let last: Fetched = {
    status: 'unreachable',
    location: null,
    html: '',
    ms: 0,
  };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) await sleep(retryDelayMs);
    const started = performance.now();
    try {
      const response = await fetchImpl(url, {
        redirect: 'manual',
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const html = await response.text();
      last = {
        status: response.status,
        location: response.headers.get('location'),
        html,
        ms: Math.round(performance.now() - started),
      };
      if (response.status < 500) return last;
    } catch (error) {
      last = {
        status: 'unreachable',
        location: null,
        html: '',
        ms: Math.round(performance.now() - started),
        error: String(error).slice(0, 200),
      };
    }
  }
  return last;
}
