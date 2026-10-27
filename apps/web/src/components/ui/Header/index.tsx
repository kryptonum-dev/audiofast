import { sanityFetchPublished } from '@/global/sanity/live';
import { queryNavbar } from '@/global/sanity/query';
import type { QueryNavbarResult } from '@/global/sanity/sanity.types';

import HeaderShell from './HeaderShell';

export default async function Header() {
  'use cache';
  const navbarData = await sanityFetchPublished<QueryNavbarResult>({
    requestTag: 'navbar',
    query: queryNavbar,
    tags: ['navbar'],
  });

  return <HeaderShell buttons={navbarData?.buttons || []} />;
}
