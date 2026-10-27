import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';

import { LegalBody } from '@/src/components/legal/LegalBody';
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
import { queryTermsAndConditions } from '@/src/global/sanity/query';
import type { QueryTermsAndConditionsResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';
import type { PortableTextProps } from '@/src/global/types';

function getTermsAndConditionsData(options: DynamicFetchOptions) {
  return sanityFetchCached<QueryTermsAndConditionsResult>({
    requestTag: 'terms.page',
    query: queryTermsAndConditions,
    ...options,
    tags: ['termsAndConditions'],
  });
}

export async function generateMetadata() {
  const pageData = await getTermsAndConditionsData(PUBLISHED);

  if (!pageData) {
    logWarn('Terms and conditions page data not found');
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

export default async function TermsAndConditionsPage() {
  return renderDraftAware(CachedTermsAndConditionsPage, {});
}

async function CachedTermsAndConditionsPage({
  perspective,
  stega,
}: CachedProps) {
  'use cache';
  cacheLife('sanity');
  const pageData = await getTermsAndConditionsData({ perspective, stega });

  if (!pageData) {
    logWarn('Terms and conditions page data not found, returning 404');
    notFound();
  }

  const breadcrumbsData = [
    {
      name: pageData.name || 'Regulamin',
      path: pageData.slug || '/regulamin',
    },
  ];

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs data={breadcrumbsData} />
      <LegalBody
        headings={pageData.headings as unknown as PortableTextProps[]}
        name={pageData.name!}
        description={pageData.description}
        content={pageData.content}
      />
    </main>
  );
}
