import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { after, type NextRequest, NextResponse } from 'next/server';

/**
 * Receiving end of the tag invalidation loop. Two callers:
 *
 * 1. The `invalidate-sync-tags` Sanity Function (`apps/functions`) POSTs
 *    `{ tags }` — the sync tags a publish invalidated, UNPREFIXED. Each is
 *    expired here as `sanity:<tag>`, the prefix `defineLive`'s `sanityFetch`
 *    used in `cacheTag()`. A wrong prefix expires nothing while answering 200.
 * 2. The Supabase `pricing-ingest` Edge Function POSTs
 *    `{ customTags: ['product-pricing'] }` once per Excel price run. Supabase
 *    data never carries a sync tag, so non-Sanity tags go through an explicit
 *    ALLOWLIST (`product-pricing`, `product-pricing:<slug>`); anything else is
 *    a 400, so this endpoint cannot be used to expire arbitrary cache tags.
 *
 * `'max'` = stale-while-revalidate: the next visitor gets the previous page
 * instantly and the rebuild happens behind them (P2). No `{ expire: 0 }` waves.
 * Because `'max'` triggers no rebuild on its own, the route then warms `/` and
 * `/produkty/` (the listing shell holds the filter metadata) so the rebuild
 * happens now rather than on a real visitor — throttled per instance, since an
 * Excel price run produces bursts of invalidations.
 *
 * Auth: `Authorization: Bearer <SANITY_REVALIDATE_TAGS_SECRET>`, compared in
 * constant time. A header, not `?secret=`, so the secret never lands in Vercel
 * request logs.
 *
 * ⚠️ `trailingSlash: true` — callers must POST to `/api/revalidate-tags/`. A
 * slashless URL gets a 308 that drops the body.
 *
 * Unknown `sanity:` tags need no allowlist: expiring a tag no entry carries is
 * a no-op, so the route is idempotent, which is what makes the Functions'
 * undocumented retry semantics survivable.
 */

/** Storm guard: a legitimate publish touches a handful of tags. */
const MAX_TAGS = 1000;

/** Non-Sanity tags a caller may expire, as exact names or `<prefix>:<slug>`. */
const CUSTOM_TAG_PATTERN = /^product-pricing(?::[a-z0-9][a-z0-9._-]*)?$/;

const WARM_PATHS = ['/', '/produkty/'] as const;

/** At most one warm round per instance per window. */
const WARM_THROTTLE_MS = 30_000;

const WARM_TIMEOUT_MS = 5000;

/**
 * A plain browser UA: a UA on Next's `htmlLimitedBots` list would make the
 * runtime discard the prerender and render dynamically, rebuilding nothing
 * reusable.
 */
const WARM_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

let lastWarmAt = Number.NEGATIVE_INFINITY;

function warmPaths(origin: string): Promise<unknown> {
  return Promise.all(
    WARM_PATHS.map(async (path) => {
      const url = `${origin}${path}`;
      try {
        const response = await fetch(url, {
          headers: { 'user-agent': WARM_USER_AGENT },
          cache: 'no-store',
          signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
        });
        // Drain the stream: abandoning it mid-flight aborts the render we asked for.
        await response.arrayBuffer();
        if (!response.ok) {
          console.warn(
            `[api/revalidate-tags] warm ${url} answered ${response.status}`,
          );
        }
      } catch (error) {
        console.warn(`[api/revalidate-tags] warm ${url} failed`, error);
      }
    }),
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.SANITY_REVALIDATE_TAGS_SECRET;
  if (!secret) {
    console.error(
      '[api/revalidate-tags] SANITY_REVALIDATE_TAGS_SECRET is not set; rejecting every request.',
    );
    return false;
  }

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!provided) return false;

  const expected = Buffer.from(secret);
  const received = Buffer.from(provided);
  // `timingSafeEqual` throws on a length mismatch; comparing lengths first
  // leaks the length and nothing else.
  return (
    expected.byteLength === received.byteLength &&
    timingSafeEqual(expected, received)
  );
}

function readStringArray(
  body: Record<string, unknown>,
  key: string,
): string[] | null | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return null;
  }
  return value as string[];
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => null);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        {
          message:
            'Body must be { tags: string[] } or { customTags: string[] }',
        },
        { status: 400 },
      );
    }

    const record = body as Record<string, unknown>;
    const tags = readStringArray(record, 'tags');
    const customTags = readStringArray(record, 'customTags');

    if (
      tags === null ||
      customTags === null ||
      (tags === undefined && customTags === undefined)
    ) {
      return NextResponse.json(
        {
          message:
            'Body must be { tags: string[] } or { customTags: string[] }',
        },
        { status: 400 },
      );
    }

    const syncTags = tags ?? [];
    const allowedCustomTags = customTags ?? [];

    if (syncTags.length + allowedCustomTags.length > MAX_TAGS) {
      console.error(
        `[api/revalidate-tags] rejected a payload of ${syncTags.length + allowedCustomTags.length} tags (cap ${MAX_TAGS})`,
      );
      return NextResponse.json(
        { message: `Too many tags (max ${MAX_TAGS})` },
        { status: 400 },
      );
    }

    const rejected = allowedCustomTags.filter(
      (tag) => !CUSTOM_TAG_PATTERN.test(tag),
    );
    if (rejected.length > 0) {
      return NextResponse.json(
        {
          message: `customTags outside the allowlist: ${rejected.slice(0, 5).join(', ')}`,
        },
        { status: 400 },
      );
    }

    for (const tag of syncTags) {
      revalidateTag(`sanity:${tag}`, 'max');
    }
    for (const tag of allowedCustomTags) {
      revalidateTag(tag, 'max');
    }

    // Handed to `after` so the instance stays alive until the warm settles; a
    // floating promise can be frozen once the response flushes. An empty batch
    // warms nothing, and bursts inside the throttle window warm once.
    const now = Date.now();
    if (syncTags.length > 0 && now - lastWarmAt >= WARM_THROTTLE_MS) {
      lastWarmAt = now;
      after(warmPaths(request.nextUrl.origin));
    }

    return NextResponse.json({
      revalidated: syncTags.length + allowedCustomTags.length,
    });
  } catch (error) {
    // A 500 makes the calling Function throw, so the failure lands in
    // `sanity functions logs invalidate-sync-tags` instead of being swallowed.
    console.error('[api/revalidate-tags]', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
