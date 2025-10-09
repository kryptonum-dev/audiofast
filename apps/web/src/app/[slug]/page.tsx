import { notFound } from 'next/navigation';

import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { client } from '@/src/global/sanity/client';
import { queryAllPageSlugs, queryPageBySlug } from '@/src/global/sanity/query';
import { getSEOMetadata } from '@/src/global/seo';

export async function generateStaticParams() {
  const pages = await client.fetch<{ slug: string }[]>(queryAllPageSlugs);

  return pages
    .filter((page) => page.slug) // Filter out any pages without slugs
    .map((page) => ({
      slug: page.slug.replace(/^\//, ''), // Remove leading slash for Next.js routing
    }));
}

async function fetchPageData(slug: string) {
  // Add leading slash back for Sanity query
  const sanitySlug = `/${slug.replace(/^\/+/, '').replace(/\/+$/, '')}/`;

  return await client.fetch(queryPageBySlug, { slug: sanitySlug });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const pageData = await fetchPageData(slug);

  return getSEOMetadata(
    pageData
      ? {
          seo: pageData.seo,
          slug: pageData.slug,
          openGraph: pageData.openGraph || undefined,
          noNotIndex: pageData.doNotIndex,
        }
      : {}
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pageData = await fetchPageData(slug);
  console.log(slug);

  console.log(pageData);

  if (!pageData) {
    notFound();
  }

  // Build breadcrumbs data from page data
  const breadcrumbsData = [
    {
      name: pageData.name,
      path: pageData.slug || `/${slug}`,
    },
  ];

  return (
    <main id="main" className="page-transition">
      {/* <Breadcrumbs
        data={breadcrumbsData}
        firstItemType={pageData.firstBlockType}
      /> */}
      <PageBuilder pageBuilder={pageData.pageBuilder || []} />
    </main>
  );
}
