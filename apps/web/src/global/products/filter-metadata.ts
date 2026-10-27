import 'server-only';

import type { LivePerspective } from 'next-sanity/live';

import { sanityFetchCached } from '../sanity/live';
import { queryAllProductsFilterMetadata } from '../sanity/query';
import type { QueryAllProductsFilterMetadataResult } from '../sanity/sanity.types';

/**
 * The product filter metadata (sidebar counts, brand/category lists, search
 * candidates). One shared cached entry per perspective for every caller: the
 * listing shells, the category and brand pages and the listing slot's search.
 *
 * Always read with stega off: it is logic data (slugs compared against URL
 * params, filter names sent back as GROQ params) and is never overlaid. Kept
 * on its own `filter-metadata` hand tag during the webhook parallel run.
 */
export function getProductsFilterMetadata(perspective: LivePerspective) {
  return sanityFetchCached<QueryAllProductsFilterMetadataResult>({
    requestTag: 'products.listing.filter-metadata',
    query: queryAllProductsFilterMetadata,
    perspective,
    stega: false,
    tags: ['filter-metadata'],
  });
}
