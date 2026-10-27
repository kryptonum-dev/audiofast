import { withBotId } from 'botid/next/config';
import type { NextConfig } from 'next';
import { sanity as sanityCacheLife } from 'next-sanity/live/cache-life';

const THIRTY_DAYS = 2592000;
const ONE_YEAR = 31536000;
const IS_DEV = process.env.NODE_ENV === 'development';
// Development profile for Sanity and pricing reads: refresh in the background
// after 1 s, like the old helper's `seconds`, but with `expire` at the 5-minute
// floor so the entry is not "short-lived". A short-lived entry (expire < 5 min)
// becomes a dynamic hole, and now that outer shells name `sanity` too, that
// would turn whole dev shells dynamic. `stale` stays at 30 s, not 0: the root
// layout is still a `'use cache'` shell around `children` until Phase 4, and a
// nested dev `stale` below 30 s is what hung Najbar's cold dev loads
// (research/01 §5.9).
const DEV_PROFILE = { stale: 30, revalidate: 1, expire: 300 };

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,

  // Requires `cacheComponents`. Makes `<Link prefetch="auto">` prefetch one
  // reusable App Shell per route instead of a per-link route prefetch, and
  // enables the 16.3 App Shell for params not returned by `generateStaticParams`
  // — those pages return the shell instantly instead of blocking on a full
  // server render.
  partialPrefetching: true,

  // Cache lifetimes. Freshness is tag-driven: Sanity entries register
  // `sanity:` sync tags (expired by the sync-tag Function from Phase 6) plus
  // the hand tags the `/api/revalidate` webhook still expires during the
  // parallel run, so the windows below are ceilings, not the freshness
  // mechanism. Every `'use cache'` scope names one of these profiles.
  cacheLife: {
    // Outer scopes without an explicit `cacheLife` (and the profile
    // `defineLive`'s own inline `cacheLife(sanity)` inherits `stale`/`expire`
    // from). Kept long so a forgotten `cacheLife` never imposes the built-in
    // 15-minute window on a shell.
    default: {
      stale: THIRTY_DAYS,
      revalidate: THIRTY_DAYS,
      expire: ONE_YEAR,
    },
    // Sanity reads (`live.ts` `sanityFetchPublished`, and the outer cached
    // shells that compose them). Production: next-sanity's `sanity` profile
    // (1-year revalidate), stale/expire made explicit. Development keeps the
    // near-instant refresh (`DEV_PROFILE` above), so local editing never
    // waits on the cache.
    sanity: IS_DEV
      ? DEV_PROFILE
      : { ...sanityCacheLife, stale: THIRTY_DAYS, expire: ONE_YEAR },
    // Supabase pricing (`global/supabase/queries.ts`). Invalidated by the
    // `product-pricing` / `product-pricing:<slug>` tags; time is a ceiling.
    pricing: IS_DEV
      ? DEV_PROFILE
      : { stale: THIRTY_DAYS, revalidate: THIRTY_DAYS, expire: THIRTY_DAYS },
    // Nominatim geocoding of store addresses (`StoreLocations`). Addresses
    // rarely change, and the public Nominatim API must not be hammered.
    geocode: {
      stale: THIRTY_DAYS,
      revalidate: THIRTY_DAYS,
      expire: ONE_YEAR,
    },
  },

  enablePrerenderSourceMaps: false,
  staticPageGenerationTimeout: 180,
  experimental: {
    inlineCss: true,
    // Build hardening for prerendering every slug (~1.4k pages, P6), as in
    // lsse-www: bound the parallel page renders so the Sanity API CDN,
    // Supabase pricing and Nominatim see a steady trickle instead of a burst,
    // and retry a page once on a transient fetch failure instead of failing
    // the whole deploy.
    staticGenerationMaxConcurrency: 4,
    staticGenerationRetryCount: 1,
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

// BotID classification runs through a Vercel proxy that `withBotId` wires up as
// rewrites. Without it the client script has nowhere to post to and every request
// reaches /api/contact with no `x-is-human` header at all.
export default withBotId(nextConfig);
