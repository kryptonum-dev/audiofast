import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { Tag } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { getSEOFields } from '../../shared/seo';

export const brand = defineType({
  name: 'brand',
  title: 'Marka',
  type: 'document',
  icon: Tag,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Marka produktów audio. Dodaj nazwę marki, opis i informacje o producencie.',
  fields: [
    orderRankField({ type: 'brands' }),
    ...defineSlugForDocument({
      prefix: '/marki/',
      group: GROUP.MAIN_CONTENT,
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      description: 'description',
    },
    prepare: ({ name, description }) => ({
      title: name || 'Marka',
      media: Tag,
      subtitle: description || 'Marka produktów audio',
    }),
  },
});
