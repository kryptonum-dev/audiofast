import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { FileTextIcon } from 'lucide-react';
import { defineArrayMember, defineField, defineType } from 'sanity';
import { GROUP, GROUPS } from '../../../utils/constant';
import { getSEOFields } from '../../shared/seo';
import { defineSlugForDocument } from '../../../utils/define-slug-for-document';

export const blogArticle = defineType({
  name: 'blog-article',
  title: 'Artykuł blogowy',
  type: 'document',
  icon: FileTextIcon,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Artykuł blogowy, który zostanie opublikowany na stronie internetowej. Dodaj tytuł, opis, autora i treść, aby utworzyć nowy artykuł dla czytających.',
  fields: [
    orderRankField({ type: 'blog' }),
    ...defineSlugForDocument({
      prefix: '/blog/',
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
      title: name || 'Artykuł blogowy',
      media: FileTextIcon,
      subtitle: description || 'Artykuł blogowy',
    }),
  },
});
