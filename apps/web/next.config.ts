import type { NextConfig } from 'next';

import { client } from './src/global/sanity/client';

// Type for Sanity redirect document
interface SanityRedirectItem {
  source: string;
  destination: string;
  permanent: boolean;
}

/**
 * Escapes special regex characters in redirect source paths.
 * Next.js uses path-to-regexp which treats +, *, ?, (, ), {, }, :, [, ] as special characters.
 */
function escapeRedirectSource(source: string): string {
  // Escape special path-to-regexp characters
  return source.replace(/[+*?(){}[\]:]/g, '\\$&');
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,

  experimental: {
    inlineCss: true,
  },
  logging: {
    fetches: {},
  },
  images: {
    minimumCacheTTL: 31536000,
    qualities: [50, 75, 90, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: `/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/**`,
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.vimeocdn.com',
      },
    ],
  },
  trailingSlash: true,

  async redirects() {
    try {
      // Fetch redirects from Sanity at build time
      const redirectsDoc = await client.fetch<{
        redirects: SanityRedirectItem[] | null;
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
        console.warn('[next.config] No redirects found in Sanity');
        return [];
      }

      console.log(
        `[next.config] Loaded ${redirectsDoc.redirects.length} redirects from Sanity`,
      );

      // Escape special regex characters in source paths
      return redirectsDoc.redirects.map((redirect) => ({
        ...redirect,
        source: escapeRedirectSource(redirect.source),
      }));
    } catch (error) {
      console.error(
        '[next.config] Failed to fetch redirects from Sanity:',
        error,
      );
      return [];
    }
  },
};

export default nextConfig;
