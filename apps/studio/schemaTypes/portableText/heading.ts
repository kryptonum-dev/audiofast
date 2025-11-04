import { Heading2 } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { createRadioListLayout, toPlainText } from '../../utils/helper';
import { customPortableText } from './index';

export const ptHeading = defineType({
  name: 'ptHeading',
  type: 'object',
  title: 'Nagłówek z ikoną',
  icon: Heading2,
  fields: [
    defineField({
      name: 'level',
      title: 'Poziom nagłówka',
      type: 'string',
      description: 'Wybierz poziom nagłówka (H3 lub H4)',
      initialValue: 'h3',
      options: createRadioListLayout([
        { title: 'H3', value: 'h3' },
        { title: 'H4', value: 'h4' },
      ]),
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'icon',
      title: 'Ikona',
      type: 'iconPicker',
      description: 'Opcjonalna ikona wyświetlana po lewej stronie nagłówka',
    }),
    customPortableText({
      name: 'text',
      title: 'Tekst nagłówka',
      description: 'Wprowadź tekst nagłówka',
      include: {
        styles: ['normal'],
        decorators: ['strong'],
        annotations: [],
      },
      validation: (Rule) =>
        Rule.required().error('Tekst nagłówka jest wymagany'),
    }),
  ],
  preview: {
    select: {
      level: 'level',
      text: 'text',
      icon: 'icon',
    },
    prepare: ({ level, text, icon }) => {
      const headingText = toPlainText(text);
      return {
        title: `Nagłówek ${level?.toUpperCase() || 'H3'}`,
        subtitle: headingText || 'Brak tekstu',
        media: icon || Heading2,
      };
    },
  },
});
