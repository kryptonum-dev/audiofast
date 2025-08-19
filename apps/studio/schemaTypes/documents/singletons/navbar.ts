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
      description: 'Dodaj linki do nawigacji. Maksymalnie 4 linki.',
      type: 'array',
      of: [{ type: 'button' }],
      validation: (Rule) => [
        Rule.required().error('Linki w nawigacji są wymagane'),
        Rule.max(4).error('Maksymalnie 4 linki'),
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
