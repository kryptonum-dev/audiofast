import { cacheLife } from 'next/cache';

import type { CachedProps } from '@/global/sanity/draft-aware';
import { sanityFetch } from '@/global/sanity/live';
import { queryNavbar } from '@/global/sanity/query';
import type { QueryNavbarResult } from '@/global/sanity/sanity.types';

import HeaderShell from './HeaderShell';

// Cached leaf rendered by the root layout's draft-aware dispatch: published
// options for every visitor (and the prerender), draft options inside a
// Suspense-wrapped dynamic layer in a Presentation session.
export default async function Header({ perspective, stega }: CachedProps) {
  'use cache';
  cacheLife('sanity');
  const { data: navbarData } = await sanityFetch<QueryNavbarResult>({
    requestTag: 'navbar',
    query: queryNavbar,
    perspective,
    stega,
    tags: ['navbar'],
  });

  return <HeaderShell buttons={navbarData?.buttons || []} />;
}
