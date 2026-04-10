import { sanityFetch } from '@/global/sanity/fetch';
import { queryNavbar } from '@/global/sanity/query';
import type { QueryNavbarResult } from '@/global/sanity/sanity.types';

import HeaderShell from './HeaderShell';

export default async function Header() {
  'use cache';
  const navbarData = await sanityFetch<QueryNavbarResult>({
    query: queryNavbar,
    tags: ['navbar'],
  });

  return <HeaderShell buttons={navbarData?.buttons || []} />;
}
