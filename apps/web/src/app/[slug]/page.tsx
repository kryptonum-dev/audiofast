import { notFound } from 'next/navigation';

import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryAllPageSlugs, queryPageBySlug } from '@/src/global/sanity/query';
import type { QueryPageBySlugResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

export async function generateStaticParams() {
  const pages = await sanityFetch<{ slug: string }[]>({
    query: queryAllPageSlugs,
    tags: ['page'],
  });

  return pages
    .filter((page) => page.slug)
    .map((page) => ({
      // Remove both leading and trailing slashes for the route param
      slug: page.slug.replace(/^\//, '').replace(/\/$/, ''),
    }));
}

async function fetchPageData(slug: string) {
  const sanitySlug = `/${slug.replace(/^\/+/, '').replace(/\/+$/, '')}/`;

  return await sanityFetch<NonNullable<QueryPageBySlugResult>>({
    query: queryPageBySlug,
    params: { slug: sanitySlug },
    tags: ['page'],
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pageData = await fetchPageData(slug);

  if (!pageData) return getSEOMetadata();

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
    noNotIndex: pageData.doNotIndex,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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
