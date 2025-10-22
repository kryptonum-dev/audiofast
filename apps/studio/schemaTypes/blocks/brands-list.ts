import { Tag } from 'lucide-react';
import { defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from '../portableText';

const title = 'Lista wszystkich marek';

export const brandsList = defineType({
  name: 'brandsList',
  icon: Tag,
  type: 'object',
  title,
  description:
    'Sekcja wyświetlająca wszystkie marki z automatycznie pobieraną listą logo marek.',
  fields: [
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description: 'Główny nagłówek sekcji',
      type: 'heading',
    }),
    customPortableText({
      name: 'description',
      title: 'Opis sekcji',
      description:
        'Tekst opisowy wyświetlany pod nagłówkiem, wyjaśniający informacje o markach.',
    }),
    customPortableText({
      name: 'ctaText',
      title: 'Tekst CTA (opcjonalny)',
      description: 'Tekst zachęty wyświetlany poniżej listy marek',
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
      optional: true,
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
    },
    prepare: ({ heading }) => {
      return {
        title,
        subtitle: toPlainText(heading),
        media: Tag,
      };
    },
  },
});
