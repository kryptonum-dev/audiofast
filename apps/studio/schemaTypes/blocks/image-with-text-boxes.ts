import { ImagePlus } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from '../definitions/portable-text';

const title = 'Obraz z polami tekstowymi';

export const imageWithTextBoxes = defineType({
  name: 'imageWithTextBoxes',
  icon: ImagePlus,
  type: 'object',
  title,
  description: 'Sekcja z obrazem i 4 polami tekstowymi z ikonami',
  fields: [
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description: 'Główny nagłówek sekcji',
      type: 'heading',
    }),
    defineField({
      name: 'image',
      title: 'Obraz',
      type: 'image',
      description: 'Główny obraz sekcji',
      validation: (Rule) => Rule.required().error('Obraz jest wymagany'),
    }),
    defineField({
      name: 'boxes',
      title: 'Kafelki z tekstem i ikonami',
      type: 'array',
      description: 'Lista 4 pól tekstowych z ikonami (dokładnie 4 elementy)',
      of: [
        {
          type: 'object',
          name: 'textBox',
          title: 'Kafelek z tekstem i ikoną',
          fields: [
            defineField({
              name: 'icon',
              title: 'Ikona (SVG)',
              type: 'image',
              description: 'Ikona w formacie SVG',
              options: {
                accept: 'image/svg+xml',
              },
              validation: (Rule) =>
                Rule.required().error('Ikona jest wymagana'),
            }),
            customPortableText({
              name: 'heading',
              title: 'Nagłówek',
              type: 'heading',
            }),
            customPortableText({
              name: 'description',
              title: 'Paragraf',
              include: {
                styles: ['normal'],
                decorators: ['strong', 'em'],
                annotations: ['customLink'],
              },
            }),
          ],
          preview: {
            select: {
              heading: 'heading',
              media: 'icon',
            },
            prepare: ({ heading, media }) => ({
              title: toPlainText(heading) || 'Pole tekstowe',
              media,
            }),
          },
        },
      ],
      validation: (Rule) => [
        Rule.required().error('Pola tekstowe są wymagane'),
        Rule.length(4).error('Wymagane są dokładnie 4 pola tekstowe'),
      ],
    }),
    defineField({
      name: 'cta',
      title: 'Sekcja CTA',
      type: 'object',
      description: 'Opcjonalna sekcja wezwania do działania',
      fields: [
        defineField({
          name: 'showCta',
          title: 'Pokaż sekcję CTA',
          type: 'boolean',
          description: 'Czy wyświetlać sekcję CTA?',
          initialValue: true,
        }),
        customPortableText({
          name: 'ctaParagraph',
          title: 'Paragraf CTA',
          description: 'Tekst wezwania do działania',
          include: {
            styles: ['normal'],
            decorators: ['strong', 'em'],
            annotations: ['customLink'],
          },
          hidden: ({ parent }) => !parent?.showCta,
          validation: (Rule) =>
            Rule.custom((value, context) => {
              const parent = context.parent as { showCta?: boolean };
              if (parent?.showCta && !value) {
                return 'Paragraf CTA jest wymagany gdy sekcja CTA jest widoczna';
              }
              return true;
            }),
        }),
        defineField({
          name: 'ctaButton',
          title: 'Przycisk CTA',
          type: 'buttonWithNoVariant',
          description:
            'Przycisk wezwania do działania (będzie wyświetlany z ikoną telefonu)',
          hidden: ({ parent }) => !parent?.showCta,
          validation: (Rule) =>
            Rule.custom((value, context) => {
              const parent = context.parent as { showCta?: boolean };
              if (parent?.showCta && !value) {
                return 'Przycisk CTA jest wymagany gdy sekcja CTA jest widoczna';
              }
              return true;
            }),
        }),
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
        media: ImagePlus,
      };
    },
  },
});
