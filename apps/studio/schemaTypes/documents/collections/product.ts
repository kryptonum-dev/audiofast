import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { BookAudio, Package } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';
import { getSEOFields } from '../../shared/seo';

export const product = defineType({
  name: 'product',
  title: 'Produkt audio',
  type: 'document',
  icon: BookAudio,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Produkt audio, który zostanie opublikowany na stronie internetowej. Dodaj tytuł, opis i specyfikację, aby utworzyć nowy produkt.',
  fields: [
    orderRankField({ type: 'products' }),
    ...defineSlugForDocument({
      prefix: '/produkty/',
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'brand',
      title: 'Marka',
      type: 'reference',
      description: 'Wybierz markę tego produktu.',
      to: [{ type: 'brand' }],
      validation: (Rule) => Rule.required().error('Marka jest wymagana'),
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'availableInStores',
      title: 'Dostępny w salonach',
      type: 'array',
      description: 'Wybierz salony, w których dostępny jest ten produkt.',
      of: [
        {
          type: 'reference',
          to: [{ type: 'store' }],
        },
      ],
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .error('Produkt musi być dostępny w co najmniej jednym salonie'),
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
      title: name || 'Produkt',
      media: Package,
      subtitle: description || 'Produkt audio',
    }),
  },
});
