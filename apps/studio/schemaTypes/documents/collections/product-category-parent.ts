import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { FolderOpen } from 'lucide-react';
import { defineType } from 'sanity';

import { GROUP, GROUPS } from '../../../utils/constant';
import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { getSEOFields } from '../../shared/seo';

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
    orderRankField({ type: 'productCategories' }),
    ...defineSlugForDocument({
      prefix: '/kategorie/',
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
      title: name || 'Kategoria nadrzędna',
      media: FolderOpen,
      subtitle: description || 'Główna kategoria produktów',
    }),
  },
});
