// @vitest-environment node
import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const { sanityClientFetch } = vi.hoisted(() => ({
  sanityClientFetch: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@sanity/client', () => ({
  createClient: vi.fn(() => ({
    fetch: sanityClientFetch,
    transaction: vi.fn(() => ({
      patch: vi.fn(),
      commit: vi.fn(async () => undefined),
    })),
    patch: vi.fn(() => ({
      set: vi.fn(() => ({ commit: vi.fn(async () => undefined) })),
    })),
  })),
}));

const TOKEN = 'test-revalidate-token';

type RevalidateResponse = {
  revalidated: boolean;
  tags: string[];
  immediateTags: string[];
};

function createRequest(body: unknown, token = TOKEN): NextRequest {
  return new Request('https://audiofast.pl/api/revalidate/', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }) as NextRequest;
}

async function post(body: unknown) {
  const response = await POST(createRequest(body));
  return {
    status: response.status,
    body: (await response.json()) as RevalidateResponse,
  };
}

/** Profile each tag was revalidated with: 'immediate' | 'swr'. */
function revalidatedProfiles() {
  return new Map(
    vi
      .mocked(revalidateTag)
      .mock.calls.map(([tag, profile]) => [
        tag,
        profile === 'max' ? 'swr' : 'immediate',
      ]),
  );
}

/** Route Sanity reads by query shape. */
function mockSanityReads({
  references = [],
}: {
  references?: Array<{ _id: string; _type: string; slug: string | null }>;
}) {
  sanityClientFetch.mockImplementation(async (query: string) => {
    if (query.includes('references($id)')) return references;
    // Denormalization / slug lookups: nothing to do in these tests.
    return null;
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_REVALIDATE_TOKEN', TOKEN);
  vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', 'test-project');
  vi.stubEnv('NEXT_PUBLIC_SANITY_DATASET', 'test');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('POST /api/revalidate — brand dealer list on product pages', () => {
  it('rejects requests without the bearer token', async () => {
    const response = await POST(
      createRequest({ _type: 'brand', _id: 'brand-1' }, 'wrong'),
    );

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('brand publish revalidates brand-stores:<id> (stale-while-revalidate)', async () => {
    mockSanityReads({});

    const { status, body } = await post({
      _type: 'brand',
      _id: 'brand-grimm',
      slug: '/marki/grimm-audio/',
      operation: 'update',
    });

    expect(status).toBe(200);
    expect(body.tags).toContain('brand-stores:brand-grimm');
    expect(body.immediateTags).not.toContain('brand-stores:brand-grimm');
    expect(revalidatedProfiles().get('brand-stores:brand-grimm')).toBe('swr');
  });

  it('brand publish keeps the existing brand tags and profiles', async () => {
    mockSanityReads({});

    const { body } = await post({
      _type: 'brand',
      _id: 'brand-grimm',
      slug: '/marki/grimm-audio/',
      operation: 'update',
    });

    const profiles = revalidatedProfiles();
    expect(profiles.get('brand:grimm-audio')).toBe('immediate');
    expect(profiles.get('brands')).toBe('swr');
    expect(profiles.get('filter-metadata')).toBe('swr');
    // Never the broad tags that would cool every brand / product shell.
    expect(body.tags).not.toContain('brand');
    expect(body.tags).not.toContain('brand-stores');
    expect(body.tags).not.toContain('product');
  });

  it('brand publish with a draft id targets the published brand id', async () => {
    mockSanityReads({});

    const { body } = await post({
      _type: 'brand',
      _id: 'drafts.brand-grimm',
      slug: '/marki/grimm-audio/',
    });

    expect(body.tags).toContain('brand-stores:brand-grimm');
  });

  it('store publish revalidates brand-stores:<id> for each referencing brand', async () => {
    mockSanityReads({
      references: [
        { _id: 'brand-grimm', _type: 'brand', slug: '/marki/grimm-audio/' },
        { _id: 'brand-other', _type: 'brand', slug: '/marki/other/' },
        { _id: 'product-x', _type: 'product', slug: '/produkty/x/' },
      ],
    });

    const { status, body } = await post({
      _type: 'store',
      _id: 'store-tf-audio',
      operation: 'update',
    });

    expect(status).toBe(200);
    const profiles = revalidatedProfiles();
    expect(profiles.get('brand-stores:brand-grimm')).toBe('swr');
    expect(profiles.get('brand-stores:brand-other')).toBe('swr');
    // Existing behaviour is unchanged: brand pages + products listing the
    // store directly, as collateral.
    expect(profiles.get('brand:grimm-audio')).toBe('swr');
    expect(profiles.get('brand:other')).toBe('swr');
    expect(profiles.get('product:x')).toBe('swr');
    expect(profiles.get('store')).toBe('immediate');
    // Product documents never produce a brand-stores tag.
    expect(body.tags).not.toContain('brand-stores:product-x');
  });

  it('store lookup projects _id so the brand id is available', async () => {
    mockSanityReads({ references: [] });

    await post({ _type: 'store', _id: 'store-tf-audio' });

    const lookupQuery = sanityClientFetch.mock.calls
      .map(([query]) => query as string)
      .find((query) => query.includes('references($id)'));
    expect(lookupQuery).toMatch(/\{\s*_id,\s*_type/);
  });

  it('non-store references to a brand do not add brand-stores tags', async () => {
    mockSanityReads({
      references: [
        { _id: 'brand-grimm', _type: 'brand', slug: '/marki/grimm-audio/' },
      ],
    });

    // A review featured on a brand page reaches `brand:<slug>` only.
    const { body } = await post({
      _type: 'review',
      _id: 'review-1',
      slug: '/recenzje/review-1/',
    });

    expect(body.tags).toContain('brand:grimm-audio');
    expect(body.tags).not.toContain('brand-stores:brand-grimm');
  });
});
