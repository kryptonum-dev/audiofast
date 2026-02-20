import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { type QueryParams } from 'next-sanity';

import { client } from './client';

/**
 * Enhanced fetch function with correct Next.js caching strategy
 * - Development: uses "use cache" with cacheLife('seconds') to mimic fresh data while satisfying Static Shell
 * - Production: uses "use cache" with standard lifetime and tags for ISR
 */
export async function sanityFetch<QueryResponse>({
  query,
  params = {},
  tags = [],
}: {
  query: string;
  params?: QueryParams;
  tags?: string[];
}): Promise<QueryResponse> {
  'use cache';

  if (tags.length > 0) {
    cacheTag(...tags);
  }

  if (process.env.NODE_ENV === 'development') {
    cacheLife('seconds');
  } else {
    cacheLife('weeks');
  }

  return await client.fetch<QueryResponse>(query, params);
}

/**
 * Uncached fetch function for dynamic pages that are already outside the cache boundary.
 * Use this for pages that use cookies(), headers(), or other request-time APIs.
 *
 * Since the page is already dynamic, there's no benefit to caching individual fetches -
 * they won't be served from cache anyway.
 */
export async function sanityFetchDynamic<QueryResponse>({
  query,
  params = {},
}: {
  query: string;
  params?: QueryParams;
}): Promise<QueryResponse> {
  return await client.fetch<QueryResponse>(query, params);
}
