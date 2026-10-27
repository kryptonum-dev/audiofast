import {
  createImageUrlBuilder,
  type SanityImageSource,
} from '@sanity/image-url';

/**
 * Token-free image URL builder. Safe to import from client components:
 * it only needs the public project id and dataset, never a read token.
 * Keep it that way — anything imported here ships to the browser.
 */
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

if (projectId === undefined) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID',
  );
}

export const imageBuilder = createImageUrlBuilder({ projectId, dataset });

export const urlFor = (source: SanityImageSource) =>
  imageBuilder.image(source).auto('format').fit('max').format('webp');
