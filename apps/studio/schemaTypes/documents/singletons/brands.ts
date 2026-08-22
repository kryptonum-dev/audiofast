import { Podcast } from 'lucide-react';
import { defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const brands = defineType({
  name: 'brands',
  type: 'document',
  title: 'Strona marek',
  icon: Podcast,
  description:
    'To tutaj tworzysz stronę z markami, która wyświetla wszystkie dostępne marki. Możesz dodać treść i zbudować stronę z różnymi sekcjami jak obrazy, tekst i przyciski.',
  groups: GROUPS,
  fields: [
    ...defineSlugForDocument({
      slug: '/marki/',
      group: GROUP.MAIN_CONTENT,
    }),
    pageBuilderField,
    ...getSEOFields({ exclude: ['doNotIndex', 'hideFromList'] }),
  ],
  preview: {
    select: {
      name: 'name',
      description: 'description',
      slug: 'slug.current',
    },
    prepare: ({ name, description }) => ({
      title: name || 'Strona marek',
      media: Podcast,
      subtitle: description || 'Strona marek',
    }),
  },
});
