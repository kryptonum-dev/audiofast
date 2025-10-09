import type { Metadata } from 'next';

import NotFoundComponent from '@/src/components/pageBuilder/NotFound';
import { fetchWithLogging } from '@/src/global/sanity/client';
import { queryNotFoundPage } from '@/src/global/sanity/query';
import type { QueryNotFoundPageResult } from '@/src/global/sanity/sanity.types';
import { getSEOMetadata } from '@/src/global/seo';

async function fetchNotFoundPageData() {
  return await fetchWithLogging<QueryNotFoundPageResult>({
    label: 'Not Found Page Data',
    query: queryNotFoundPage,
    tags: ['notFound'],
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const notFoundData = await fetchNotFoundPageData();
  return getSEOMetadata({
    seo: notFoundData!.seo!,
    slug: '/404',
  });
}

export default async function NotFound() {
  const notFoundData = await fetchNotFoundPageData();

  return <NotFoundComponent {...notFoundData!} />;
}
