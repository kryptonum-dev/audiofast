import createImageUrlBuilder from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url/lib/types/types';
import { createClient, type QueryParams } from 'next-sanity';

import { IS_PRODUCTION_DEPLOYMENT } from '../constants';
import { withErrorLogging } from '../logger';

function assertValue<T>(v: T | undefined, errorMessage: string): T {
  if (v === undefined) {
    throw new Error(errorMessage);
  }

  return v;
}

export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';

export const projectId = assertValue(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  'Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID'
);

if (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID === undefined) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID'
  );
}

export const readToken = assertValue(
  process.env.NEXT_PUBLIC_SANITY_API_READ_TOKEN,
  'Missing environment variable: SANITY_API_READ_TOKEN'
);

/**
 * see https://www.sanity.io/docs/api-versioning for how versioning works
 */
export const apiVersion =
  /**sanity studio api version */
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-02-10';

/**
 * Used to configure edit intent links, for Presentation Mode, as well as to configure where the Studio is mounted in the router.
 */
export const studioUrl =
  process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || 'http://localhost:3333';

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: IS_PRODUCTION_DEPLOYMENT,
  perspective: IS_PRODUCTION_DEPLOYMENT ? 'published' : 'drafts',
  ...(!IS_PRODUCTION_DEPLOYMENT ? { token: readToken } : {}),
});

const imageBuilder = createImageUrlBuilder({ projectId, dataset });

export const urlFor = (source: SanityImageSource) =>
  imageBuilder.image(source).auto('format').fit('max').format('webp');

/**
 * Enhanced fetch function with correct Next.js caching strategy
 * - Development & Preview: always fresh (no-store)
 * - Production: force-cache with tags for ISR; otherwise no-store
 */
export async function sanityFetch<QueryResponse>({
  query,
  params = {},
  tags,
}: {
  query: string;
  params?: QueryParams;
  tags?: string[];
}): Promise<QueryResponse> {
  const isProd = IS_PRODUCTION_DEPLOYMENT;
  const hasTags = Array.isArray(tags) && tags.length > 0;

  return await client.fetch<QueryResponse>(
    query,
    params,
    isProd
      ? hasTags
        ? { cache: 'force-cache', next: { tags } }
        : { cache: 'no-store' }
      : { cache: 'no-store' }
  );
}

/**
 * Wrapper around sanityFetch that adds standardized error logging and returns null on failure.
 */
export async function fetchWithLogging<QueryResponse>({
  label,
  query,
  params = {},
  tags,
  context,
}: {
  label: string;
  query: string;
  params?: QueryParams;
  tags?: string[];
  context?: Record<string, unknown>;
}): Promise<QueryResponse | null> {
  return withErrorLogging<QueryResponse>(
    label,
    () => sanityFetch<QueryResponse>({ query, params, tags }),
    { ...(context || {}), params, tags }
  );
}
