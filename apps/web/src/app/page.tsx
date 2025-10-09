import { notFound } from 'next/navigation';

import { PageBuilder } from '../components/shared/PageBuilder';
import { sanityFetch } from '../global/sanity/client';
import { queryHomePage } from '../global/sanity/query';
import type { QueryHomePageResult } from '../global/sanity/sanity.types';
import { getSEOMetadata } from '../global/seo';

async function fetchHomePageData() {
  return await sanityFetch<QueryHomePageResult>({
    query: queryHomePage,
    tags: ['homePage'],
  });
}

export async function generateMetadata() {
  const homePageData = await fetchHomePageData();
  return getSEOMetadata({
    seo: homePageData?.seo,
    slug: homePageData?.slug,
    openGraph: homePageData?.openGraph,
  });
}

export default async function Page() {
  const homePageData = await fetchHomePageData();

  if (!homePageData) {
    return notFound();
  }

  return (
    <main id="main" className="page-transition">
      <PageBuilder pageBuilder={homePageData.pageBuilder || []} />
    </main>
  );
}
