import 'server-only';

import { createClient as createSanityClient } from '@sanity/client';
import { cacheLife, cacheTag } from 'next/cache';
import { type QueryParams } from 'next-sanity';

import { apiVersion, client, dataset, projectId, readToken } from './client';

const freshClient = createSanityClient({
  projectId,
  dataset,
  apiVersion,
  token: readToken,
  useCdn: false,
  perspective: 'published',
});

const SANITY_FETCH_ATTEMPTS = 3;
const SANITY_FETCH_RETRY_DELAY_MS = 500;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSanityWithRetry<QueryResponse>(
  fetcher: () => Promise<QueryResponse>,
): Promise<QueryResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= SANITY_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;

      if (attempt === SANITY_FETCH_ATTEMPTS) {
        break;
      }

      console.warn(
        `Sanity fetch failed; retrying (${attempt}/${SANITY_FETCH_ATTEMPTS}).`,
        error,
      );
      await wait(SANITY_FETCH_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

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

  return await fetchSanityWithRetry(() =>
    client.fetch<QueryResponse>(query, params),
  );
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
  return await fetchSanityWithRetry(() =>
    client.fetch<QueryResponse>(query, params),
  );
}

/**
 * Fresh Content Lake read for operational checks that must not go through
 * Next cache or Sanity CDN, such as checkout-time CPO availability.
 */
export async function sanityFetchFresh<QueryResponse>({
  query,
  params = {},
}: {
  query: string;
  params?: QueryParams;
}): Promise<QueryResponse> {
  return await fetchSanityWithRetry(() =>
    freshClient.fetch<QueryResponse>(query, params),
  );
}
