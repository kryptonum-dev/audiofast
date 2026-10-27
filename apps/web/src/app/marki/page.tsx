import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';

import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { logWarn } from '@/src/global/logger';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
} from '@/src/global/sanity/live';
import { queryBrandsPageData } from '@/src/global/sanity/query';
import type { QueryBrandsPageDataResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

function getBrandsPageData(options: DynamicFetchOptions) {
  return sanityFetchCached<QueryBrandsPageDataResult>({
    requestTag: 'brands.page',
    query: queryBrandsPageData,
    ...options,
    tags: ['brands'],
  });
}

export async function generateMetadata() {
  const brandsData = await getBrandsPageData(PUBLISHED);

  if (!brandsData) {
    logWarn('Brands page data not found');
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: brandsData.seo,
    slug: brandsData.slug,
    openGraph: brandsData.openGraph,
  });
}

export default async function BrandsPage() {
  return renderDraftAware(CachedBrandsPage, {});
}

async function CachedBrandsPage({ perspective, stega, isDraft }: CachedProps) {
  'use cache';
  cacheLife('sanity');
  const brandsData = await getBrandsPageData({ perspective, stega });

  if (!brandsData) {
    logWarn('Brands page data not found');
    notFound();
  }

  const breadcrumbsData = [
    {
      name: 'Strona główna',
      path: '/',
    },
    {
      name: brandsData.name || 'Marki',
      path: '/marki/',
    },
  ];

  return (
    <main id="main" className="page-transition">
      <CollectionPageSchema name={brandsData.name || 'Marki'} url="/marki/" />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <PageBuilder
        pageBuilder={brandsData.pageBuilder || []}
        fetchOptions={{ perspective, stega }}
        documentId={brandsData._id}
        documentType={brandsData._type}
        isDraft={isDraft}
      />
    </main>
  );
}
