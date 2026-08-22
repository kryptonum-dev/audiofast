import { orderRankOrdering } from '@sanity/orderable-document-list';
import { FolderOpen } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';

export const productCategoryParent = defineType({
  name: 'productCategoryParent',
  title: 'Kategoria nadrzędna',
  type: 'document',
  icon: FolderOpen,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Główna kategoria produktów audio. Kategorie nadrzędne grupują produkty w szerokie tematy.',
  fields: [
    {
      name: 'name',
      title: 'Nazwa kategorii',
      type: 'string',
      description: 'Nazwa kategorii nadrzędnej',
      group: GROUP.MAIN_CONTENT,
    },
  ],
  preview: {
    select: {
      name: 'name',
    },
    prepare: ({ name }) => ({
      title: name || 'Kategoria nadrzędna',
      media: FolderOpen,
    }),
  },
});
