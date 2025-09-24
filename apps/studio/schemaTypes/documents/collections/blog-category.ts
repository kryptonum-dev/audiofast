import {
  orderRankField,
  orderRankOrdering,
} from '@sanity/orderable-document-list';
import { BookOpen } from 'lucide-react';
import { defineType } from 'sanity';

import { defineSlugForDocument } from '../../../components/define-slug-for-document';
import { GROUP, GROUPS } from '../../../utils/constant';
import { getSEOFields } from '../../shared/seo';

export const blogCategory = defineType({
  name: 'blog-category',
  title: 'Kategoria bloga',
  type: 'document',
  icon: BookOpen,
  groups: GROUPS,
  orderings: [orderRankOrdering],
  description:
    'Kategoria bloga. Kategorie bloga grupują wpisy na blogu w szerokie tematy.',
  fields: [
    orderRankField({ type: 'blog-category' }),
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
      slug: 'slug.current',
    },
    prepare: ({ name, slug }) => ({
      title: name || 'Kategoria bloga',
      media: BookOpen,
      subtitle: slug,
    }),
  },
});
