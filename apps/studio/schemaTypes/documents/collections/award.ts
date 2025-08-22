import { orderRankOrdering } from '@sanity/orderable-document-list';
import { Trophy } from 'lucide-react';
import { defineField, defineType } from 'sanity';

export const award = defineType({
  name: 'award',
  title: 'Nagroda',
  type: 'document',
  icon: Trophy,
  orderings: [orderRankOrdering],
  description:
    'Nagroda lub wyróżnienie, które może być przypisane do produktów audio.',
  fields: [
    defineField({
      name: 'name',
      title: 'Nazwa nagrody',
      type: 'string',
      description: 'Nazwa nagrody lub wyróżnienia.',
      validation: (Rule) =>
        Rule.required().error('Nazwa nagrody jest wymagana'),
    }),
    defineField({
      name: 'logo',
      title: 'Logo nagrody',
      type: 'image',
      description: 'Logo nagrody w formacie SVG.',
      options: {
        accept: '.svg',
      },
    }),
  ],
  preview: {
    select: {
      name: 'name',
      logo: 'logo',
    },
    prepare: ({ name, logo }) => ({
      title: name || 'Nagroda',
      media: logo || Trophy,
    }),
  },
});
