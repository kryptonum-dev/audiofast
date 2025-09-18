import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { MessageSquareText } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../components/define-slug-for-document';
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
      subtitle: description || 'Recenzja produktu',
    }),
  },
});
