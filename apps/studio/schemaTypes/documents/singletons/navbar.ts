import { PanelTop } from 'lucide-react';
import { defineField, defineType } from 'sanity';

export const navbar = defineType({
  name: 'navbar',
  title: 'Nawigacja',
  type: 'document',
  icon: PanelTop,
  description: 'Konfiguruj główną strukturę nawigacji',
  fields: [
    defineField({
      name: 'buttons',
      title: 'Linki w nawigacji',
      description: 'Dodaj linki do nawigacji. Maksymalnie 5 linków.',
      type: 'array',
      of: [
        {
          type: 'buttonWithNoVariant',
          title: 'Link nawigacji',
        },
      ],
      validation: (Rule) => [
        Rule.required().error('Linki w nawigacji są wymagane'),
        Rule.max(5).error('Maksymalnie 5 linków'),
      ],
    }),
  ],
  preview: {
    prepare: () => ({
      title: 'Nawigacja',
      media: PanelTop,
    }),
  },
});
