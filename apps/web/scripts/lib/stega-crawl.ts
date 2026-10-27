/**
 * Bun-free helpers of the stega-leak crawler (`scripts/check-stega-leaks.ts`),
 * split out so vitest can import them (`stega-crawl.test.ts`).
 *
 * Ported from lsse-www `apps/web/scripts/check-stega-leaks.ts`: the location
 * classes, the published/draft analysis, the cross-mode bag of words and the
 * markdown report. Differences: one locale (no locale prefixes), `?page=N`
 * pagination instead of a path segment, and a small tokenizer instead of
 * Bun's `HTMLRewriter`, so the same code runs under bun, node and vitest.
 */

import {
  decodeEntities,
  parseAttributes,
  STEGA_CHARS,
  stripStega,
} from './crawl';

export type Mode = 'published' | 'draft';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * `@vercel/stega`'s `VERCEL_STEGA_REGEX`: the marker alphabet, four or more
 * in a row, so a lone zero-width joiner inside an emoji never counts.
 */
export const MARKERS = new RegExp(`${STEGA_CHARS.source}{4,}`, 'gu');

export function markerRuns(value: string): number {
  return Array.from(value.matchAll(MARKERS)).length;
}

/**
 * HTML whitespace only, never `\s`: JavaScript's `\s` matches U+FEFF, one of
 * the marker characters, so a `\s+` collapse would cut every run apart.
 */
const HTML_SPACE = /[ \t\n\f\r]+/g;
export function collapse(value: string): string {
  return value.replace(HTML_SPACE, ' ').replace(/^ | $/g, '');
}

// ---------------------------------------------------------------------------
// HTML extraction
// ---------------------------------------------------------------------------

/**
 * One place a machine or a person reads a string. `kind` is the location
 * class the report groups by: `text` (visible), `title`, `attr:<name>`,
 * `jsonld:<path>`, `script`, `style`, `noscript`, `form-value`, `svg`,
 * `ssr-error`.
 */
export type Location = { kind: string; where: string; text: string };

export type StegaPage = {
  locations: Location[];
  /** Visible text segments in document order, for the cross-mode compare. */
  text: string[];
  /** `data-sanity*` attributes seen: must be zero in published mode. */
  dataSanity: number;
};

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
/** Tags whose open or close does NOT break a visible-text segment. */
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
/** Element text that is a location of its own rather than visible copy. */
const RAW_TEXT: Record<string, string> = {
  title: 'title',
  script: 'script',
  style: 'style',
  textarea: 'form-value',
  noscript: 'noscript',
};

const START_TAG =
  /<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
const END_TAG = /<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>/y;

/** React's streamed "render this boundary on the client" call. */
const CLIENT_RENDER_CALL = /\$RX\("[^"]*"(?:,"([^"]*)")?/g;

/**
 * Digests that are control flow, not errors: `notFound()` / `forbidden()` /
 * `unauthorized()` (`NEXT_HTTP_ERROR_FALLBACK;<status>`) and `redirect()`
 * (`NEXT_REDIRECT;…`) streamed after the shell. Whether a page SHOULD be
 * not-found is the crawler's status logic (`isNotFound`), not this class.
 */
const CONTROL_FLOW_DIGEST = /^NEXT_(?:HTTP_ERROR_FALLBACK|REDIRECT);/;

export function extractLocations(html: string): StegaPage {
  const page: StegaPage = { locations: [], text: [], dataSanity: 0 };
  const stack: string[] = [];
  let svgDepth = 0;
  let buffer = '';
  let bufferWhere = '';

  const where = (): string => stack.slice(-4).join(' > ') || 'document';
  const flush = (): void => {
    const text = collapse(decodeEntities(buffer));
    if (text) {
      page.text.push(text);
      page.locations.push({
        kind: svgDepth ? 'svg' : 'text',
        where: bufferWhere,
        text,
      });
    }
    buffer = '';
  };
  const addText = (chunk: string): void => {
    if (!buffer) bufferWhere = where();
    buffer += chunk;
  };

  let index = 0;
  while (index < html.length) {
    const lt = html.indexOf('<', index);
    if (lt === -1) {
      addText(html.slice(index));
      break;
    }
    if (lt > index) addText(html.slice(index, lt));
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
      const open = stack.lastIndexOf(tag);
      if (open !== -1) {
        // Also drops unclosed children (tolerates sloppy markup).
        stack.length = open;
        svgDepth = stack.filter((entry) => entry === 'svg').length;
      }
      index = END_TAG.lastIndex;
      continue;
    }

    START_TAG.lastIndex = index;
    const start = START_TAG.exec(html);
    if (!start) {
      addText('<');
      index += 1;
      continue;
    }
    index = START_TAG.lastIndex;
    const tag = start[1]!.toLowerCase();
    const attributes = parseAttributes(start[2] ?? '');
    const selfClosing = start[3] === '/';
    const at = `${where()} > ${tag}`;

    for (const [name, value] of attributes) {
      if (name.startsWith('data-sanity')) {
        page.dataSanity += 1;
        continue;
      }
      if (!value) continue;
      page.locations.push({
        kind: svgDepth || tag === 'svg' ? 'svg' : `attr:${name}`,
        where: `${at}[${name}]`,
        text: value,
      });
    }

    // A Suspense boundary whose SERVER render threw. `BAILOUT_TO_CLIENT_SIDE_
    // RENDERING` is by design (a `dynamic(…, { ssr: false })` component, such
    // as the preview bar); every other digest is a real thrown error.
    if (tag === 'template') {
      const message = attributes.get('data-msg');
      if (
        message &&
        attributes.get('data-dgst') !== 'BAILOUT_TO_CLIENT_SIDE_RENDERING'
      )
        page.locations.push({
          kind: 'ssr-error',
          where: at,
          text: collapse(message),
        });
    }

    if (!INLINE.has(tag)) flush();

    const insideSvg = svgDepth > 0;
    if (Object.hasOwn(RAW_TEXT, tag) && !selfClosing && !insideSvg) {
      const closeTag = new RegExp(`</${tag}\\s*>`, 'gi');
      closeTag.lastIndex = index;
      const close = closeTag.exec(html);
      const body = html.slice(index, close ? close.index : html.length);
      index = close ? closeTag.lastIndex : html.length;

      const isJsonLd =
        tag === 'script' &&
        (attributes.get('type') ?? '').trim() === 'application/ld+json';
      if (isJsonLd) {
        walkJsonLd(body, page.locations, at);
      } else if (tag === 'script' && body.startsWith('self.__next_f.push(')) {
        // The RSC flight payload serialises the same tree the HTML carries,
        // visible text included, so its marker runs are the text's own. A
        // marker that reached an attribute is caught on the attribute itself.
      } else if (body.trim()) {
        if (tag === 'script') {
          for (const match of body.matchAll(CLIENT_RENDER_CALL)) {
            if (CONTROL_FLOW_DIGEST.test(match[1] ?? '')) continue;
            page.locations.push({
              kind: 'ssr-error',
              where: at,
              text: `client-render digest="${match[1] ?? ''}"`,
            });
          }
        }
        page.locations.push({
          kind: RAW_TEXT[tag]!,
          where: at,
          text: tag === 'title' ? collapse(decodeEntities(body)) : body,
        });
      }
      continue;
    }

    if (VOID.has(tag) || selfClosing) continue;
    stack.push(tag);
    if (tag === 'svg') svgDepth += 1;
  }
  flush();
  return page;
}

export function walkJsonLd(blob: string, out: Location[], where: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch (error) {
    out.push({
      kind: 'jsonld:PARSE-ERROR',
      where,
      text: String(error).slice(0, 120),
    });
    return;
  }
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value))
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
    else if (value && typeof value === 'object')
      for (const [key, item] of Object.entries(value))
        walk(item, `${path}.${key}`);
    else if (typeof value === 'string')
      out.push({ kind: `jsonld:${path}`, where, text: value });
  };
  walk(parsed, '$');
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export type Finding = {
  kind: string;
  where: string;
  text: string;
  runs: number;
};

/**
 * Published: every marker anywhere is a finding, and so is a single
 * `data-sanity` attribute. Draft: markers in visible text are expected and
 * counted; markers anywhere else are findings. Either: an `ssr-error`.
 */
export function analyse(
  page: StegaPage,
  mode: Mode,
): { findings: Finding[]; textRuns: number } {
  const findings: Finding[] = [];
  let textRuns = 0;
  for (const location of page.locations) {
    if (location.kind === 'ssr-error') {
      findings.push({ ...location, runs: 0 });
      continue;
    }
    const runs = markerRuns(location.text);
    if (runs === 0) continue;
    if (location.kind === 'text' && mode === 'draft') {
      textRuns += runs;
      continue;
    }
    findings.push({ ...location, runs });
  }
  if (mode === 'published' && page.dataSanity > 0)
    findings.push({
      kind: 'data-sanity',
      where: 'document',
      text: `${page.dataSanity} data-sanity attribute(s) in published HTML`,
      runs: 0,
    });
  return { findings, textRuns };
}

/**
 * The visible text as a bag of stega-stripped tokens. A BAG, not a string: a
 * draft render streams its content behind a Suspense boundary, so the same
 * words arrive in a different document order than in the published render.
 */
export function textTokens(page: StegaPage): Map<string, number> {
  const bag = new Map<string, number>();
  for (const token of collapse(stripStega(page.text.join(' '))).split(' '))
    if (token) bag.set(token, (bag.get(token) ?? 0) + 1);
  return bag;
}

/** `null` when the bags agree; otherwise what each side has that the other lacks. */
export function tokenDifference(
  published: Map<string, number>,
  draft: Map<string, number>,
): string | null {
  const only = (a: Map<string, number>, b: Map<string, number>): string[] => {
    const out: string[] = [];
    for (const [token, count] of a) {
      const missing = count - (b.get(token) ?? 0);
      if (missing > 0) out.push(missing > 1 ? `${token}×${missing}` : token);
    }
    return out;
  };
  const onlyPublished = only(published, draft);
  const onlyDraft = only(draft, published);
  if (onlyPublished.length === 0 && onlyDraft.length === 0) return null;
  const list = (tokens: string[]): string =>
    `${tokens.length}: “${tokens.slice(0, 12).join(' ')}${tokens.length > 12 ? ' …' : ''}”`;
  return `only published ${list(onlyPublished)}; only draft ${list(onlyDraft)}`;
}

/**
 * Next renders a `notFound()` streamed after the shell as a 200 whose payload
 * carries this digest (PPR sends the status before the boundary resolves;
 * `parity/README.md`), so "not found" is the status OR the digest.
 */
export function isNotFound(
  status: number | 'unreachable',
  html: string,
): boolean {
  return status === 404 || html.includes('NEXT_HTTP_ERROR_FALLBACK;404');
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * One representative per route template: the query string kept as its keys
 * only (`?page=`), and the last segment of a ≥2-segment path is a slug.
 */
export function templateKey(path: string): string {
  const [pathname = '/', search = ''] = path.split('?');
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) segments[segments.length - 1] = '<slug>';
  const keys = search
    ? `?${[...new URLSearchParams(search).keys()].sort().join('&')}`
    : '';
  return `/${segments.join('/')}${segments.length ? '/' : ''}${keys}`;
}

/** The probe that must answer not-found in BOTH modes. */
export const NEVER_EXISTING = '/this-page-does-not-exist/';

/**
 * Fixed probes outside the sitemap: listing pagination and sort, the
 * comparator, the archives, a 404, and the B2C routes (always published,
 * never Presentation targets, so they must stay marker-free even inside a
 * draft session, P10).
 */
export function buildStegaProbes(sitemapPaths: readonly string[]): string[] {
  const probes = [
    NEVER_EXISTING,
    '/produkty/?page=2',
    '/produkty/?sortBy=priceAsc',
    '/blog/?page=2',
    '/certyfikowany-sprzet-uzywany/?page=2',
    '/porownaj/',
    '/produkty/archiwalne/',
    '/recenzje/archiwalne/',
    '/koszyk/',
    '/koszyk/twoje-dane/',
    '/konto-klienta/',
  ];
  const firstUnder = (prefix: string): string | null =>
    [...sitemapPaths]
      .sort()
      .find((path) => new RegExp(`^${prefix}[^/?]+/$`).test(path)) ?? null;
  const productCategory = firstUnder('/produkty/kategoria/');
  if (productCategory) probes.push(`${productCategory}?page=2`);
  const blogCategory = firstUnder('/blog/kategoria/');
  if (blogCategory) probes.push(`${blogCategory}?page=2`);
  return [...new Set(probes)].sort();
}

/** A site path: leading slash, and a trailing slash before any query. */
export function normalizePath(value: string): string {
  const [pathname = '', search] = value.split('?');
  let path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (!path.endsWith('/')) path = `${path}/`;
  return search === undefined ? path : `${path}?${search}`;
}
