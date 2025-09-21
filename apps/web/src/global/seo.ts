import type { Metadata } from 'next';

import type { Maybe } from '@/global/types';
import { capitalize } from '@/global/utils';

import { BASE_URL, SITE_DESCRIPTION, SITE_TITLE } from './constants';
import { client } from './sanity/client';
import { queryDefaultOGImage } from './sanity/query';

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
    title?: string;
    description?: string;
  };
  slug?: string;
  keywords?: string[];
  noNotIndex?: boolean;
  openGraph?: {
    title?: string;
    description?: string;
    seoImage?: string;
  };
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
  pageTitle?: Maybe<string>;
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
  const {
    seo,
    slug = '/',
    keywords: pageKeywords = [],
    noNotIndex = false,
    openGraph,
    ...pageOverrides
  } = page;

  const pageUrl = buildPageUrl({ baseUrl: BASE_URL, slug });

  const data: { defaultOGImage: string } =
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
    icons: {
      icon: `${BASE_URL}/favicon.ico`,
    },
    keywords: allKeywords,
    robots: noNotIndex ? 'noindex, nofollow' : 'index, follow',
    twitter: {
      card: 'summary_large_image',
      images: [ogImage],
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
          url: ogImage,
          width: 1200,
          height: 630,
          alt: openGraph?.title || defaultTitle,
          secureUrl: ogImage,
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
