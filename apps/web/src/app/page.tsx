import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';

import { PageBuilder } from '../components/shared/PageBuilder';
import {
  type CachedProps,
  renderDraftAware,
} from '../global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
} from '../global/sanity/live';
import { queryHomePage } from '../global/sanity/query';
import type { QueryHomePageResult } from '../global/sanity/sanity.types';
import { getSEOMetadata } from '../global/seo';

// Shared cached data function: metadata (PUBLISHED) and the published page
// render read the same entry.
function getHomePageData(options: DynamicFetchOptions) {
  return sanityFetchCached<QueryHomePageResult>({
    requestTag: 'home.page',
    query: queryHomePage,
    ...options,
    tags: ['homePage'],
  });
}

export async function generateMetadata() {
  const homePageData = await getHomePageData(PUBLISHED);
  return getSEOMetadata({
    seo: homePageData?.seo,
    slug: homePageData?.slug,
    openGraph: homePageData?.openGraph,
  });
}

export default async function Page() {
  return renderDraftAware(CachedHomePage, {});
}

async function CachedHomePage({ perspective, stega }: CachedProps) {
  'use cache';
  cacheLife('sanity');
  const homePageData = await getHomePageData({ perspective, stega });

  if (!homePageData) {
    notFound();
  }

  return (
    <main id="main" className="page-transition">
      <PageBuilder
        pageBuilder={homePageData.pageBuilder || []}
        fetchOptions={{ perspective, stega }}
      />
    </main>
  );
}
