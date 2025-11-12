import { Tag } from 'lucide-react';
import { defineField, defineType } from 'sanity';

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
    defineField({
      name: 'brandsDisplayMode',
      title: 'Tryb wyświetlania marek',
      type: 'string',
      description: 'Wybierz, które marki mają być wyświetlane',
      options: {
        list: [
          { title: 'Wszystkie marki', value: 'all' },
          { title: 'Tylko marki z produktami CPO', value: 'cpoOnly' },
          { title: 'Wybrane ręcznie marki', value: 'manual' },
        ],
        layout: 'radio',
      },
      initialValue: 'all',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'selectedBrands',
      title: 'Wybrane marki',
      type: 'array',
      description: 'Wybierz marki do wyświetlenia (minimum 6 marek)',
      hidden: ({ parent }) => parent?.brandsDisplayMode !== 'manual',
      of: [
        {
          type: 'reference',
          to: [{ type: 'brand' }],
          options: {
            filter: ({ document }) => {
              const selectedIds = Array.isArray(document?.selectedBrands)
                ? document.selectedBrands
                    .map((item: any) => item._ref)
                    .filter(Boolean)
                : [];
              return {
                filter: '!(_id in $selectedIds)',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as any;
          if (parent?.brandsDisplayMode === 'manual') {
            if (!value || !Array.isArray(value) || value.length < 6) {
              return 'Wybierz co najmniej 6 marek';
            }
          }
          return true;
        }),
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
      brandsDisplayMode: 'brandsDisplayMode',
      selectedBrandsCount: 'selectedBrands',
    },
    prepare: ({ heading, brandsDisplayMode, selectedBrandsCount }) => {
      const modeLabel =
        brandsDisplayMode === 'all'
          ? 'Wszystkie marki'
          : brandsDisplayMode === 'cpoOnly'
            ? 'Marki CPO'
            : `Wybrane ręcznie (${Array.isArray(selectedBrandsCount) ? selectedBrandsCount.length : 0})`;

      return {
        title,
        subtitle: `${toPlainText(heading)} | ${modeLabel}`,
        media: Tag,
      };
    },
  },
});
