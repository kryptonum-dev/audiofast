import type { Metadata } from 'next';

import { capitalize } from '@/global/utils';

import { BASE_URL, SITE_DESCRIPTION, SITE_TITLE } from './constants';
import { client } from './sanity/client';
import { queryDefaultOGImage, queryNotFoundPage } from './sanity/query';

// Site-wide configuration interface
interface SiteConfig {
  title: string;
  description: string;
  twitterHandle: string;
  keywords: string[];
}

// Page-specific SEO data interface
interface PageSeoData extends Metadata {
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
    const notFoundData = await client.fetch(queryNotFoundPage);
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

  const pageUrl = buildPageUrl({ baseUrl: BASE_URL, slug });

  const data: { defaultOGImage: string | null } | null =
    await client.fetch(queryDefaultOGImage);

  const ogImage = openGraph?.seoImage || data?.defaultOGImage;

  // Build default metadata values
  const defaultTitle = extractTitle({
    pageTitle: seo?.title,
    slug,
    siteTitle: siteConfig.title,
  });
  const defaultDescription = seo?.description || siteConfig.description;
  const allKeywords = [...siteConfig.keywords, ...pageKeywords];

  const fullTitle =
    defaultTitle === siteConfig.title
      ? defaultTitle
      : `${defaultTitle} | ${siteConfig.title}`;

  // Build default metadata object
  const defaultMetadata: Metadata = {
    title: fullTitle,
    description: defaultDescription,
    metadataBase: new URL(BASE_URL),
    creator: siteConfig.title,
    authors: [{ name: siteConfig.title }],
    appleWebApp: {
      title: fullTitle,
    },
    applicationName: fullTitle,
    icons: {
      icon: `${BASE_URL}/favicon.ico`,
    },
    manifest: `${BASE_URL}/manifest.json`,
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
