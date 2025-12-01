import { ImageIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { createRadioListLayout, toPlainText } from '../../utils/helper';
import { customPortableText } from './index';

export const ptImage = defineType({
  name: 'ptImage',
  type: 'object',
  title: 'Obraz',
  icon: ImageIcon,
  fields: [
    defineField({
      name: 'layout',
      title: 'Układ obrazów',
      type: 'string',
      description:
        'Wybierz, czy chcesz wyświetlić jeden obraz czy dwa obok siebie',
      initialValue: 'single',
      options: createRadioListLayout([
        { title: '📷 Jeden obraz', value: 'single' },
        { title: '📷📷 Dwa obrazy', value: 'double' },
      ]),
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Zdjęcie',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }: any) => parent?.layout === 'double',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const layout = (context.parent as any)?.layout;
          if (layout === 'single' && !value) {
            return 'Zdjęcie jest wymagane';
          }
          return true;
        }),
    }),
    defineField({
      name: 'autoWidth',
      title: 'Automatyczna szerokość',
      type: 'boolean',
      description:
        'Gdy włączone, obraz zachowa swoją naturalną szerokość zamiast rozciągać się na 100%',
      initialValue: false,
      hidden: ({ parent }: any) => parent?.layout === 'double',
    }),
    defineField({
      name: 'image1',
      title: 'Pierwsze zdjęcie',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }: any) => parent?.layout !== 'double',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const layout = (context.parent as any)?.layout;
          if (layout === 'double' && !value) {
            return 'Pierwsze zdjęcie jest wymagane';
          }
          return true;
        }),
    }),
    defineField({
      name: 'image2',
      title: 'Drugie zdjęcie',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }: any) => parent?.layout !== 'double',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const layout = (context.parent as any)?.layout;
          if (layout === 'double' && !value) {
            return 'Drugie zdjęcie jest wymagane';
          }
          return true;
        }),
    }),
    customPortableText({
      name: 'caption',
      title: 'Podpis',
      description: 'Opcjonalny podpis wyświetlany pod zdjęciem/zdjęciami',
      optional: true,
      include: {
        styles: ['normal'],
        annotations: ['customLink'],
      },
    }),
  ],

  preview: {
    select: {
      layout: 'layout',
      image: 'image',
      image1: 'image1',
      image2: 'image2',
      caption: 'caption',
    },
    prepare: ({ layout, image, image1, image2, caption }) => {
      const isDouble = layout === 'double';
      return {
        title: isDouble ? 'Dwa obrazy' : 'Jeden obraz',
        subtitle: toPlainText(caption),
        media: isDouble ? image1 : image,
      };
    },
  },
});
