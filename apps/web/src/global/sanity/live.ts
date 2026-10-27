import 'server-only';

import { cacheLife } from 'next/cache';
import { cookies, draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ContentSourceMap, QueryParams } from 'next-sanity';
import {
  defineLive,
  type LivePerspective,
  resolvePerspectiveFromCookies,
} from 'next-sanity/live';

import { client, readToken } from './client';
import { minifyGroq } from './minify-groq';
import { fetchSanityWithRetry } from './retry';

// The Live Content API fetch layer: one strict `defineLive` instance serving
// every Sanity read the app caches (page content, metadata, static params,
// sitemap, actions and route handlers). Every result registers its
// `sanity:`-prefixed sync tags through `cacheTag()` plus the call site's own
// hand tags (parallel run with the `/api/revalidate` webhook until Phase 12).
//
// `defineLive` re-configures the base client for its own fetches: a published
// read rides the API CDN with `cacheMode: 'noStale'` (except during
// `next build`), a draft read goes to the live API with the server token.
//
// `strict: true` is MANDATORY under `cacheComponents`: non-strict mode silently
// resolves `perspective: 'published', stega: false` everywhere, and draft mode
// keeps rendering published content with no error anywhere. Strict mode forces
// every call to pass both, resolved OUTSIDE a `'use cache'` scope
// (`getDynamicFetchOptions()`) and threaded in as plain props.
//
// Tokens: the one server-only Viewer token (`SANITY_API_READ_TOKEN`) serves
// both roles, as in lsse-www and Najbar. As `browserToken` it reaches the
// browser only in draft sessions, where `<SanityLive includeDrafts>` mounts;
// without it `includeDrafts` silently degrades to `false`. `false` (no token
// configured) silences next-sanity's dev warning and keeps reads published.
//
// The one-request `next-js` build of `next-sanity/live` is selected only under
// `cacheComponents`; `scripts/verify-live-variant.ts` fails the build if the
// two-request `react-server` build ends up in the server output (D10).
const { sanityFetch: liveSanityFetch, SanityLive } = defineLive({
  // `defineLive` is typed against next-sanity's own `@sanity/client` 7 copy;
  // the app's single client is `@sanity/client` 8, and the members `defineLive`
  // touches (`withConfig`, `fetch`, `config`) are the same at runtime.
  client: client as unknown as Parameters<typeof defineLive>[0]['client'],
  serverToken: readToken ?? false,
  browserToken: readToken ?? false,
  strict: true,
});

export { SanityLive };

export interface DynamicFetchOptions {
  perspective: LivePerspective;
  stega: boolean;
}

/**
 * The options every published render passes to a cached component. Also the
 * `generateMetadata` key: metadata calls a page's shared cached data function
 * with `PUBLISHED`, which is the same cache entry the published page render
 * reads, so a page and its metadata cost one Sanity round trip.
 */
export const PUBLISHED = {
  perspective: 'published',
  stega: false,
} as const satisfies DynamicFetchOptions;

/**
 * `notFound()` outside draft mode only. In a draft session a never-published
 * document has no published version, so a published-pinned check (metadata,
 * a published existence probe) must not 404 the editor's preview.
 */
export async function notFoundUnlessDraft(): Promise<void> {
  const { isEnabled: isDraft } = await draftMode();
  if (!isDraft) notFound();
}

/**
 * Resolves `perspective` and `stega` outside the `'use cache'` boundary so they
 * can be passed in as serializable props. Honours Presentation's perspective
 * switcher: `defineEnableDraftMode` stores the editor's choice in the
 * `sanity-preview-perspective` cookie. Reads `cookies()` only in draft mode, so
 * a published render never touches request data through it.
 */
export async function getDynamicFetchOptions(): Promise<DynamicFetchOptions> {
  const { isEnabled: isDraft } = await draftMode();
  if (!isDraft) {
    return { perspective: 'published', stega: false };
  }

  const perspective = await resolvePerspectiveFromCookies({
    cookies: await cookies(),
  });
  return { perspective: perspective ?? 'drafts', stega: true };
}

export type SanityFetchArgs = {
  query: string;
  params?: QueryParams;
  perspective: LivePerspective;
  stega: boolean;
  /**
   * Hand cache tags (`product:<slug>`, `filter-metadata`, …), registered next
   * to the sync tags. Kept unchanged during the parallel run with the old
   * webhook; pruned in Phase 12 except `product-pricing*`, `cpoProduct:<slug>`
   * and `geocode`.
   */
  tags?: string[];
  /**
   * Stable per-call request tag (`product.page`, `listing.products`, …).
   * Sent as `audiofast-web.<requestTag>` (the client's `requestTagPrefix`) so
   * Sanity usage can be attributed per query.
   */
  requestTag: string;
};

/**
 * The strict live fetch every Sanity read funnels through.
 *
 * Must run inside a `'use cache'` scope: the underlying fetch registers its
 * tags with `cacheTag()`, which throws in a plain dynamic render. Draft renders
 * stay dynamic anyway — Next bypasses (and never persists) `'use cache'`
 * entries while draft mode is on — so both perspectives run the same code.
 *
 * The query is whitespace-minified at the wire (`minify-groq.ts`); the retry
 * wrapper (3 attempts, 500/1000 ms backoff) is kept around the live call.
 */
export async function sanityFetch<TResult = unknown>({
  query,
  params = {},
  perspective,
  stega,
  tags = [],
  requestTag,
}: SanityFetchArgs): Promise<{
  data: TResult;
  sourceMap: ContentSourceMap | null;
  tags: string[];
}> {
  const minifiedQuery = minifyGroq(query);
  const result = await fetchSanityWithRetry(() =>
    liveSanityFetch({
      query: minifiedQuery,
      params,
      perspective,
      stega,
      tags,
      requestTag,
    }),
  );
  return {
    data: result.data as TResult,
    sourceMap: result.sourceMap,
    tags: result.tags,
  };
}

/**
 * Published-only cached fetch, with its own `'use cache'` scope. Hard-pinned to
 * `perspective: 'published'` and `stega: false`: zero-width markers must never
 * reach a `<title>`, an `og:*`, a sitemap `<loc>`, a JSON-LD value, a server
 * action result or a route handler response, and these stay published even
 * inside a draft session.
 *
 * Use it from `generateMetadata`, `generateStaticParams`, `sitemap.ts`, server
 * actions, route handlers and every surface that is not a Presentation target.
 * Returns the data only.
 */
export async function sanityFetchPublished<TResult = unknown>({
  query,
  params = {},
  tags = [],
  requestTag,
}: {
  query: string;
  params?: QueryParams;
  tags?: string[];
  requestTag: string;
}): Promise<TResult> {
  'use cache';
  cacheLife('sanity');
  const { data } = await sanityFetch<TResult>({
    query,
    params,
    perspective: 'published',
    stega: false,
    tags,
    requestTag,
  });
  return data;
}

/**
 * Cached data function for reads that follow the request's perspective but
 * are not owned by one page's L3 scope: listing slots (resolved under a
 * request-time Suspense hole), self-fetching components and shared page data
 * functions. `perspective` and `stega` are arguments, so they are part of the
 * cache key; a published call with the same query and params shares its entry
 * with every other published caller. Returns the data only.
 */
export async function sanityFetchCached<TResult = unknown>(
  args: SanityFetchArgs,
): Promise<TResult> {
  'use cache';
  cacheLife('sanity');
  const { data } = await sanityFetch<TResult>(args);
  return data;
}

// Intent-named aliases. The SAME function object, so a route reading one query
// from both `generateMetadata` and `generateStaticParams` shares one cache
// entry and one round trip.
export const sanityFetchMetadata = sanityFetchPublished;
export const sanityFetchStaticParams = sanityFetchPublished;
