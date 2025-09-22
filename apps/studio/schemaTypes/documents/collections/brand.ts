import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { Tag } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
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
    defineField({
      name: 'logo',
      title: 'Logo Marki',
      type: 'image',
      validation: (Rule) => Rule.required(),
      group: GROUP.MAIN_CONTENT,
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      logo: 'logo',
      seo: 'seo',
    },
    prepare: ({ name, logo, seo }) => ({
      title: name || 'Marka',
      subtitle: seo?.description || 'Marka produktów audio',
      media: logo || Tag,
    }),
  },
});
