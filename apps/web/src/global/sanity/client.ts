import 'server-only';

import { createClient } from '@sanity/client';

import { SANITY_STUDIO_URL } from '../constants';
import { stegaFilter } from './stega-filter';

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

/**
 * Server-only read token (Viewer). Never prefix it with `NEXT_PUBLIC_`:
 * Next.js inlines public variables into every client bundle that imports
 * them. `live.ts` hands it to `defineLive` as both the server token (draft
 * reads) and the browser token, which reaches the browser only inside a draft
 * session (`<SanityLive includeDrafts>`). Optional because the published
 * dataset is readable without a token.
 */
export const readToken: string | undefined =
  process.env.SANITY_API_READ_TOKEN?.trim() || undefined;

/**
 * see https://www.sanity.io/docs/api-versioning for how versioning works
 */
export const apiVersion =
  /**sanity studio api version */
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-02-10';

/**
 * The one Sanity client. There is no environment switch: localhost, Vercel
 * Preview and production all read the published perspective through the API
 * CDN. Drafts are only ever visible through draft mode, where `defineLive`
 * (`live.ts`) passes `perspective` and `stega` per request.
 *
 * `defineLive` re-configures this client for its own fetches (`useCdn` follows
 * the perspective, `cacheMode: 'noStale'` outside the build phase). The stega
 * config lives here because `defineLive` has no stega option of its own: it
 * toggles `stega: true` per request, and runs with this `studioUrl` + filter.
 *
 * No token on the base client: published reads are anonymous, so CDN entries
 * are shared. Token-bearing reads go through `defineLive`'s `serverToken`
 * (draft perspectives) or `sanityFetchFresh` (checkout).
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: 'published',
  requestTagPrefix: 'audiofast-web',
  stega: {
    enabled: false,
    studioUrl: SANITY_STUDIO_URL,
    // Logic-only leaf names and subtrees: `stega-filter.ts` (research/09 §2).
    filter: stegaFilter,
  },
});
