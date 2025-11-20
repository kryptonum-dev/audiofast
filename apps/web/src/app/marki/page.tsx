import { notFound } from 'next/navigation';

import CollectionPageSchema from '@/src/components/schema/CollectionPageSchema';
import { PageBuilder } from '@/src/components/shared/PageBuilder';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryBrandsPageData } from '@/src/global/sanity/query';
import type { QueryBrandsPageDataResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

export async function generateMetadata() {
  const brandsData = await sanityFetch<QueryBrandsPageDataResult>({
    query: queryBrandsPageData,
    tags: ['brands'],
  });

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
  const brandsData = await sanityFetch<QueryBrandsPageDataResult>({
    query: queryBrandsPageData,
    tags: ['brands'],
  });

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
    <>
      <CollectionPageSchema name={brandsData.name || 'Marki'} url="/marki/" />
      <Breadcrumbs data={breadcrumbsData} firstItemType="heroStatic" />
      <PageBuilder pageBuilder={brandsData.pageBuilder || []} />
    </>
  );
}
