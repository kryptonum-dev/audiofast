import { RemoveIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

/**
 * Inline horizontal line for portable text
 * Visual separator within text content blocks
 */
export const ptHorizontalLine = defineType({
  name: 'ptHorizontalLine',
  type: 'object',
  title: 'Linia pozioma',
  icon: RemoveIcon,
  description:
    'Pozioma linia oddzielająca sekcje treści wewnątrz bloku tekstowego.',
  fields: [
    defineField({
      name: 'style',
      title: 'Styl',
      type: 'string',
      initialValue: 'horizontalLine',
      hidden: true,
      readOnly: true,
    }),
  ],
  preview: {
    prepare: () => ({
      title: 'Linia pozioma',
      subtitle: 'Wizualny separator',
      media: RemoveIcon,
    }),
  },
});

