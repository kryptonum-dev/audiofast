import { ImageIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { customPortableText } from './index';
import { toPlainText } from '../../utils/helper';

export const ptImage = defineType({
  name: 'ptImage',
  type: 'object',
  title: 'Obraz',
  icon: ImageIcon,
  fields: [
    defineField({
      name: 'image',
      title: 'Zdjęcie',
      type: 'image',
      options: { hotspot: true },
      validation: (Rule) => Rule.required().error('Zdjęcie jest wymagane'),
    }),
    customPortableText({
      name: 'caption',
      title: 'Podpis',
      description: 'Opcjonalny podpis wyświetlany pod zdjęciem',
      optional: true,
      include: {
        styles: ['normal'],
        annotations: ['customLink'],
      },
    }),
  ],

  preview: {
    select: {
      image: 'image',
      caption: 'caption',
    },
    prepare: ({ image, caption }) => {
      return {
        title: 'Zdjęcie',
        subtitle: toPlainText(caption),
        media: image,
      };
    },
  },
});
