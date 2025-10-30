import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { UserPen } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';

export const reviewAuthor = defineType({
  name: 'reviewAuthor',
  title: 'Autor recenzji',
  type: 'document',
  icon: UserPen,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Autor recenzji produktów audio. Może to być wewnętrzny recenzent lub zewnętrzny portal/strona internetowa.',
  fields: [
    orderRankField({ type: 'reviewAuthors' }),
    defineField({
      name: 'name',
      title: 'Nazwa autora',
      type: 'string',
      description:
        'Nazwa autora lub portalu (np. "Audiofast", "What Hi-Fi?", "Jarosław Kowalski")',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) => Rule.required().error('Nazwa autora jest wymagana'),
    }),
    defineField({
      name: 'websiteUrl',
      title: 'Link do strony autora',
      type: 'url',
      description:
        'Opcjonalny link do strony internetowej autora lub portalu (np. https://example.com)',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) =>
        Rule.uri({
          scheme: ['http', 'https'],
        }),
    }),
  ],
  preview: {
    select: {
      name: 'name',
      websiteUrl: 'websiteUrl',
    },
    prepare: ({ name, websiteUrl }) => ({
      title: name || 'Autor recenzji',
      subtitle: websiteUrl || 'Brak linku do strony',
      media: UserPen,
    }),
  },
});
