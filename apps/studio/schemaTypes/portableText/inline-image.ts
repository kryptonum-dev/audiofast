import { ImageIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptInlineImage = defineType({
  name: 'ptInlineImage',
  type: 'object',
  title: 'Zdjęcie w treści',
  icon: ImageIcon,
  description: 'Małe zdjęcie (logo, ikona) wyświetlane wewnątrz tekstu',
  fields: [
    defineField({
      name: 'image',
      type: 'image',
      title: 'Zdjęcie',
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      media: 'image',
    },
    prepare: ({ media }) => ({
      title: 'Zdjęcie w treści',
      subtitle: 'Małe zdjęcie wewnątrz tekstu',
      media: media || ImageIcon,
    }),
  },
});
