/**
 * Script to generate redirects.ts from Sanity CMS.
 *
 * Usage: bun run generate:redirects
 *
 * This fetches the redirects document from Sanity and generates
 * a TypeScript file with a Map for O(1) lookup in middleware.
 */

import { createClient } from '@sanity/client';
import { writeFileSync } from 'fs';

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-12-19',
  useCdn: false,
  perspective: 'published',
  token: process.env.NEXT_PUBLIC_SANITY_API_READ_TOKEN,
});

interface SanityRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

async function generateRedirects() {
  console.log('Fetching redirects from Sanity...');

  const redirectsDoc = await client.fetch<{
    redirects: SanityRedirect[] | null;
  } | null>(`
    *[_type == "redirects"][0]{
      redirects[]{
        "source": source.current,
        "destination": destination.current,
        "permanent": isPermanent
      }
    }
  `);

  if (!redirectsDoc?.redirects) {
    console.error('No redirects found in Sanity');
    process.exit(1);
  }

  const redirects = redirectsDoc.redirects;
  console.log(`Found ${redirects.length} redirects`);

  // Ensure destinations are lowercase
  const normalizedRedirects = redirects.map((r) => ({
    ...r,
    destination: r.destination.toLowerCase(),
  }));

  // Generate TypeScript file
  const output = `/**
 * Auto-generated redirects map for legacy URL handling.
 * Generated from Sanity CMS redirects document.
 *
 * DO NOT EDIT MANUALLY - regenerate using: bun run generate:redirects
 * Generated at: ${new Date().toISOString()}
 */

export interface RedirectEntry {
  destination: string;
  permanent: boolean;
}

/**
 * Map of source paths to redirect entries.
 * Using a Map for O(1) lookup performance in middleware.
 */
export const redirectsMap = new Map<string, RedirectEntry>([
${normalizedRedirects.map((r) => `  ['${r.source}', { destination: '${r.destination}', permanent: ${r.permanent ?? true} }],`).join('\n')}
]);

/**
 * Total number of redirects: ${redirects.length}
 */
export const REDIRECTS_COUNT = ${redirects.length};
`;

  writeFileSync('src/generated/redirects.ts', output);
  console.log(
    `Generated src/generated/redirects.ts with ${redirects.length} entries`,
  );
}

generateRedirects().catch((error) => {
  console.error('Failed to generate redirects:', error);
  process.exit(1);
});
