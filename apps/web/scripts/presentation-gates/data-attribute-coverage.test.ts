// @vitest-environment node
/**
 * Gate 0.6: per-block `dataAttribute` coverage.
 *
 * `PageBuilder` (`components/shared/PageBuilder.tsx`) wraps every block in a
 * draft-only `data-sanity` element and hands blocks with an authored array a
 * `dataAttribute` pre-scoped to `pageBuilder[_key=="…"]`, which the block
 * threads onto each item so Presentation can overlay, click and drag it. A
 * block that ignores the prop renders fine and simply has no item overlay:
 * no error, just an editor who cannot grab the row. This makes membership a
 * check instead of a code-review memory. Ported from lsse-www.
 *
 * Three halves, all asserted so the exclusion list cannot go stale:
 *   - a registered block NOT in `NO_ITEM_OVERLAY` has a source file in its
 *     component folder referencing `dataAttribute` (or the pre-built
 *     `dataSanity(` string a client island receives), and PageBuilder passes
 *     it `dataAttribute={blockAttribute}`;
 *   - a block IN `NO_ITEM_OVERLAY` references neither; the moment one is
 *     wired, its row is deleted in the same change;
 *   - every registered block has a `case` in PageBuilder (a block the
 *     renderer drops gets no overlay at all).
 */
import { readdirSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { read, repoPath, stripComments } from './source';

/**
 * Blocks that deliberately receive no item overlay, with the reason. The
 * block-level wrapper PageBuilder stamps still makes the whole block
 * click-to-edit, and stega text inside still opens its field. Array reasons
 * match `context/changes/sanity-modernization/presentation-arrays.md`.
 */
const NO_ITEM_OVERLAY: Record<string, string> = {
  // Carousels and marquees: cloned / looped DOM, not 1:1 with array order.
  heroCarousel:
    'cross-fade carousel (one visible slide) + duplicated-DOM brand marquee',
  brandsMarquee: 'marquee with duplicated DOM and a hover-driven header swap',
  featuredProducts:
    'embla loop:true, tabbed (inactive tab unmounted), select()',
  featuredPublications: 'embla loop:true + clone-by-duplication + select()',
  productsCarousel: 'embla loop + duplication',
  // Query-derived: no authored array order to address.
  brandsList:
    'the query re-sorts selected brands by orderRank (authored order ignored)',
  brandsByCategoriesSection: 'listing derived from a query, no authored array',
  cpoProductsListing: 'listing: the CPO products come from a query',
  latestPublication: 'a single reference, no array',
  // Fixed shape: scalars and Portable Text only; the block wrapper reaches
  // every field.
  imageTextColumns: 'fixed shape: image, heading, content, button',
  blurLinesTextImage: 'fixed shape: heading, description, image',
  imageWithVideo:
    'fixed shape: image, YouTube id, heading, description, button',
  phoneImageCta:
    'fixed shape: image, two heading/description pairs, button, phone',
  contactMap: 'fixed shape: heading and an address (custom or from settings)',
};

const BLOCK_INDEX = repoPath('apps/studio/schemaTypes/blocks/index.ts');
const BLOCK_DIR = repoPath('apps/studio/schemaTypes/blocks/');
const COMPONENT_DIR = repoPath('apps/web/src/components/pageBuilder/');
const PAGE_BUILDER = repoPath('apps/web/src/components/shared/PageBuilder.tsx');

const pascalCase = (name: string): string =>
  name.charAt(0).toUpperCase() + name.slice(1);

/**
 * The `pageBuilderBlocks = [ … ]` registry of `blocks/index.ts`, as schema
 * type names: each entry is an imported schema object, resolved through its
 * import to the `name: '…'` its `defineType` declares.
 */
function readRegistry(): string[] {
  const source = stripComments(read(BLOCK_INDEX));
  const imports = new Map(
    Array.from(
      source.matchAll(/import \{ (\w+) \} from '\.\/([\w-]+)';/g),
      (match) => [match[1]!, match[2]!] as const,
    ),
  );
  const array = /export const pageBuilderBlocks = \[([\s\S]*?)\];/.exec(source);
  if (!array) throw new Error('blocks/index.ts: no `pageBuilderBlocks` array');
  return array[1]!
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((variable) => {
      const file = imports.get(variable);
      if (!file)
        throw new Error(`blocks/index.ts: ${variable} is not imported`);
      const schema = stripComments(read(`${BLOCK_DIR}${file}.ts`));
      const name = /defineType\(\{\s*name:\s*'(\w+)'/.exec(schema);
      if (!name) throw new Error(`${file}.ts: no defineType name`);
      return name[1]!;
    });
}

const THREADS = /\bdataAttribute\b|\bdataSanity\(/;

function referencesDataAttribute(folder: string): boolean {
  const dir = `${COMPONENT_DIR}${folder}/`;
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(
      (entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry),
    );
  } catch {
    return false;
  }
  return files.some((entry) => THREADS.test(stripComments(read(dir + entry))));
}

const registry = readRegistry();
const pageBuilder = stripComments(read(PAGE_BUILDER));

/** The JSX PageBuilder renders for one block type. */
function caseBody(name: string): string | null {
  const start = pageBuilder.indexOf(`case '${name}':`);
  if (start === -1) return null;
  const next = pageBuilder.slice(start + 1).search(/\n\s*(?:case '|default:)/);
  return pageBuilder.slice(start, next === -1 ? undefined : start + 1 + next);
}

describe('dataAttribute: every registered block threads it, or says why not', () => {
  test('the registry was read', () => {
    expect(registry.length).toBeGreaterThanOrEqual(20);
  });

  test('every NO_ITEM_OVERLAY row names a registered block', () => {
    const known = new Set(registry);
    expect(
      Object.keys(NO_ITEM_OVERLAY).filter((name) => !known.has(name)),
    ).toEqual([]);
  });

  test('the block wrapper is draft-gated in PageBuilder', () => {
    expect(pageBuilder).toMatch(/getDataAttribute\(\{/);
    expect(pageBuilder).toMatch(
      /if \(!dataAttribute\) \{\s*return \[<Fragment key=\{block\._key\}>/,
    );
  });

  for (const name of registry) {
    const folder = pascalCase(name);
    const reason = NO_ITEM_OVERLAY[name];

    test(`${name}: PageBuilder renders it`, () => {
      expect(caseBody(name), `${name}: no case in PageBuilder.tsx`).not.toBe(
        null,
      );
    });

    if (reason) {
      test(`${name}: excluded (${reason}) and still unwired`, () => {
        expect(
          referencesDataAttribute(folder),
          `${name} (${folder}/) now references dataAttribute: delete its NO_ITEM_OVERLAY row`,
        ).toBe(false);
      });
      continue;
    }

    test(`${name}: component threads dataAttribute`, () => {
      expect(
        referencesDataAttribute(folder),
        `${name} (${folder}/): no dataAttribute in any source file: thread it onto the block's array items, or add a NO_ITEM_OVERLAY row with the reason`,
      ).toBe(true);
      expect(
        caseBody(name),
        `${name}: PageBuilder must pass dataAttribute={blockAttribute}`,
      ).toContain('dataAttribute={blockAttribute}');
    });
  }
});
