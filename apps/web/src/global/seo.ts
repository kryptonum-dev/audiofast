import type { Metadata } from 'next';

import { capitalize } from '@/global/utils';

import { BASE_URL, SITE_DESCRIPTION, SITE_TITLE } from './constants';
import { sanityFetch } from './sanity/fetch';
import {
  queryDefaultOGImage,
  queryHomePageSeoDescription,
  queryNotFoundPage,
} from './sanity/query';
import type {
  QueryHomePageSeoDescriptionResult,
  QueryNotFoundPageResult,
} from './sanity/sanity.types';

// Site-wide configuration interface
interface SiteConfig {
  title: string;
  description: string;
  twitterHandle: string;
  keywords: string[];
}

// Page-specific SEO data interface
interface PageSeoData extends Omit<Metadata, 'openGraph'> {
  seo?: {
    title?: string | null;
    description?: string | null;
  } | null;
  slug?: string | null;
  keywords?: string[];
  noNotIndex?: boolean | null;
  openGraph?: {
    title?: string | null;
    description?: string | null;
    seoImage?: string | null;
  } | null;
}

// Default site configuration
const siteConfig: SiteConfig = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  twitterHandle: '@audiofast',
  keywords: ['audiofast', 'audio', 'premium', 'quality', 'sound', 'equipment'],
};

function buildPageUrl({
  baseUrl,
  slug,
}: {
  baseUrl: string;
  slug: string;
}): string {
  const normalizedSlug = slug.startsWith('/') ? slug : `/${slug}`;
  return `${baseUrl}${normalizedSlug}`;
}

function extractTitle({
  pageTitle,
  slug,
  siteTitle,
}: {
  pageTitle?: string;
  slug: string;
  siteTitle: string;
}): string {
  if (pageTitle) return pageTitle;
  if (slug && slug !== '/') return capitalize(slug.replace(/^\//, ''));
  return siteTitle;
}

export async function getSEOMetadata(
  page: PageSeoData = {}
): Promise<Metadata> {
  let effectivePage = page;

  // If no SEO data is provided and 404 fallback is enabled, fetch 404 page data
  if (!page.seo || Object.keys(page).length === 0) {
    const notFoundData = await sanityFetch<QueryNotFoundPageResult>({
      query: queryNotFoundPage,
      tags: ['notFound'],
    });
    if (notFoundData) {
      effectivePage = {
        seo: notFoundData.seo,
        slug: '/404',
        openGraph: notFoundData.openGraph || undefined,
      };
    }
  }

  const {
    seo,
    slug = '/',
    keywords: pageKeywords = [],
    noNotIndex = false,
    openGraph,
    ...pageOverrides
  } = effectivePage;

  const pageUrl = buildPageUrl({ baseUrl: BASE_URL, slug: slug || '' });

  // Fetch default OG image and home page description in parallel
  const [ogImageData, homePageSeoData] = await Promise.all([
    sanityFetch<{ defaultOGImage: string | null }>({
      query: queryDefaultOGImage,
      tags: ['settings'],
    }),
    // Fetch home page description for fallback (only if current page has no description)
    !seo?.description
      ? sanityFetch<QueryHomePageSeoDescriptionResult>({
          query: queryHomePageSeoDescription,
          tags: ['homePage'],
        })
      : Promise.resolve(null),
  ]);

  const ogImage = openGraph?.seoImage || ogImageData?.defaultOGImage;

  // Build default metadata values
  const defaultTitle = extractTitle({
    pageTitle: seo?.title || undefined,
    slug: slug || '',
    siteTitle: siteConfig.title,
  });
  // Use page description, fallback to home page description, then site description
  const defaultDescription =
    seo?.description || homePageSeoData?.description || siteConfig.description;
  const allKeywords = [...siteConfig.keywords, ...pageKeywords];

  // Build default metadata object
  const defaultMetadata: Metadata = {
    title: defaultTitle,
    description: defaultDescription,
    // Next.js metadata must be serializable when sent to the client;
    // cast plain string to URL type to avoid runtime errors with URL instances.
    metadataBase: BASE_URL as unknown as URL,
    creator: siteConfig.title,
    authors: [{ name: siteConfig.title }],
    appleWebApp: {
      title: defaultTitle,
    },
    applicationName: defaultTitle,
    keywords: allKeywords,
    robots: noNotIndex ? 'noindex, nofollow' : 'index, follow',
    twitter: {
      card: 'summary_large_image',
      images: [ogImage!],
      creator: siteConfig.twitterHandle,
      title: openGraph?.title || defaultTitle,
      description: openGraph?.description || defaultDescription,
    },
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: 'website',
      countryName: 'PL',
      description: openGraph?.description || defaultDescription,
      title: openGraph?.title || defaultTitle,
      images: [
        {
          url: ogImage!,
          width: 1200,
          height: 630,
          alt: openGraph?.title || defaultTitle,
          secureUrl: ogImage!,
        },
      ],
      url: pageUrl,
    },
  };

  // Override any defaults with page-specific metadata
  return {
    ...defaultMetadata,
    ...pageOverrides,
  };
}
