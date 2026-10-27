import 'server-only';

import { createClient as createSanityClient } from '@sanity/client';
import { type QueryParams } from 'next-sanity';

import { apiVersion, client, dataset, projectId, readToken } from './client';
import { minifyGroq } from './minify-groq';
import { fetchSanityWithRetry } from './retry';

// The non-live Sanity helpers. Every cached read goes through `live.ts`
// (`sanityFetch` / `sanityFetchPublished`); what stays here is the uncached
// published read for request-time paths that are not cache scopes yet
// (`sanityFetchDynamic`) and the fresh, token-bearing read for checkout
// correctness (`sanityFetchFresh`).

const freshClient = createSanityClient({
  projectId,
  dataset,
  apiVersion,
  token: readToken,
  useCdn: false,
  perspective: 'published',
  requestTagPrefix: 'audiofast-web',
});

/**
 * Keep uncached reads on the API CDN (cheap), but never accept a stale CDN
 * entry. `cacheMode` is only sent when `useCdn` is true.
 */
const SANITY_DYNAMIC_FETCH_OPTIONS = { cacheMode: 'noStale' } as const;

/**
 * Uncached published read for request-time paths outside any cache scope
 * (pages that already read cookies, admin and legal-document reads). API CDN
 * with `noStale`; no Next cache. Phase 4 moves these to cached helpers.
 */
export async function sanityFetchDynamic<QueryResponse>({
  query,
  params = {},
  requestTag,
}: {
  query: string;
  params?: QueryParams;
  requestTag: string;
}): Promise<QueryResponse> {
  const minifiedQuery = minifyGroq(query);
  return await fetchSanityWithRetry(() =>
    client.fetch<QueryResponse>(minifiedQuery, params, {
      ...SANITY_DYNAMIC_FETCH_OPTIONS,
      tag: requestTag,
    }),
  );
}

/**
 * Fresh Content Lake read for operational checks that must not go through
 * Next cache or Sanity CDN, such as checkout-time CPO availability. Stays
 * outside `defineLive` by design.
 */
export async function sanityFetchFresh<QueryResponse>({
  query,
  params = {},
  requestTag,
}: {
  query: string;
  params?: QueryParams;
  requestTag: string;
}): Promise<QueryResponse> {
  const minifiedQuery = minifyGroq(query);
  return await fetchSanityWithRetry(() =>
    freshClient.fetch<QueryResponse>(minifiedQuery, params, {
      tag: requestTag,
    }),
  );
}
