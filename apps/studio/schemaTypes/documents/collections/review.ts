import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { MessageSquareText } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { parsePortableTextToString } from '../../../utils/helper';
import { customPortableText } from '../../definitions/portable-text';
import { getSEOFields } from '../../shared/seo';

export const review = defineType({
  name: 'review',
  title: 'Recenzja',
  type: 'document',
  icon: MessageSquareText,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Recenzja produktu audio, która zostanie opublikowana na stronie internetowej. Dodaj tytuł, opis i treść, aby utworzyć nową recenzję produktu.',
  fields: [
    orderRankField({ type: 'reviews' }),
    ...defineSlugForDocument({
      prefix: '/recenzje/',
      group: GROUP.MAIN_CONTENT,
    }),
    defineField({
      name: 'image',
      title: 'Obraz główny',
      type: 'image',
      description:
        'Główny obraz recenzji wyświetlany w sekcji najnowszej publikacji',
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
      validation: (Rule) => Rule.required().error('Obraz główny jest wymagany'),
    }),
    customPortableText({
      name: 'title',
      title: 'Tytuł recenzji',
      description:
        'Główny tytuł recenzji wyświetlany w sekcji najnowszej publikacji',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: [],
        decorators: ['strong'],
        annotations: ['customLink'],
      },
    }),
    customPortableText({
      name: 'description',
      title: 'Opis recenzji',
      description:
        'Krótki opis recenzji wyświetlany w sekcji najnowszej publikacji',
      group: GROUP.MAIN_CONTENT,
      include: {
        styles: ['normal'],
        lists: ['bullet', 'number'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      description: 'description',
    },
    prepare: ({ name, description }) => ({
      title: name || 'Recenzja',
      media: MessageSquareText,
      subtitle: parsePortableTextToString(description) || 'Recenzja produktu',
    }),
  },
});
