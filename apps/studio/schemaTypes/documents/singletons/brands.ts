import { Award } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';

export const brands = defineType({
  name: 'brands',
  type: 'document',
  title: 'Strona marek',
  icon: Award,
  groups: GROUPS,
  description:
    'Strona z markami produktów audio. Skonfiguruj treść strony, na której będą wyświetlane wszystkie marki.',
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
      title: name || 'Marki',
      media: Award,
      subtitle: description || 'Strona marek',
    }),
  },
});
