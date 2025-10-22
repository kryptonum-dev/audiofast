import { Home } from 'lucide-react';
import { defineArrayMember, defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from '../portableText';

const title = 'Statyczna sekcja Hero';

export const heroStatic = defineType({
  name: 'heroStatic',
  title,
  icon: Home,
  type: 'object',
  description: 'Statyczna sekcja Gero z opcjonalną siatką bloków',
  fields: [
    defineField({
      name: 'image',
      title: 'Zdjęcie w tle',
      type: 'image',
      description: 'Główne zdjęcie sekcji hero',
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required().error('Zdjęcie jest wymagane'),
    }),
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description: 'Główny nagłówek sekcji hero',
      type: 'heading',
    }),
    customPortableText({
      name: 'description',
      title: 'Opis sekcji',
      description: 'Tekst opisowy pod nagłówkiem',
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
    defineField({
      name: 'showBlocks',
      title: 'Pokaż siatkę bloków',
      type: 'boolean',
      description: 'Przełącznik do wyświetlania siatki bloków pod sekcją hero',
      initialValue: false,
    }),
    defineField({
      name: 'blocksHeading',
      title: 'Nagłówek bloków',
      type: 'string',
      description:
        'Nagłówek dla sekcji bloków (wyświetlany tylko gdy siatka bloków jest włączona)',
      hidden: ({ parent }) => !parent?.showBlocks,
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { showBlocks?: boolean };
          if (parent?.showBlocks && (!value || value.trim().length === 0)) {
            return 'Nagłówek bloków jest wymagany gdy siatka bloków jest włączona';
          }
          return true;
        }),
    }),
    defineField({
      name: 'blocks',
      title: 'Bloki',
      type: 'array',
      description:
        'Lista bloków do wyświetlenia w siatce (wyświetlane tylko gdy siatka bloków jest włączona)',
      hidden: ({ parent }) => !parent?.showBlocks,
      of: [
        defineArrayMember({
          type: 'object',
          name: 'heroBlock',
          title: 'Blok Hero',
          fields: [
            defineField({
              name: 'icon',
              title: 'Ikona',
              type: 'image',
              description: 'Ikona w formacie SVG',
              validation: (Rule) =>
                Rule.required().error('Ikona jest wymagana'),
              options: {
                accept: 'image/svg+xml',
              },
            }),
            customPortableText({
              name: 'heading',
              title: 'Nagłówek bloku',
              type: 'heading',
            }),
            customPortableText({
              name: 'description',
              title: 'Opis bloku',
            }),
          ],
          preview: {
            select: {
              heading: 'heading',
              description: 'description',
              icon: 'icon',
            },
            prepare: ({ heading, description, icon }) => {
              return {
                title: toPlainText(heading),
                subtitle: toPlainText(description),
                media: icon,
              };
            },
          },
        }),
      ],
      validation: (Rule) => [
        Rule.custom((value, { parent }) => {
          const showBlocks = (parent as { showBlocks?: boolean })?.showBlocks;
          if (
            showBlocks &&
            (!value || !Array.isArray(value) || value.length === 0)
          ) {
            return 'Bloki są wymagane gdy siatka bloków jest włączona';
          }
          return true;
        }),
        Rule.min(3).error('Minimum 3 bloki'),
        Rule.max(6).error('Maksimum 6 bloków'),
      ],
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
        media: Home,
      };
    },
  },
});
