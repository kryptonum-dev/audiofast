import 'server-only';

import { createClient } from '@sanity/client';

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

/**
 * Server-only read token. Never prefix it with `NEXT_PUBLIC_`: Next.js
 * inlines public variables into every client bundle that imports them.
 * Optional because the published dataset is readable without a token
 * (Vercel Preview has no token set); local dev needs it for drafts.
 */
export const readToken: string | undefined = process.env.SANITY_API_READ_TOKEN;

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
  perspective: process.env.VERCEL_ENV ? 'published' : 'drafts',
  ...(!IS_PRODUCTION_DEPLOYMENT && readToken ? { token: readToken } : {}),
});
