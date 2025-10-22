import { TrendUpwardIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from './index';

export const ptArrowList = defineType({
  name: 'ptArrowList',
  type: 'object',
  title: 'Lista ze strzałkami',
  icon: TrendUpwardIcon,
  fields: [
    defineField({
      name: 'items',
      title: 'Elementy listy',
      type: 'array',
      description: 'Dodaj elementy listy ze strzałkami',
      of: [
        {
          type: 'object',
          fields: [
            customPortableText({
              name: 'content',
              title: 'Treść',
              description: 'Treść elementu listy',
              include: {
                styles: ['normal'],
                decorators: ['strong', 'em'],
                annotations: ['customLink'],
              },
            }),
          ],
          preview: {
            select: {
              content: 'content',
            },
            prepare: ({ content }) => ({
              title: toPlainText(content) || 'Pusty element',
              media: TrendUpwardIcon,
            }),
          },
        },
      ],
      validation: (Rule) =>
        Rule.required().min(1).error('Dodaj przynajmniej jeden element'),
    }),
  ],
  preview: {
    select: {
      items: 'items',
    },
    prepare: ({ items }) => {
      const count = items?.length || 0;
      return {
        title: `Lista ze strzałkami`,
        subtitle: `${count} ${count === 1 ? 'element' : count < 5 ? 'elementy' : 'elementów'}`,
        media: TrendUpwardIcon,
      };
    },
  },
});
