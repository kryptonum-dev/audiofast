import createImageUrlBuilder from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url/lib/types/types';
import { createClient } from 'next-sanity';

import { IS_PRODUCTION_DEPLOYMENT } from '../constants';

function assertValue<T>(v: T | undefined, errorMessage: string): T {
  if (v === undefined) {
    throw new Error(errorMessage);
  }

  return v;
}

export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';

export const projectId = assertValue(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  'Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID',
);

if (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID === undefined) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID',
  );
}

export const readToken = assertValue(
  process.env.NEXT_PUBLIC_SANITY_API_READ_TOKEN,
  'Missing environment variable: SANITY_API_READ_TOKEN',
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
