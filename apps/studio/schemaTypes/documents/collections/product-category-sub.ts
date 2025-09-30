import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { Folder } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { getSEOFields } from '../../shared/seo';

export const productCategorySub = defineType({
  name: 'productCategorySub',
  title: 'Kategoria podrzędna',
  type: 'document',
  icon: Folder,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Podkategoria produktów audio. Musi być przypisana do jednej kategorii nadrzędnej.',
  fields: [
    orderRankField({ type: 'productCategories' }),
    defineField({
      name: 'parentCategory',
      title: 'Kategoria nadrzędna',
      type: 'reference',
      description:
        'Wybierz kategorię nadrzędną, do której należy ta podkategoria.',
      to: [{ type: 'productCategoryParent' }],
      validation: (Rule) =>
        Rule.required().error('Kategoria nadrzędna jest wymagana'),
      group: GROUP.MAIN_CONTENT,
    }),
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
      parentName: 'parentCategory.name',
    },
    prepare: ({ name, description, parentName }) => ({
      title: name || 'Kategoria podrzędna',
      media: Folder,
      subtitle: parentName
        ? `${description || 'Podkategoria'} → ${parentName}`
        : description || 'Podkategoria (brak kategorii nadrzędnej)',
    }),
  },
});
