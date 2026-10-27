import type { SanityClient } from '@sanity/client';
import { describe, expect, it, vi } from 'vitest';

import { applyDenormalization } from './apply.js';
import {
  chunk,
  computeDenormFields,
  diffDenormFields,
  PATCH_BATCH_SIZE,
  planDenormPatches,
  type ProductDenormSource,
  stripBrandSlug,
} from './denorm.js';

const NOW = '2026-10-27T12:00:00.000Z';

function product(
  overrides: Partial<ProductDenormSource> = {},
): ProductDenormSource {
  return {
    _id: 'product-1',
    _rev: 'rev-1',
    brandSlug: '/marki/yamaha/',
    brandName: 'Yamaha',
    categorySlugs: ['/kategoria/gramofony/', '/kategoria/wzmacniacze/'],
    denormBrandSlug: 'yamaha',
    denormBrandName: 'Yamaha',
    denormCategorySlugs: ['/kategoria/gramofony/', '/kategoria/wzmacniacze/'],
    ...overrides,
  };
}

describe('stripBrandSlug', () => {
  it('strips the /marki/ prefix and trailing slash', () => {
    expect(stripBrandSlug('/marki/yamaha/')).toBe('yamaha');
    expect(stripBrandSlug('/marki/bowers-wilkins')).toBe('bowers-wilkins');
  });

  it('maps empty input to null', () => {
    expect(stripBrandSlug(null)).toBeNull();
    expect(stripBrandSlug(undefined)).toBeNull();
    expect(stripBrandSlug('')).toBeNull();
    expect(stripBrandSlug('/marki/')).toBeNull();
  });
});

describe('computeDenormFields', () => {
  it('keeps category slugs as full paths in the editor order', () => {
    const fields = computeDenormFields(
      product({
        categorySlugs: ['/kategoria/wzmacniacze/', '/kategoria/gramofony/'],
      }),
    );
    expect(fields.denormCategorySlugs).toEqual([
      '/kategoria/wzmacniacze/',
      '/kategoria/gramofony/',
    ]);
  });

  it('drops dangling category refs and handles a product with no brand', () => {
    expect(
      computeDenormFields(
        product({
          brandSlug: null,
          brandName: null,
          categorySlugs: [null, '/kategoria/gramofony/', ''],
        }),
      ),
    ).toEqual({
      denormBrandSlug: null,
      denormBrandName: null,
      denormCategorySlugs: ['/kategoria/gramofony/'],
    });
  });
});

describe('diffDenormFields', () => {
  it('returns null when nothing drifted (no-op diff)', () => {
    expect(diffDenormFields(product())).toBeNull();
  });

  it('treats a missing stored brand field as equal to a computed null', () => {
    expect(
      diffDenormFields(
        product({
          brandSlug: null,
          brandName: null,
          denormBrandSlug: undefined,
          denormBrandName: undefined,
        }),
      ),
    ).toBeNull();
  });

  it('detects a brand rename fanned out to the product', () => {
    expect(diffDenormFields(product({ brandName: 'Yamaha Music' }))).toEqual({
      denormBrandSlug: 'yamaha',
      denormBrandName: 'Yamaha Music',
      denormCategorySlugs: ['/kategoria/gramofony/', '/kategoria/wzmacniacze/'],
    });
  });

  it('detects a category reorder (same set, different primary category)', () => {
    const diff = diffDenormFields(
      product({
        categorySlugs: ['/kategoria/wzmacniacze/', '/kategoria/gramofony/'],
      }),
    );
    expect(diff?.denormCategorySlugs).toEqual([
      '/kategoria/wzmacniacze/',
      '/kategoria/gramofony/',
    ]);
  });

  it('writes an empty array once when the stored field is missing', () => {
    expect(
      diffDenormFields(
        product({ categorySlugs: [], denormCategorySlugs: undefined }),
      )?.denormCategorySlugs,
    ).toEqual([]);
    expect(
      diffDenormFields(product({ categorySlugs: [], denormCategorySlugs: [] })),
    ).toBeNull();
  });

  it('is a fixed point: applying the diff makes the next diff null (own-patch loop guard)', () => {
    const drifted = product({ brandName: 'Yamaha Music' });
    const fields = diffDenormFields(drifted);
    expect(fields).not.toBeNull();
    expect(diffDenormFields({ ...drifted, ...fields })).toBeNull();
  });
});

describe('planDenormPatches', () => {
  it('patches only drifted products and stamps denormLastSync', () => {
    const patches = planDenormPatches(
      [
        product({ _id: 'a' }),
        product({ _id: 'b', _rev: 'rev-b', brandName: 'Yamaha Music' }),
      ],
      NOW,
    );
    expect(patches).toEqual([
      {
        _id: 'b',
        _rev: 'rev-b',
        set: {
          denormBrandSlug: 'yamaha',
          denormBrandName: 'Yamaha Music',
          denormCategorySlugs: [
            '/kategoria/gramofony/',
            '/kategoria/wzmacniacze/',
          ],
          denormLastSync: NOW,
        },
      },
    ]);
  });

  it('never writes the retired parent-category or filter-key fields', () => {
    const [patch] = planDenormPatches([product({ brandName: 'X' })], NOW);
    expect(Object.keys(patch!.set).sort()).toEqual([
      'denormBrandName',
      'denormBrandSlug',
      'denormCategorySlugs',
      'denormLastSync',
    ]);
  });
});

describe('chunk', () => {
  it('splits a brand fan-out into transactions of the batch size', () => {
    const items = Array.from({ length: 186 }, (_, index) => index);
    const batches = chunk(items, PATCH_BATCH_SIZE);
    expect(batches.map((batch) => batch.length)).toEqual([50, 50, 50, 36]);
  });
});

function fakeClient(commit: () => Promise<unknown>) {
  const patches: Array<{ id: string; rev?: string; set?: unknown }> = [];
  const client = {
    transaction: () => {
      const transaction = {
        patch: (
          id: string,
          build: (p: {
            ifRevisionId: (rev: string) => unknown;
            set: (set: unknown) => unknown;
          }) => unknown,
        ) => {
          const entry: { id: string; rev?: string; set?: unknown } = { id };
          const builder = {
            ifRevisionId: (rev: string) => {
              entry.rev = rev;
              return builder;
            },
            set: (set: unknown) => {
              entry.set = set;
              return builder;
            },
          };
          build(builder);
          patches.push(entry);
          return transaction;
        },
        commit,
      };
      return transaction;
    },
  } as unknown as SanityClient;
  return { client, patches };
}

describe('applyDenormalization', () => {
  it('makes no request beyond the read when nothing drifted', async () => {
    const commit = vi.fn();
    const { client } = fakeClient(commit);
    const result = await applyDenormalization({
      client,
      read: async () => [product()],
      dryRun: false,
    });
    expect(result).toEqual({ planned: [], patched: 0 });
    expect(commit).not.toHaveBeenCalled();
  });

  it('plans but never commits in dry-run mode', async () => {
    const commit = vi.fn();
    const { client } = fakeClient(commit);
    const result = await applyDenormalization({
      client,
      read: async () => [product({ brandName: 'New' })],
      dryRun: true,
    });
    expect(result.planned).toHaveLength(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it('guards every patch with ifRevisionId and batches the fan-out', async () => {
    const commit = vi.fn(async () => ({}));
    const { client, patches } = fakeClient(commit);
    const products = Array.from({ length: 120 }, (_, index) =>
      product({ _id: `p${index}`, _rev: `r${index}`, brandName: 'Renamed' }),
    );
    const result = await applyDenormalization({
      client,
      read: async () => products,
      dryRun: false,
      now: () => NOW,
    });
    expect(result.patched).toBe(120);
    expect(commit).toHaveBeenCalledTimes(3);
    expect(patches[0]).toMatchObject({ id: 'p0', rev: 'r0' });
  });

  it('re-reads after a revision conflict and converges', async () => {
    let fresh = false;
    const commit = vi
      .fn()
      .mockImplementationOnce(async () => {
        fresh = true;
        throw Object.assign(new Error('conflict'), { statusCode: 409 });
      })
      .mockImplementation(async () => ({}));
    const { client } = fakeClient(commit);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const read = vi.fn(async () => [
      product({ _rev: fresh ? 'rev-2' : 'rev-1', brandName: 'Renamed' }),
    ]);
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined);
    const result = await applyDenormalization({
      client,
      read,
      dryRun: false,
      sleep,
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(result.patched).toBe(1);
  });

  it('gives up after four conflicting rounds', async () => {
    const commit = vi.fn(async () => {
      throw Object.assign(new Error('conflict'), { statusCode: 409 });
    });
    const { client } = fakeClient(commit);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined);
    await expect(
      applyDenormalization({
        client,
        read: async () => [product({ brandName: 'Renamed' })],
        dryRun: false,
        sleep,
      }),
    ).rejects.toThrow('conflict');
    expect(commit).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 3000, 6000]);
  });

  it('rethrows non-conflict errors', async () => {
    const commit = vi.fn(async () => {
      throw Object.assign(new Error('boom'), { statusCode: 500 });
    });
    const { client } = fakeClient(commit);
    await expect(
      applyDenormalization({
        client,
        read: async () => [product({ brandName: 'Renamed' })],
        dryRun: false,
      }),
    ).rejects.toThrow('boom');
  });
});
