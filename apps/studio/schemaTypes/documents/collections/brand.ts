import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { Tag } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { toPlainText } from '../../../utils/helper';
import { customPortableText } from '../../definitions/portable-text';
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
    customPortableText({
      name: 'description',
      title: 'Opis Marki',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
        lists: ['bullet', 'number'],
      },
      validation: (Rule) => Rule.required().error('Opis marki jest wymagany'),
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      logo: 'logo',
      description: 'description',
    },
    prepare: ({ name, logo, description }) => ({
      title: name || 'Marka',
      subtitle: toPlainText(description),
      media: logo || Tag,
    }),
  },
});
