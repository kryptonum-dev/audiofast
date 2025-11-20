import type { NextConfig } from 'next';

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
    ],
  },
  trailingSlash: true,
};

export default nextConfig;
