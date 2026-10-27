// @vitest-environment node
/**
 * Gate 0.5: the `[]->` projection lint.
 *
 * A reference array dereferenced as `refs[]->{…}` returns the same data as
 * `refs[]{ _key, ...@->{…} }` and silently drops `_key`. Without a key,
 * Presentation cannot address the array item, so drag-to-reorder dies with no
 * error (research/11 §5; Phase 5 removed all 29 bare derefs, Phase 9 relies on
 * the keyed form). This keeps every GROQ string in the web app keyed.
 *
 * Scope: every non-test source file under `apps/web/src` (the queries live in
 * `global/sanity/query.ts`, but route handlers and cart revalidation build
 * their own). Comments are stripped first, so prose warning about the shape
 * never counts.
 */
import { describe, expect, test } from 'vitest';

import {
  isTest,
  isTypeScript,
  read,
  relative,
  repoPath,
  stripComments,
  walk,
} from './source';

const SRC = repoPath('apps/web/src/');
const BARE_DEREF = /\[\]\s*->/;

const files = walk(SRC, isTypeScript).filter(
  (path) => !isTest(path) && !path.endsWith('/sanity.types.ts'),
);

describe('GROQ projections keep `_key` on dereferenced arrays', () => {
  test('the walk found the query module', () => {
    expect(files.some((path) => path.endsWith('global/sanity/query.ts'))).toBe(
      true,
    );
  });

  test('no bare `[]->` outside comments under apps/web/src', () => {
    const hits: string[] = [];
    for (const path of files) {
      stripComments(read(path))
        .split('\n')
        .forEach((line, index) => {
          if (BARE_DEREF.test(line))
            hits.push(`${relative(path)}:${index + 1}`);
        });
    }
    expect(
      hits,
      'bare `[]->`: project `_key` first, as `refs[]{ _key, ...@->{…} }`',
    ).toEqual([]);
  });
});
