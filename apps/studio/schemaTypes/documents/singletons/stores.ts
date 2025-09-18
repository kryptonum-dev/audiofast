import { Store } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const stores = defineType({
  name: 'stores',
  type: 'document',
  title: 'Strona salonów',
  icon: Store,
  groups: GROUPS,
  description:
    'Strona z salonami sprzedaży. Skonfiguruj treść strony, na której będą wyświetlane wszystkie salony audio.',
  fields: [
    ...defineSlugForDocument({
      slug: '/salony/',
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
      title: name || 'Salony',
      media: Store,
      subtitle: description || 'Strona salonów',
    }),
  },
});
