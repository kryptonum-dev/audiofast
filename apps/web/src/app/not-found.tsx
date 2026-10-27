import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';

import NotFoundComponent from '@/src/components/pageBuilder/NotFound';
import { getDataAttribute } from '@/src/global/sanity/data-attribute';
import {
  type CachedProps,
  renderDraftAware,
} from '@/src/global/sanity/draft-aware';
import {
  type DynamicFetchOptions,
  PUBLISHED,
  sanityFetchCached,
} from '@/src/global/sanity/live';
import { queryNotFoundPage } from '@/src/global/sanity/query';
import type { QueryNotFoundPageResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

import Breadcrumbs from '../components/ui/Breadcrumbs';

function getNotFoundPageData(options: DynamicFetchOptions) {
  return sanityFetchCached<QueryNotFoundPageResult>({
    requestTag: 'not-found.page',
    query: queryNotFoundPage,
    ...options,
    tags: ['notFound'],
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const notFoundData = await getNotFoundPageData(PUBLISHED);
  return getSEOMetadata(
    notFoundData
      ? {
          seo: notFoundData.seo!,
          slug: '/404',
        }
      : {},
  );
}

export default async function NotFound() {
  return renderDraftAware(CachedNotFound, {});
}

async function CachedNotFound({ perspective, stega, isDraft }: CachedProps) {
  'use cache';
  cacheLife('sanity');
  const notFoundData = await getNotFoundPageData({ perspective, stega });

  const breadcrumbsData = [
    {
      name: 'Nie znaleziono strony',
      path: '/404',
    },
  ];

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs data={breadcrumbsData} firstItemType="notFound" />
      {/* Static fallback when the CMS document is missing: calling
          `notFound()` from inside the not-found boundary would recurse. */}
      {notFoundData ? (
        <NotFoundComponent
          {...notFoundData}
          dataAttribute={getDataAttribute({
            id: notFoundData._id,
            type: notFoundData._type,
            isDraft,
          })}
        />
      ) : (
        <h1>Nie znaleziono strony</h1>
      )}
    </main>
  );
}
