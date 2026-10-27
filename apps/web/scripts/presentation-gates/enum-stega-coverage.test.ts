// @vitest-environment node
/**
 * Gate 0.2: enum coverage.
 *
 * Draft-mode stega appends invisible markers to every string it encodes. An
 * `options.list` field is by definition a value the code COMPARES (a `switch`,
 * a `data-*` attribute, a Map key, B2C buyability), so an enum leaf the stega
 * filter does not skip breaks in Presentation only, with no build error
 * anywhere. Rule (`global/sanity/stega-filter.ts`): an enum joins the set in
 * the same commit as the field.
 *
 * Every `options: { list: … }` field under `apps/studio/schemaTypes/**`
 * (source scan, comments stripped) must be in `STEGA_LOGIC_ONLY_FIELDS`
 * (read from `stega-filter.ts` source), under a `STEGA_LOGIC_ONLY_PARENTS`
 * subtree, or skipped by `@sanity/client`'s own `filterDefault`. Number enums
 * are exempt: stega encodes strings only. Ported from lsse-www.
 */
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  isTypeScript,
  read,
  relative,
  repoPath,
  ROOT_PATH,
  stripComments,
  walk,
} from './source';

/**
 * `@sanity/client`'s `filterDefault` denylist (`dist/stegaEncodeSourceMap-*.js`
 * of `@sanity/client` 8.11), mirrored here and checked against the installed
 * package by the last test so the mirror cannot drift silently.
 */
const VENDOR_DENYLIST = new Set(
  'aspect_ratio.aspectRatio.blurHash.color.colour.currency.email.encoding_tier.format.gid.hex.href.hsl.hsla.icon.id.index.key.language.layout.link.linkAction.locale.lqip.master_access.max_resolution_tier.max_stored_resolution.mp4_support.page.path.ref.resolution_tier.rgb.rgba.route.secret.slug.status.tag.template.textTheme.theme.thumbHash.type.unit.upload_id.url.username.variant.video_quality.video_resolution.website'.split(
    '.',
  ),
);

/**
 * The name-shaped rules of `filterDefault`: the denylist, `_`-prefixed and
 * `*Id` leaves, and `hasTypeLike` (ANY path segment matching `/type/i`, which
 * is why `productType`, `filterType` and `authorType` are never encoded).
 */
const vendorExempt = (name: string): boolean =>
  VENDOR_DENYLIST.has(name) ||
  name.startsWith('_') ||
  name.endsWith('Id') ||
  /type/i.test(name);

const SCHEMA_DIR = repoPath('apps/studio/schemaTypes/');
const STEGA_FILTER = repoPath('apps/web/src/global/sanity/stega-filter.ts');

/** The string literals of the `new Set([ … ])` that follows `opener`. */
function setMembers(source: string, opener: RegExp): Set<string> {
  const stripped = stripComments(source);
  const start = opener.exec(stripped);
  if (!start) throw new Error(`no \`${opener.source}\` in source`);
  const from = start.index + start[0].length;
  const end = stripped.indexOf(']);', from);
  const body = stripped.slice(from, end);
  return new Set(
    Array.from(body.matchAll(/'([A-Za-z0-9_]+)'/g), (match) => match[1]!),
  );
}

const filterSource = read(STEGA_FILTER);
const stegaLeaves = setMembers(
  filterSource,
  /export const STEGA_LOGIC_ONLY_FIELDS[^=]*=\s*new Set\(\[/,
);
const stegaParents = setMembers(
  filterSource,
  /export const STEGA_LOGIC_ONLY_PARENTS[^=]*=\s*new Set\(\[/,
);

type EnumField = {
  name: string;
  type: string;
  file: string;
  line: number;
};

function last(
  source: string,
  regex: RegExp,
): { value: string; index: number } | null {
  let found: { value: string; index: number } | null = null;
  for (const match of source.matchAll(regex))
    found = { value: match[1]!, index: match.index };
  return found;
}

/**
 * Every `list:` inside an `options` object: the nearest preceding
 * `name: '…'` is the field, the nearest `type: '…'` after that name is its
 * type. Both run over comment-stripped source.
 */
function enumFields(): EnumField[] {
  const out: EnumField[] = [];
  for (const file of walk(SCHEMA_DIR, isTypeScript)) {
    const source = stripComments(read(file));
    for (const match of source.matchAll(/\blist\s*:/g)) {
      const before = source.slice(0, match.index);
      if (!/options\s*:\s*\{[^}]*$/s.test(before.slice(-400))) continue;
      const name = last(before, /\bname\s*:\s*'([A-Za-z0-9_]+)'/g);
      if (!name) continue;
      const type = last(
        before.slice(name.index),
        /\btype\s*:\s*'([A-Za-z]+)'/g,
      );
      out.push({
        name: name.value,
        type: type?.value ?? 'string',
        file: relative(file),
        line: before.split('\n').length,
      });
    }
  }
  return out;
}

const fields = enumFields();
const stringEnums = fields.filter((field) => field.type !== 'number');

// Leaf names only: a subtree rule (`STEGA_LOGIC_ONLY_PARENTS`) cannot be
// proven from a source scan, so an enum relying on one still lists its leaf.
const covered = (field: EnumField): boolean =>
  stegaLeaves.has(field.name) || vendorExempt(field.name);

describe('enum coverage: every options.list leaf is stega-exempt', () => {
  test('the scans found the enums and the filter sets', () => {
    expect(fields.length).toBeGreaterThanOrEqual(10);
    expect(stegaLeaves.size).toBeGreaterThan(20);
    expect(stegaParents.size).toBeGreaterThan(0);
  });

  test('every string enum leaf is skipped by the stega filter', () => {
    const uncovered = stringEnums.filter((field) => !covered(field));
    expect(
      uncovered.map((f) => `${f.name} (${f.file}:${f.line})`),
      'enum leaves missing from STEGA_LOGIC_ONLY_FIELDS in apps/web/src/global/sanity/stega-filter.ts',
    ).toEqual([]);
  });

  test('VENDOR_DENYLIST mirrors the installed @sanity/client', () => {
    // Resolved from the repo root: the web app's single `@sanity/client` 8
    // is hoisted there (next-sanity keeps its own nested 7.x copy).
    const require = createRequire(`${ROOT_PATH}package.json`);
    const dist = dirname(require.resolve('@sanity/client/stega'));
    const encoders = readdirSync(dist).filter(
      (entry) =>
        entry.startsWith('stegaEncodeSourceMap') && entry.endsWith('.js'),
    );
    expect(
      encoders.length,
      `no stegaEncodeSourceMap-*.js in ${dist}`,
    ).toBeGreaterThan(0);
    const source = read(`${dist}/${encoders[0]}`);
    const match = /denylist\s*=[^"]*"([a-zA-Z_.0-9]+)"\.split\("\."\)/.exec(
      source,
    );
    expect(
      match,
      'the vendor denylist literal was not found: re-mirror it by hand',
    ).not.toBeNull();
    const installed = new Set(match![1]!.split('.'));
    expect([...installed].sort()).toEqual([...VENDOR_DENYLIST].sort());
    // The `/type/i` rule `vendorExempt` relies on.
    expect(source).toMatch(/segment\.match\(\/type\/i\)/);
  });
});
