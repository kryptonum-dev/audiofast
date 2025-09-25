import { Highlighter } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from '../definitions/portable-text';

const title = 'Wyróżnione publikacje';

export const featuredPublications = defineType({
  name: 'featuredPublications',
  icon: Highlighter,
  type: 'object',
  description:
    'Sekcja z karuzelą wyróżnionych publikacji - artykułów blogowych i recenzji',
  fields: [
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description:
        'Główny nagłówek sekcji wyróżnionych publikacji (np. "Wyróżnione publikacje")',
      type: 'heading',
    }),
    defineField({
      name: 'button',
      title: 'Przycisk CTA',
      type: 'button',
      description: 'Główny przycisk wezwania do działania sekcji',
      validation: (Rule) => Rule.required().error('Przycisk CTA jest wymagany'),
    }),
    defineField({
      name: 'publications',
      title: 'Wyróżnione publikacje',
      type: 'array',
      description:
        'Wybierz publikacje do wyświetlenia w karuzeli (4-8 elementów)',
      of: [
        {
          type: 'reference',
          to: [{ type: 'blog-article' }, { type: 'review' }],
          options: {
            disableNew: true,
            filter: ({ parent }) => {
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];
              return {
                filter: '!(_id in $selectedIds) && !(_id in path("drafts.**"))',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.min(4).error('Minimum 4 publikacje'),
        Rule.max(8).error('Maksimum 8 publikacji'),
        Rule.required().error('Publikacje są wymagane'),
        Rule.unique().error('Każda publikacja może być wybrana tylko raz'),
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
        media: Highlighter,
      };
    },
  },
});
