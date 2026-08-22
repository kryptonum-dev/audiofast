import { UlistIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from './index';

export const ptCircleNumberedList = defineType({
  name: 'ptCircleNumberedList',
  type: 'object',
  title: 'Numerowana lista z czerwonymi kółkami',
  icon: UlistIcon,
  fields: [
    defineField({
      name: 'items',
      title: 'Elementy listy',
      type: 'array',
      description: 'Dodaj elementy numerowanej listy z czerwonymi kółkami',
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
              media: UlistIcon,
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
        title: `Numerowana lista z kółkami`,
        subtitle: `${count} ${count === 1 ? 'element' : count < 5 ? 'elementy' : 'elementów'}`,
        media: UlistIcon,
      };
    },
  },
});
