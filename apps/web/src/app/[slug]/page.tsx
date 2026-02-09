'use cache';

import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';

import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  queryAllPageSlugs,
  queryPageBySlug,
  queryPageSeoBySlug,
} from '@/src/global/sanity/query';
import type {
  QueryPageBySlugResult,
  QueryPageSeoBySlugResult,
} from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

export async function generateStaticParams() {
  const pages = await sanityFetch<{ slug: string }[]>({
    query: queryAllPageSlugs,
    tags: ['page'],
  });

  return pages
    .filter((page) => page.slug)
    .map((page) => ({
      slug: page.slug.replace(/^\//, '').replace(/\/$/, ''),
    }));
}

async function fetchPageData(slug: string) {
  const sanitySlug = `/${slug.replace(/^\/+/, '').replace(/\/+$/, '')}/`;

  return await sanityFetch<NonNullable<QueryPageBySlugResult>>({
    query: queryPageBySlug,
    params: { slug: sanitySlug },
    // Only slug-specific tag — no broad 'page' tag to avoid invalidating all CMS pages
    tags: [`page:${slug}`],
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sanitySlug = `/${slug.replace(/^\/+/, '').replace(/\/+$/, '')}/`;

  // Use lightweight SEO-only query to reduce deployment metadata size
  const seoData = await sanityFetch<QueryPageSeoBySlugResult>({
    query: queryPageSeoBySlug,
    params: { slug: sanitySlug },
    // Only slug-specific tag — no broad 'page' tag
    tags: [`page:${slug}`],
  });

  if (!seoData) return getSEOMetadata();

  return getSEOMetadata({
    seo: seoData.seo,
    slug: seoData.slug,
    openGraph: seoData.openGraph,
    noNotIndex: seoData.doNotIndex,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  'use cache';
  cacheLife('max');
  const { slug } = await params;
  const pageData = await fetchPageData(slug);

  if (!pageData) {
    notFound();
  }

  // Build breadcrumbs data from page data
  const breadcrumbsData = [
    {
      name: pageData.name || 'Strona',
      path: pageData.slug || `/${slug}`,
    },
  ];

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs
        data={breadcrumbsData}
        firstItemType={pageData.firstBlockType || undefined}
      />
      <PageBuilder
        basePath={pageData.slug || '/'}
        pageBuilder={pageData.pageBuilder || []}
      />
    </main>
  );
}
