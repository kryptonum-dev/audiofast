import { Star } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const reviews = defineType({
  name: 'reviews',
  type: 'document',
  title: 'Strona recenzji',
  icon: Star,
  groups: GROUPS,
  description:
    'Strona z recenzjami produktów audio. Skonfiguruj treść strony, na której będą wyświetlane wszystkie recenzje produktów.',
  fields: [
    ...defineSlugForDocument({
      slug: '/recenzje/',
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
      title: name || 'Recenzje',
      media: Star,
      subtitle: description || 'Strona recenzji',
    }),
  },
});
