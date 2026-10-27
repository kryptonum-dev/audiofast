import 'server-only';

import { createClient } from '@sanity/client';

import { SANITY_STUDIO_URL } from '../constants';

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
 * Leaf field names that stega must never encode, because the value is
 * consumed as data (an `=== '…'` comparison, a URL param, an attribute, a
 * server-action payload) rather than rendered as clickable text. Filled in
 * Phase 8 (research/09 §2–3). Stega is off on this client and only switched
 * on per request in draft sessions, so the set is inert until then.
 */
const STEGA_LOGIC_ONLY_FIELDS = new Set<string>([]);

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
    filter: (props) => {
      const key = props.sourcePath.at(-1);
      if (typeof key === 'string' && STEGA_LOGIC_ONLY_FIELDS.has(key)) {
        return false;
      }
      return props.filterDefault(props);
    },
  },
});
