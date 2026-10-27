import { cacheLife } from 'next/cache';
import { stegaClean } from 'next-sanity';

import { dataSanity, getDataAttribute } from '@/global/sanity/data-attribute';
import type { CachedProps } from '@/global/sanity/draft-aware';
import { sanityFetch } from '@/global/sanity/live';
import { queryNavbar } from '@/global/sanity/query';
import type { QueryNavbarResult } from '@/global/sanity/sanity.types';

import HeaderShell from './HeaderShell';

// Cached leaf rendered by the root layout's draft-aware dispatch: published
// options for every visitor (and the prerender), draft options inside a
// Suspense-wrapped dynamic layer in a Presentation session.
export default async function Header({
  perspective,
  stega,
  isDraft,
}: CachedProps) {
  'use cache';
  cacheLife('sanity');
  const { data: navbarData } = await sanityFetch<QueryNavbarResult>({
    requestTag: 'navbar',
    query: queryNavbar,
    perspective,
    stega,
    tags: ['navbar'],
  });

  // `HeaderShell` is a client island: it gets the attribute as a string.
  const navbarAttribute = getDataAttribute({
    id: navbarData?._id,
    type: navbarData?._type,
    isDraft,
  });

  const buttons = navbarData?.buttons || [];

  // Draft only: each link addresses `buttons[_key==…]` so the nav is
  // draggable. Its label is stega-cleaned, because stega text filling the
  // link would register its own overlay on the same element and steal the
  // drag handle (lsse audit class C). The item overlay still opens the button.
  // There is one DOM copy of the links (the mobile drawer restyles the same
  // nav), so no responsive duplicate needs excluding.
  const linkDataSanity = navbarAttribute
    ? Object.fromEntries(
        buttons.map((button) => [
          button._key,
          dataSanity(navbarAttribute, ['buttons', { _key: button._key }]),
        ]),
      )
    : undefined;

  return (
    <HeaderShell
      buttons={
        navbarAttribute
          ? buttons.map((button) => ({
              ...button,
              text: stegaClean(button.text),
            }))
          : buttons
      }
      linksDataSanity={dataSanity(navbarAttribute, 'buttons')}
      linkDataSanity={linkDataSanity}
    />
  );
}
