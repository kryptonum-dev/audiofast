import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,

  // Override default cache profiles to prevent 5-minute stale window.
  // Default presets have stale: 300s (5 min) which causes every page to
  // regenerate (ISR write) every 5 minutes when visited by bots/users.
  // Since we use on-demand revalidation via Sanity webhooks, pages should
  // stay fresh until explicitly invalidated — no time-based regeneration.
  cacheLife: {
    default: {
      stale: 2592000, // 30 days
      revalidate: 2592000, // 30 days
      expire: 31536000, // 1 year
    },
    hours: {
      stale: 2592000, // 30 days
      revalidate: 2592000, // 30 days
      expire: 2592000, // 30 days
    },
    days: {
      stale: 2592000, // 30 days
      revalidate: 2592000, // 30 days
      expire: 2592000, // 30 days
    },
    weeks: {
      stale: 2592000, // 30 days
      revalidate: 2592000, // 30 days
      expire: 2592000, // 30 days
    },
    max: {
      stale: 2592000, // 30 days
      revalidate: 2592000, // 30 days
      expire: 31536000, // 1 year
    },
  },

  experimental: {
    inlineCss: true,
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
};

export default nextConfig;
