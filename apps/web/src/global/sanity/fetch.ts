import 'server-only';

import { createClient as createSanityClient } from '@sanity/client';
import { type QueryParams } from 'next-sanity';

import { apiVersion, client, dataset, projectId, readToken } from './client';
import { minifyGroq } from './minify-groq';
import { fetchSanityWithRetry } from './retry';

// The non-live Sanity helpers. Every cached read goes through `live.ts`
// (`sanityFetch` / `sanityFetchCached` / `sanityFetchPublished`); what stays
// here is the uncached published read for the admin coupon picker, which wants
// live catalogue data (`sanityFetchUncachedPublished`), and the fresh,
// token-bearing read for checkout correctness (`sanityFetchFresh`).

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
 * Uncached published read for the operator admin (coupon product picker):
 * rare, and it must show the live catalogue. API CDN with `noStale`; no Next
 * cache.
 */
export async function sanityFetchUncachedPublished<QueryResponse>({
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
