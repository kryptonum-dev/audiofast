// @vitest-environment node
/**
 * Gate 0.8: the stega-branded types probe (research/03 §3.2).
 *
 * `next-sanity` 13 can type query results as `StegaBranded<T>` (a string
 * brand that makes "this value may carry markers" visible to the compiler).
 * The question is whether that brand reaches audiofast's consumers. It does
 * not: `live.ts` returns `result.data as TResult`, which widens the brand
 * away, so every call site sees the plain typegen result and the stega
 * discipline is enforced by the filter, `stegaClean`/`hasText` and the other
 * gates instead of by types. Same finding as lsse-www.
 *
 * The assertions are type-level: `bun run check-types` (which includes
 * `scripts/**`) fails if a future `live.ts` starts returning branded data,
 * and the runtime test only proves the file is collected. Only types are
 * imported, so nothing server-side is evaluated.
 */
import type { StegaBranded } from 'next-sanity';
import { describe, expect, expectTypeOf, test } from 'vitest';

import type {
  sanityFetch,
  sanityFetchCached,
  sanityFetchPublished,
} from '../../src/global/sanity/live';

type Row = { title: string; tags: string[] };

type LiveData = Awaited<ReturnType<typeof sanityFetch<Row>>>['data'];
type CachedData = Awaited<ReturnType<typeof sanityFetchCached<Row>>>;
type PublishedData = Awaited<ReturnType<typeof sanityFetchPublished<Row>>>;

describe('StegaBranded does not reach consumers', () => {
  test('fetch helpers return the plain result type', () => {
    expectTypeOf<LiveData>().toEqualTypeOf<Row>();
    expectTypeOf<CachedData>().toEqualTypeOf<Row>();
    expectTypeOf<PublishedData>().toEqualTypeOf<Row>();
    expectTypeOf<LiveData['title']>().not.toEqualTypeOf<StegaBranded<string>>();
    expect(true).toBe(true);
  });
});
